"use server";

import { revalidatePath } from "next/cache";

import { sendPush } from "@/lib/push/server";
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

  // Realtime updates every client that is currently watching; these keep the
  // server-rendered versions of the same pages honest.
  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/match/[id]", "page");
  revalidatePath("/team/[id]", "page");

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

  return { status: "success", message: "Saved." };
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

  revalidatePath("/");
  revalidatePath("/schedule");
  revalidatePath("/standings");
  revalidatePath("/match/[id]", "page");
  revalidatePath("/team/[id]", "page");

  return { status: "success", message: "Team assigned." };
}
