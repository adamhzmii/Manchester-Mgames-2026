"use server";

import { revalidatePath, updateTag } from "next/cache";

import { FIXTURE_SELECT, toFixture, type Fixture, type FixtureRow } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { londonDate, londonToIso } from "@/lib/london-time";
import { notifyLateGames } from "@/lib/late-notify";
import { keepsKnockoutOrder, laterTime, nextOnCourt, walkoverScore } from "@/lib/reschedule";
import { sendPush } from "@/lib/push/server";
import { TAG, getCoordinator } from "@/lib/queries";
import { createClient } from "@/lib/supabase/server";
import type { FixtureStatus } from "@/lib/supabase/types";

export type UpdateFixtureState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

const STATUSES: readonly FixtureStatus[] = ["upcoming", "live", "finished"];

/**
 * Parses a score field. Empty is meaningful — an upcoming fixture has no
 * score yet — so it maps to null rather than 0.
 */
function parseScore(raw: FormDataEntryValue | null): number | null | "invalid" {
  if (raw === null) return null;
  const text = String(raw).trim();
  if (text === "") return null;
  const value = Number(text);
  if (!Number.isInteger(value) || value < 0) return "invalid";
  return value;
}

/**
 * The one write in the app: a coordinator pushing a score or flipping a
 * fixture's status.
 *
 * This runs with the caller's session, so the RLS policy on `fixtures` is what
 * actually decides whether the write lands — being able to reach this function
 * is not the same as being allowed to change anything. An anonymous visitor
 * who calls it gets zero rows updated, which is reported back as a failure
 * rather than a silent no-op.
 */
export async function updateFixtureScore(
  _prevState: UpdateFixtureState,
  formData: FormData,
): Promise<UpdateFixtureState> {
  const fixtureId = String(formData.get("fixtureId") ?? "").trim();
  if (!fixtureId) {
    return { status: "error", message: "Missing fixture." };
  }

  const statusRaw = String(formData.get("status") ?? "");
  if (!STATUSES.includes(statusRaw as FixtureStatus)) {
    return { status: "error", message: "Pick a status." };
  }
  const status = statusRaw as FixtureStatus;

  const scoreA = parseScore(formData.get("scoreA"));
  const scoreB = parseScore(formData.get("scoreB"));
  if (scoreA === "invalid" || scoreB === "invalid") {
    return { status: "error", message: "Scores must be whole numbers, zero or above." };
  }

  // Mirrors the fixtures_finished_has_scores CHECK. Caught here so the
  // coordinator sees a sentence rather than a Postgres constraint name.
  if (status === "finished" && (scoreA === null || scoreB === null)) {
    return { status: "error", message: "A finished game needs both scores." };
  }

  const supabase = await createClient();

  // Read the fixture before writing: the push needs team names and the
  // previous status, and after the update the old status is gone.
  const { data: before } = await supabase
    .from("fixtures")
    .select(
      `status, team_a_id, team_b_id,
       team_a:teams!fixtures_team_a_id_fkey ( name ),
       team_b:teams!fixtures_team_b_id_fkey ( name )`,
    )
    .eq("id", fixtureId)
    .limit(1);

  const { data, error } = await supabase
    .from("fixtures")
    .update({ score_a: scoreA, score_b: scoreB, status })
    .eq("id", fixtureId)
    .select("id");

  if (error) {
    return { status: "error", message: `Could not save: ${error.message}` };
  }

  if (!data || data.length === 0) {
    // RLS filtered the row out — almost always an expired session.
    return {
      status: "error",
      message: "Not saved. Your coordinator session may have expired — sign in again.",
    };
  }

  revalidateGames();

  await notifyFixtureChange({
    fixtureId,
    previousStatus: before?.[0]?.status ?? null,
    status,
    scoreA,
    scoreB,
    teamAId: before?.[0]?.team_a_id ?? null,
    teamBId: before?.[0]?.team_b_id ?? null,
    teamAName:
      (before?.[0] as { team_a?: { name: string } | null } | undefined)?.team_a?.name ?? "TBC",
    teamBName:
      (before?.[0] as { team_b?: { name: string } | null } | undefined)?.team_b?.name ?? "TBC",
  });

  // A kick-off or final whistle is what moves the court's timetable: a late
  // start or an overrun shows up here first.
  if (before?.[0]?.status !== status) await notifyLateGames(supabase);

  return { status: "success", message: "Saved." };
}

