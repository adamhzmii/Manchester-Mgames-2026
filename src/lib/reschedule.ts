import { courtKey, slotLengths } from "@/lib/delays";
import { byKickoff, type Fixture } from "@/lib/fixtures";
import { roundGames } from "@/lib/slots";
import type { FixtureStage } from "@/lib/supabase/types";

/**
 * The moves a coordinator makes on the day, worked out before anything is
 * saved: who swaps with whom, where "later" is, and whether a move would
 * scramble a knockout bracket.
 */

/**
 * The winning score for a game won by walkover — a team that never turned
 * up, or one that could not carry on. The committee has no rule of its own,
 * so these follow each sport's usual conventions and the 2026 formats: a
 * race-to sport gets the full race, a timed one a clear but ordinary margin.
 */
export function walkoverScore(sportSlug: string, stage: FixtureStage): number {
  const knockout = stage !== "group";
  switch (sportSlug) {
    case "football":
      return 3;
    case "basketball":
      return 20;
    case "netball":
      return 10;
    case "volleyball":
      return 31;
    case "frisbee":
      return 5;
    case "badminton":
      return knockout ? 30 : 21;
    case "pickleball":
      // Knockouts are best of three games, scored in games won.
      return knockout ? 2 : 15;
    case "table-tennis":
      // Best of three sets, best of five from the semi-finals.
      return knockout ? 3 : 2;
    default:
      return 1;
  }
}

/** The next game to be played after this one on its court, in its sport. */
export function nextOnCourt(fixture: Fixture, fixtures: readonly Fixture[]): Fixture | null {
  const key = courtKey(fixture);
  return (
    [...fixtures]
      .filter(
        (f) =>
          f.id !== fixture.id &&
          f.status === "upcoming" &&
          f.sportSlug === fixture.sportSlug &&
          courtKey(f) === key &&
          byKickoff(f, fixture) > 0,
      )
      .sort(byKickoff)[0] ?? null
  );
}

/**
 * When "play this later" puts a game: one slot after the last game of its
 * round on its court — the end of the group games there, not after the
 * final — so it becomes the last of that session.
 */
export function laterTime(fixture: Fixture, fixtures: readonly Fixture[]): string | null {
  const key = courtKey(fixture);
  const court = fixtures
    .filter(
      (f) =>
        f.id !== fixture.id &&
        f.categoryId === fixture.categoryId &&
        f.stage === fixture.stage &&
        courtKey(f) === key,
    )
    .sort(byKickoff);
  const last = court[court.length - 1];
  if (!last) return null;
  const slot = slotLengths(fixtures).get(last.id) ?? 15 * 60_000;
  const at = Date.parse(last.scheduledTime) + slot;
  return at > Date.parse(fixture.scheduledTime) ? new Date(at).toISOString() : null;
}

export type Change = { scheduledTime?: string; courtName?: string };

/**
 * Whether some moves leave every knockout round numbered as it was.
 *
 * A bracket finds its games by number — "Winner QF1" is the first
 * quarter-final by kick-off, then court — so moving QF2 ahead of QF1 would
 * quietly send QF2's winner down QF1's side of the draw. Moves that would
 * do that are refused; anything else (group games, a knockout moving
 * without overtaking another in its round) is fine.
 */
export function keepsKnockoutOrder(
  fixtures: readonly Fixture[],
  changes: ReadonlyMap<string, Change>,
): boolean {
  const moved = fixtures.filter((f) => changes.has(f.id) && f.stage !== "group");
  if (moved.length === 0) return true;
  const after = fixtures.map((f) => (changes.has(f.id) ? { ...f, ...changes.get(f.id) } : f));
  for (const f of moved) {
    const before = roundGames(f.categoryId, f.stage, fixtures).map((g) => g.id);
    const now = roundGames(f.categoryId, f.stage, after).map((g) => g.id);
    if (before.join() !== now.join()) return false;
  }
  return true;
}
