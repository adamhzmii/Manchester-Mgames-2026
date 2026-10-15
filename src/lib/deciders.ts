import type { Fixture } from "@/lib/fixtures";
import type { FixtureStage } from "@/lib/supabase/types";

/**
 * How a level knockout is settled where the score itself stays level.
 *
 * The rulebook sends a football knockout level at full time to penalties, and
 * a basketball one to a first-to-five overtime that starts again at 0–0. In
 * both the match score stands (1–1, 40–40) and the decider is recorded beside
 * it: "1–1, 4–3 on penalties". Every other sport settles a level knockout by
 * playing on — extra time, the next point — so the deciding score simply is
 * the score, and needs nothing here.
 */
export type DeciderKind = "penalties" | "overtime";

const DECIDERS: Record<string, DeciderKind> = {
  football: "penalties",
  basketball: "overtime",
};

/** The decider a level game of this sport and stage goes to; null if none. */
export function deciderKind(sportSlug: string, stage: FixtureStage): DeciderKind | null {
  if (stage === "group") return null;
  return DECIDERS[sportSlug] ?? null;
}

/** "Penalties" / "Overtime": the heading over the coordinator's entry. */
export function deciderTitle(kind: DeciderKind): string {
  return kind === "penalties" ? "Penalties" : "Overtime";
}

/** "pens" / "OT": the note beside a score. */
export function deciderShort(kind: DeciderKind): string {
  return kind === "penalties" ? "pens" : "OT";
}

/**
 * The decider's result, when it is what settled this game: a finished game,
 * level on the score, in a knockout that has a decider, with one side ahead
 * in it. Null otherwise — including a stale pair left on a game whose score
 * has since moved off level.
 */
export function settledBy(
  f: Pick<Fixture, "status" | "stage" | "sportSlug" | "scoreA" | "scoreB" | "deciderA" | "deciderB">,
): { kind: DeciderKind; a: number; b: number } | null {
  if (f.status !== "finished" || f.scoreA === null || f.scoreA !== f.scoreB) return null;
  const kind = deciderKind(f.sportSlug, f.stage);
  if (!kind || f.deciderA === null || f.deciderB === null || f.deciderA === f.deciderB) return null;
  return { kind, a: f.deciderA, b: f.deciderB };
}

/** "4–3 pens", for a game settled by its decider; null otherwise. */
export function deciderNote(f: Parameters<typeof settledBy>[0]): string | null {
  const d = settledBy(f);
  return d ? `${d.a}–${d.b} ${deciderShort(d.kind)}` : null;
}

/** "on penalties" / "in overtime", for sentences: "won 4–3 on penalties". */
export function deciderPhrase(kind: DeciderKind): string {
  return kind === "penalties" ? "on penalties" : "in overtime";
}

/** "1–1 (4–3 pens)", or plain "2–1": a score as one line of text. */
export function scoreline(f: Parameters<typeof settledBy>[0]): string {
  const base = `${f.scoreA ?? 0}–${f.scoreB ?? 0}`;
  const note = deciderNote(f);
  return note ? `${base} (${note})` : base;
}
