"use server";

import { revalidatePath } from "next/cache";

import { expectedStarts } from "@/lib/delays";
import { FIXTURE_SELECT, toFixture, type Fixture, type FixtureRow } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { londonDate, londonToIso } from "@/lib/london-time";
import { sendPush } from "@/lib/push/server";
import { getCoordinator } from "@/lib/queries";
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

// ------------------------------------------------------------- running late

export type ActionResult = { ok: boolean; message: string };

const SIGNED_OUT: ActionResult = {
  ok: false,
  message: "Not saved. Your coordinator session may have expired — sign in again.",
};

/** A slip has to reach this before followers are told about it... */
const NOTIFY_FROM_MIN = 10;
/** ...and grow by this much again before they are told a second time. */
const NOTIFY_STEP_MIN = 10;

type Client = Awaited<ReturnType<typeof createClient>>;

async function readGame(supabase: Client, fixtureId: string): Promise<Fixture | null> {
  const { data } = await supabase.from("fixtures").select(FIXTURE_SELECT).eq("id", fixtureId).limit(1);
  return data?.[0] ? toFixture(data[0] as unknown as FixtureRow) : null;
}

/**
 * "Starting late": how many minutes a coordinator expects kick-off to slip,
 * before the game starts — a team not here yet, a court not clear. Feeds the
 * same estimate as a late kick-off, so the games after it on the court move
 * too. Zero puts it back on time.
 */
export async function setFixtureDelay(fixtureId: string, minutes: number): Promise<ActionResult> {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes > 120) {
    return { ok: false, message: "Pick a delay between 0 and 120 minutes." };
  }
  if (!(await getCoordinator())) return SIGNED_OUT;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("fixtures")
    .update({ delay_minutes: minutes })
    .eq("id", fixtureId)
    .eq("status", "upcoming")
    .select("id");

  if (error) return { ok: false, message: `Could not save: ${error.message}` };
  if (!data || data.length === 0) {
    return { ok: false, message: "Not saved — the game may have started already." };
  }

  revalidateGames();
  await notifyLateGames(supabase);
  return { ok: true, message: minutes === 0 ? "Back on time." : `Marked ${minutes} min late.` };
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

/**
 * Moves a game that has not started: a new official time, a new court, or
 * both. Unlike running late this changes the schedule itself, so it clears
 * any delay on the game, and the two teams' followers are told.
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

  const { data, error } = await supabase
    .from("fixtures")
    .update({ scheduled_time: iso, court_id: court, delay_minutes: 0, delay_notified_minutes: 0 })
    .eq("id", fixtureId)
    .select(FIXTURE_SELECT);
  if (error) return { ok: false, message: `Could not move: ${error.message}` };
  if (!data || data.length === 0) return SIGNED_OUT;

  const moved = toFixture(data[0] as unknown as FixtureRow);
  const where = `${moved.venueShortName} ${moved.courtName}`;
  revalidateGames();

  const teamIds = [moved.teamAId, moved.teamBId].filter((id): id is string => id !== null);
  if (teamIds.length > 0) {
    try {
      await sendPush(
        {
          title: "Game moved",
          body: `${moved.teamA} v ${moved.teamB} is now at ${formatTime(moved.scheduledTime)}, ${where}.`,
          url: `/match/${moved.id}`,
          tag: `moved-${moved.id}`,
        },
        { teamIds },
      );
    } catch {
      // The move is saved; an unreachable push service must not undo that.
    }
  }

  await notifyLateGames(supabase);
  return { ok: true, message: `Moved to ${formatTime(moved.scheduledTime)}, ${where}.` };
}

/**
 * Tells a game's followers when it is running late — once it has slipped 10
 * minutes, and again each further 10 — using the same estimate every page
 * shows. Runs after anything that can move a court's timetable.
 *
 * Each slip is claimed in the database before it is sent, so two
 * coordinators saving at the same moment cannot both announce it. Best
 * effort throughout: a failure here never undoes the save that caused it.
 */
async function notifyLateGames(supabase: Client): Promise<void> {
  try {
    const { data } = await supabase
      .from("fixtures")
      .select(`${FIXTURE_SELECT}, delay_notified_minutes`)
      .order("scheduled_time");
    if (!data) return;

    const rows = data as unknown as (FixtureRow & { delay_notified_minutes: number })[];
    const fixtures = rows.map(toFixture);
    const expected = expectedStarts(fixtures, Date.now());

    for (const [i, game] of fixtures.entries()) {
      const lateMin = expected.get(game.id)?.lateMin ?? 0;
      const told = rows[i].delay_notified_minutes;
      if (game.status !== "upcoming" || game.teamAId === null || game.teamBId === null) continue;
      if (lateMin < NOTIFY_FROM_MIN || lateMin < told + NOTIFY_STEP_MIN) continue;

      const { data: claimed } = await supabase
        .from("fixtures")
        .update({ delay_notified_minutes: lateMin })
        .eq("id", game.id)
        .lte("delay_notified_minutes", lateMin - NOTIFY_STEP_MIN)
        .select("id");
      if (!claimed || claimed.length === 0) continue;

      const now = new Date(Date.parse(game.scheduledTime) + lateMin * 60_000).toISOString();
      await sendPush(
        {
          title: "Running late",
          body: `${game.teamA} v ${game.teamB} is now expected about ${formatTime(now)} (was ${formatTime(game.scheduledTime)}), ${game.venueShortName} ${game.courtName}.`,
          url: `/match/${game.id}`,
          tag: `late-${game.id}`,
        },
        { teamIds: [game.teamAId, game.teamBId] },
      );
    }
  } catch {
    // Best effort by design — see the docblock.
  }
}