/**
 * The polled feed updates every open page within seconds; these keep the
 * server-rendered versions of the same pages honest.
 */
function revalidateGames() {
  // The shared fixture list first: without this a coordinator's own save
  // could take a few seconds to show on the page they are looking at.
  updateTag(TAG.fixtures);
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/venues");
  revalidatePath("/match/[id]", "page");
  revalidatePath("/team/[id]", "page");
}

/**
 * Pushes only the two moments that are worth interrupting someone for: a
 * followed team kicking off, and a followed team's final result.
 *
 * Every individual score bump would be intolerable — a basketball game alone
 * would fire dozens — so mid-game updates deliberately stay silent and are
 * carried by realtime instead. Targeted at the two teams involved, so nobody
 * gets notified about a match they are not following.
 *
 * Never allowed to fail the write: the score is already saved by this point,
 * and a push service being unreachable must not be reported to the
 * coordinator as a failed save.
 */
async function notifyFixtureChange(f: {
  fixtureId: string;
  previousStatus: FixtureStatus | null;
  status: FixtureStatus;
  scoreA: number | null;
  scoreB: number | null;
  teamAId: string | null;
  teamBId: string | null;
  teamAName: string;
  teamBName: string;
}): Promise<void> {
  if (f.previousStatus === f.status) return;

  const teamIds = [f.teamAId, f.teamBId].filter((id): id is string => Boolean(id));
  if (teamIds.length === 0) return;

  let title: string | null = null;
  let body: string | null = null;

  if (f.status === "live") {
    title = "Your team is playing now";
    body = `${f.teamAName} v ${f.teamBName} has started.`;
  } else if (f.status === "finished") {
    title = "Full time";
    body = `${f.teamAName} ${f.scoreA ?? "-"} – ${f.scoreB ?? "-"} ${f.teamBName}`;
  }

  if (!title || !body) return;

  try {
    await sendPush(
      // Straight to the match: "your game is live" should open that game, not
      // a list of fifty to find it in.
      { title, body, url: `/match/${f.fixtureId}`, tag: `fixture-${f.fixtureId}` },
      { teamIds },
    );
  } catch {
    // Best effort by design — see the docblock.
  }
}

export type AssignTeamState = {
  status: "idle" | "success" | "error";
  message: string | null;
};

/**
 * Turns a knockout slot's placeholder ("Winner QF1") into a real team, by
 * writing team_a_id or team_b_id directly.
 *
 * There is no schema link from a finished fixture to whichever future fixture
 * it feeds into — "Winner QF1" is display text, not a foreign key — so this
 * is a manual, coordinator-driven action rather than an automatic advance.
 * Deliberately so: a knockout bracket only has a handful of these transitions
 * across a whole day, a person is already looking at the result to decide who
 * goes through, and a link table earns its keep only once that stops being
 * true.
 */
