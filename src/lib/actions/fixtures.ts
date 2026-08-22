"use server";

import { revalidatePath } from "next/cache";

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
  revalidatePath("/scores");

  return { status: "success", message: "Saved." };
}