export async function assignFixtureTeam(
  _prevState: AssignTeamState,
  formData: FormData,
): Promise<AssignTeamState> {
  const fixtureId = String(formData.get("fixtureId") ?? "").trim();
  const slot = String(formData.get("slot") ?? "");
  const teamId = String(formData.get("teamId") ?? "").trim();

  if (!fixtureId) {
    return { status: "error", message: "Missing fixture." };
  }
  if (slot !== "a" && slot !== "b") {
    return { status: "error", message: "Invalid slot." };
  }
  if (!teamId) {
    return { status: "error", message: "Pick a team." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixtures")
    .update(slot === "a" ? { team_a_id: teamId } : { team_b_id: teamId })
    .eq("id", fixtureId)
    .select("id");

  if (error) {
    return { status: "error", message: `Could not save: ${error.message}` };
  }

  if (!data || data.length === 0) {
    return {
      status: "error",
      message: "Not saved. Your coordinator session may have expired — sign in again.",
    };
  }

  revalidateGames();

  return { status: "success", message: "Team assigned." };
}

/**
 * Takes a team back out of a knockout slot — for one assigned by mistake.
 * Only before the game starts (after that the score belongs to those two
 * teams), and only for a side drawn as a slot ("Winner QF1"), so a game
 * entered by team name can't be emptied.
 */
export async function unassignFixtureTeam(fixtureId: string, slot: "a" | "b"): Promise<ActionResult> {
  if (slot !== "a" && slot !== "b") return { ok: false, message: "Invalid slot." };
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const game = await readGame(supabase, fixtureId);
  if (!game) return { ok: false, message: "Game not found." };
  if (game.status !== "upcoming") {
    return { ok: false, message: "This game has started, so its teams can't change. Reset it to not started first." };
  }
  const label = slot === "a" ? game.slotA : game.slotB;
  if (!label) return { ok: false, message: "This side isn't a knockout slot." };

  const { data, error } = await supabase
    .from("fixtures")
    .update(slot === "a" ? { team_a_id: null } : { team_b_id: null })
    .eq("id", fixtureId)
    .eq("status", "upcoming")
    .select("id");
  if (error) return { ok: false, message: `Could not save: ${error.message}` };
  if (!data || data.length === 0) return SIGNED_OUT;

  revalidateGames();
  return { ok: true, message: `Cleared. "${label}" is open to assign again.` };
}

// ------------------------------------------------------------- running late

export type ActionResult = { ok: boolean; message: string };

const SIGNED_OUT: ActionResult = {
  ok: false,
  message: "Not saved. Your coordinator session may have expired — sign in again.",
};

type Client = Awaited<ReturnType<typeof createClient>>;

async function readGame(supabase: Client, fixtureId: string): Promise<Fixture | null> {
  const { data } = await supabase.from("fixtures").select(FIXTURE_SELECT).eq("id", fixtureId).limit(1);
  return data?.[0] ? toFixture(data[0] as unknown as FixtureRow) : null;
}

/**
 * "Starts at": when a coordinator says a game that has not started will now
 * begin — a team not here yet, the court not clear. Never before the printed
 * time (players may not be there yet). Later games on the court follow on
 * from it in the estimate. A null time hands the game back to the estimate.
 */
export async function setPlannedStart(fixtureId: string, time: string | null): Promise<ActionResult> {
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const game = await readGame(supabase, fixtureId);
  if (!game) return { ok: false, message: "Game not found." };
  if (game.status !== "upcoming") {
    return { ok: false, message: "Not saved — this game has already started." };
  }

  let iso: string | null = null;
  if (time !== null) {
    iso = londonToIso(londonDate(game.scheduledTime), time);
    if (!iso) return { ok: false, message: "Pick a time." };
    if (Date.parse(iso) < Date.parse(game.scheduledTime)) {
      return {
        ok: false,
        message: `It can't start before its printed time, ${formatTime(game.scheduledTime)}.`,
      };
    }
    // The printed time is stored too, not treated as "nothing set": "it starts
    // at 10:00 after all" has to win over a court the site thinks is behind.
  }

  const { data, error } = await supabase
    .from("fixtures")
    .update({ planned_start: iso })
    .eq("id", fixtureId)
    .eq("status", "upcoming")
    .select("id");

  if (error) return { ok: false, message: `Could not save: ${error.message}` };
  if (!data || data.length === 0) return SIGNED_OUT;

  revalidateGames();
  await notifyLateGames(supabase);
  return {
    ok: true,
    message: iso
      ? Date.parse(iso) === Date.parse(game.scheduledTime)
        ? `Back on time: starts at ${formatTime(iso)}. Later games on ${game.courtName} follow on.`
        : `Starts at ${formatTime(iso)}. Later games on ${game.courtName} follow on.`
      : "Back to the site's estimate.",
  };
}

/**
 * Corrects when a game really kicked off, for a Start game tapped late. The
 * estimates for everything after it on the court are worked out from this.
 */
export async function correctKickoff(fixtureId: string, time: string): Promise<ActionResult> {
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const game = await readGame(supabase, fixtureId);
  if (!game) return { ok: false, message: "Game not found." };
  if (game.status === "upcoming") return { ok: false, message: "This game hasn't started yet." };

  const iso = londonToIso(londonDate(game.scheduledTime), time);
  if (!iso) return { ok: false, message: "Pick a time." };
  if (Date.parse(iso) > Date.now() + 60_000) {
    return { ok: false, message: "That time hasn't happened yet." };
  }
  if (game.finishedAt && Date.parse(iso) > Date.parse(game.finishedAt)) {
    return { ok: false, message: "That's after the final whistle." };
  }

  const { data, error } = await supabase
    .from("fixtures")
    .update({ started_at: iso })
    .eq("id", fixtureId)
    .select("id");
  if (error) return { ok: false, message: `Could not save: ${error.message}` };
  if (!data || data.length === 0) return SIGNED_OUT;

  revalidateGames();
  await notifyLateGames(supabase);
  return { ok: true, message: `Kick-off set to ${formatTime(iso)}.` };
}

// ---------------------------------------------------------------- moves ----

const ORDER_REFUSED: ActionResult = {
  ok: false,
  message:
    "Not moved — that would swap the order of two games in the same knockout round, and the bracket follows that order. Use Change time instead.",
};

/** Every game in a category: what a move is checked against. */
async function categoryGames(supabase: Client, categoryId: string): Promise<Fixture[]> {
  const { data } = await supabase.from("fixtures").select(FIXTURE_SELECT).eq("category_id", categoryId);
  return ((data ?? []) as unknown as FixtureRow[]).map(toFixture);
}

async function courtName(supabase: Client, courtId: string): Promise<string | null> {
  const { data } = await supabase.from("courts").select("name").eq("id", courtId).limit(1);
  return data?.[0]?.name ?? null;
}

/**
 * Gives a game a new official time and court, and tells its two teams'
 * followers. Clears any start time set on it: that belonged to the old slot
 * (and could not be earlier than the new printed time anyway).
 */
async function relocate(
  supabase: Client,
  game: Fixture,
  iso: string,
  courtId: string | null,
): Promise<Fixture | null> {
  const { data } = await supabase
    .from("fixtures")
    .update({
      scheduled_time: iso,
      court_id: courtId,
      planned_start: null,
      delay_minutes: 0,
      delay_notified_minutes: 0,
    })
    .eq("id", game.id)
    .eq("status", "upcoming")
    .select(FIXTURE_SELECT);
  if (!data || data.length === 0) return null;
  return toFixture(data[0] as unknown as FixtureRow);
}

async function tellMoved(moved: Fixture): Promise<void> {
  const teamIds = [moved.teamAId, moved.teamBId].filter((id): id is string => id !== null);
  if (teamIds.length === 0) return;
  try {
    await sendPush(
      {
        title: "Game moved",
        body: `${moved.teamA} v ${moved.teamB} is now at ${formatTime(moved.scheduledTime)}, ${moved.venueShortName} ${moved.courtName}.`,
        url: `/match/${moved.id}`,
        tag: `moved-${moved.id}`,
      },
      { teamIds },
    );
  } catch {
    // The move is saved; an unreachable push service must not undo that.
  }
}

/**
 * Moves a game that has not started: a new official time, a new court, or
 * both. Unlike "starts at" this changes the schedule itself, so it clears
 * any start time set on the game, and the two teams' followers are told.
 */
export async function moveFixture(
  fixtureId: string,
  time: string,
  courtId: string,
): Promise<ActionResult> {
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const game = await readGame(supabase, fixtureId);
  if (!game) return { ok: false, message: "Game not found." };
  if (game.status !== "upcoming") {
    return { ok: false, message: "Only a game that hasn't started can be moved." };
  }

  const iso = londonToIso(londonDate(game.scheduledTime), time);
  if (!iso) return { ok: false, message: "Pick a time." };
  const court = courtId || game.courtId;
  if (Date.parse(iso) === Date.parse(game.scheduledTime) && court === game.courtId) {
    return { ok: false, message: "That's where and when it already is." };
  }

  const name = court && court !== game.courtId ? await courtName(supabase, court) : null;
  const change = { scheduledTime: iso, ...(name ? { courtName: name } : {}) };
  if (!keepsKnockoutOrder(await categoryGames(supabase, game.categoryId), new Map([[game.id, change]]))) {
    return ORDER_REFUSED;
  }

  const moved = await relocate(supabase, game, iso, court);
  if (!moved) return SIGNED_OUT;
  revalidateGames();
  await tellMoved(moved);
  await notifyLateGames(supabase);
  return { ok: true, message: `Moved to ${formatTime(moved.scheduledTime)}, ${moved.venueShortName} ${moved.courtName}.` };
}

/**
 * "Swap with next game": this game and the next one of its sport on its
 * court trade printed times — a player running late, and the next game
 * ready to go. Both teams' followers are told.
 */
export async function swapWithNext(fixtureId: string): Promise<ActionResult> {
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const game = await readGame(supabase, fixtureId);
  if (!game) return { ok: false, message: "Game not found." };
  if (game.status !== "upcoming") return { ok: false, message: "This game has already started." };

  const games = await categoryGamesOnCourt(supabase, game);
  const next = nextOnCourt(game, games);
  if (!next) return { ok: false, message: `There's no later ${game.sportName.toLowerCase()} game on ${game.courtName} to swap with.` };
  if ((game.stage === "group") !== (next.stage === "group")) {
    return { ok: false, message: "A group game and a knockout game can't swap. Use Change time instead." };
  }
  const changes = new Map([
    [game.id, { scheduledTime: next.scheduledTime }],
    [next.id, { scheduledTime: game.scheduledTime }],
  ]);
  if (!keepsKnockoutOrder(games, changes)) return ORDER_REFUSED;

  const first = await relocate(supabase, game, next.scheduledTime, game.courtId);
  if (!first) return SIGNED_OUT;
  const second = await relocate(supabase, next, game.scheduledTime, next.courtId);
  if (!second) {
    // Put the first back rather than leave two games at one time.
    await relocate(supabase, first, game.scheduledTime, game.courtId);
    return { ok: false, message: "Not swapped — the next game may have just started. Try again." };
  }

  revalidateGames();
  await tellMoved(first);
  await tellMoved(second);
  await notifyLateGames(supabase);
  return {
    ok: true,
    message: `Swapped: ${second.teamA} v ${second.teamB} now ${formatTime(second.scheduledTime)}, ${first.teamA} v ${first.teamB} now ${formatTime(first.scheduledTime)}.`,
  };
}

/** A game's sport on its court — what "next" and "last" are judged against. */
async function categoryGamesOnCourt(supabase: Client, game: Fixture): Promise<Fixture[]> {
  const { data } = await supabase.from("fixtures").select(FIXTURE_SELECT).eq("court_id", game.courtId ?? "");
  const onCourt = ((data ?? []) as unknown as FixtureRow[]).map(toFixture);
  const category = await categoryGames(supabase, game.categoryId);
  const seen = new Set(onCourt.map((f) => f.id));
  return [...onCourt, ...category.filter((f) => !seen.has(f.id))];
}

/** "Play later": the game goes to the end of its sport's games on its court. */
export async function playLater(fixtureId: string): Promise<ActionResult> {
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const game = await readGame(supabase, fixtureId);
  if (!game) return { ok: false, message: "Game not found." };
  if (game.status !== "upcoming") return { ok: false, message: "This game has already started." };

  const games = await categoryGamesOnCourt(supabase, game);
  const iso = laterTime(game, games);
  if (!iso) return { ok: false, message: `It's already the last game on ${game.courtName}.` };
  if (!keepsKnockoutOrder(games, new Map([[game.id, { scheduledTime: iso }]]))) return ORDER_REFUSED;

  const moved = await relocate(supabase, game, iso, game.courtId);
  if (!moved) return SIGNED_OUT;
  revalidateGames();
  await tellMoved(moved);
  await notifyLateGames(supabase);
  return { ok: true, message: `Moved to the end of ${moved.courtName}: now ${formatTime(moved.scheduledTime)}.` };
}

/**
 * "Play on a free court now": a game waiting for its own court goes to one
 * standing empty, at the current time, ready to start.
 */
export async function playNowOn(fixtureId: string, courtId: string): Promise<ActionResult> {
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const game = await readGame(supabase, fixtureId);
  if (!game) return { ok: false, message: "Game not found." };
  if (game.status !== "upcoming") return { ok: false, message: "This game has already started." };

  const { data: busy } = await supabase
    .from("fixtures")
    .select("id")
    .eq("court_id", courtId)
    .eq("status", "live")
    .limit(1);
  if (busy && busy.length > 0) return { ok: false, message: "That court has a game on right now." };

  const now = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date());
  const iso = londonToIso(londonDate(game.scheduledTime), now);
  const name = await courtName(supabase, courtId);
  if (!iso || !name) return { ok: false, message: "Court not found." };
  if (!keepsKnockoutOrder(await categoryGames(supabase, game.categoryId), new Map([[game.id, { scheduledTime: iso, courtName: name }]]))) {
    return ORDER_REFUSED;
  }

  const moved = await relocate(supabase, game, iso, courtId);
  if (!moved) return SIGNED_OUT;
  revalidateGames();
  await tellMoved(moved);
  await notifyLateGames(supabase);
  return { ok: true, message: `Moved to ${moved.courtName}, now. Tap Start game when it begins.` };
}

/**
 * A court that can't be used — a spill, a broken net: every game of the
 * sport still to play there moves to another court at the same times, and
 * the delays on that court sort out the order.
 */
export async function moveCourtGames(
  fromCourtId: string,
  toCourtId: string,
  sportSlug: string,
): Promise<ActionResult> {
  if (!(await getCoordinator())) return SIGNED_OUT;
  if (fromCourtId === toCourtId) return { ok: false, message: "Pick a different court." };

  const supabase = await createClient();
  const { data } = await supabase
    .from("fixtures")
    .select(FIXTURE_SELECT)
    .eq("court_id", fromCourtId)
    .eq("status", "upcoming");
  const games = ((data ?? []) as unknown as FixtureRow[]).map(toFixture).filter((f) => f.sportSlug === sportSlug);
  if (games.length === 0) return { ok: false, message: "No games left to move on that court." };

  const name = await courtName(supabase, toCourtId);
  if (!name) return { ok: false, message: "Court not found." };
  for (const categoryId of new Set(games.map((g) => g.categoryId))) {
    const changes = new Map(games.filter((g) => g.categoryId === categoryId).map((g) => [g.id, { courtName: name }]));
    if (!keepsKnockoutOrder(await categoryGames(supabase, categoryId), changes)) return ORDER_REFUSED;
  }

  let movedCount = 0;
  for (const game of games) {
    const moved = await relocate(supabase, game, game.scheduledTime, toCourtId);
    if (!moved) continue;
    movedCount += 1;
    await tellMoved(moved);
  }
  revalidateGames();
  await notifyLateGames(supabase);
  return { ok: true, message: `Moved ${movedCount} ${movedCount === 1 ? "game" : "games"} to ${name}.` };
}

/**
 * A walkover: a team that never turned up, or one that couldn't carry on.
 * The game ends with the sport's walkover score to the other side.
 */
export async function awardGame(fixtureId: string, winner: "a" | "b"): Promise<ActionResult> {
  if (winner !== "a" && winner !== "b") return { ok: false, message: "Pick the winner." };
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const game = await readGame(supabase, fixtureId);
  if (!game) return { ok: false, message: "Game not found." };
  if (game.status === "finished") return { ok: false, message: "This game has already finished." };
  if (game.teamAId === null || game.teamBId === null) {
    return { ok: false, message: "Set both teams first." };
  }

  const score = walkoverScore(game.sportSlug, game.stage);
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("fixtures")
    .update({
      status: "finished",
      score_a: winner === "a" ? score : 0,
      score_b: winner === "b" ? score : 0,
      started_at: game.startedAt ?? now,
      finished_at: now,
    })
    .eq("id", fixtureId)
    .neq("status", "finished")
    .select("id");
  if (error) return { ok: false, message: `Could not save: ${error.message}` };
  if (!data || data.length === 0) return SIGNED_OUT;

  revalidateGames();
  const [won, lost] = winner === "a" ? [game.teamA, game.teamB] : [game.teamB, game.teamA];
  try {
    await sendPush(
      {
        title: "Walkover",
        body: `${won} win ${score}–0 against ${lost} by walkover.`,
        url: `/match/${game.id}`,
        tag: `fixture-${game.id}`,
      },
      { teamIds: [game.teamAId, game.teamBId] },
    );
  } catch {
    // Saved already; push is best effort.
  }
  await notifyLateGames(supabase);
  return { ok: true, message: `${won} win ${score}–0 by walkover.` };
}
