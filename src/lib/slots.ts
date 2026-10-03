import type { Fixture } from "@/lib/fixtures";
import type { FixtureStage } from "@/lib/supabase/types";

/**
 * The language knockout slots are written in.
 *
 * A knockout game that is waiting on results carries a label for each side
 * instead of a team ("Group A winner", "Best 3rd (2)", "Winner QF1"). Those
 * labels are the only record of how a bracket fits together, so everything
 * that needs the structure — who goes through, which game feeds which, how
 * the bracket is drawn — reads them through here.
 *
 *   Group A winner / runner-up / 1st / 2nd / 3rd / 4th
 *   Best 3rd (n)      the nth best of the third-placed teams across the groups
 *   Winner R16 n      winner or loser of the nth game of a round,
 *   Loser SF n        rounds being R16, QF and SF, with or without the space
 *
 * A round's games are numbered in kick-off order, and games kicking off
 * together are numbered by court — "Pitch A" before "Pitch B".
 */
export type SlotRef =
  | { kind: "group"; group: string; place: number }
  | { kind: "best-third"; rank: number }
  | { kind: "round"; outcome: "winner" | "loser"; stage: FixtureStage; number: number };

const GROUP_SLOT = /^Group ([A-Z]) (winner|runner-up|1st|2nd|3rd|4th)$/i;
const PLACE: Record<string, number> = {
  winner: 1,
  "1st": 1,
  "runner-up": 2,
  "2nd": 2,
  "3rd": 3,
  "4th": 4,
};
const BEST_THIRD_SLOT = /^Best 3rd \((\d+)\)$/i;
const ROUND_SLOT = /^(Winner|Loser) (R16|QF|SF) ?(\d+)$/i;
const ROUND_STAGE: Record<string, FixtureStage> = {
  r16: "round_of_16",
  qf: "quarterfinal",
  sf: "semifinal",
};

export function parseSlot(label: string | null | undefined): SlotRef | null {
  if (!label) return null;
  const text = label.trim();

  const group = GROUP_SLOT.exec(text);
  if (group) return { kind: "group", group: group[1].toUpperCase(), place: PLACE[group[2].toLowerCase()] };

  const third = BEST_THIRD_SLOT.exec(text);
  if (third) return { kind: "best-third", rank: Number(third[1]) };

  const round = ROUND_SLOT.exec(text);
  if (round) {
    return {
      kind: "round",
      outcome: round[1].toLowerCase() === "winner" ? "winner" : "loser",
      stage: ROUND_STAGE[round[2].toLowerCase()],
      number: Number(round[3]),
    };
  }

  return null;
}

/** "Pitch 2" before "Pitch 10". */
const byCourt = new Intl.Collator("en", { numeric: true, sensitivity: "base" });

/** A category's games in one round, in the order the round is numbered: index 0 is game 1. */
export function roundGames(
  categoryId: string,
  stage: FixtureStage,
  fixtures: readonly Fixture[],
): Fixture[] {
  return fixtures
    .filter((f) => f.categoryId === categoryId && f.stage === stage)
    .sort(
      (a, b) =>
        a.scheduledTime.localeCompare(b.scheduledTime) || byCourt.compare(a.courtName, b.courtName),
    );
}

/** The game a round slot ("Winner QF2") is waiting on, or null for any other kind of slot. */
export function feederGame(
  label: string | null | undefined,
  categoryId: string,
  fixtures: readonly Fixture[],
): { game: Fixture; outcome: "winner" | "loser" } | null {
  const ref = parseSlot(label);
  if (!ref || ref.kind !== "round") return null;
  const game = roundGames(categoryId, ref.stage, fixtures)[ref.number - 1];
  return game ? { game, outcome: ref.outcome } : null;
}

/**
 * How a category's groups send teams on: the top `places` of each group, and
 * the best `bestThirds` of the teams that finish third — read off the
 * knockout slots, so it always matches the bracket the committee set up.
 *
 * With no labelled slots to go on (knockout teams entered by name) the
 * familiar top two is assumed.
 */
export type Qualification = { places: number; bestThirds: number };

export const DEFAULT_PLACES = 2;

export function qualification(categoryId: string, fixtures: readonly Fixture[]): Qualification {
  let places = 0;
  let bestThirds = 0;
  for (const f of fixtures) {
    if (f.categoryId !== categoryId || f.stage === "group") continue;
    for (const label of [f.slotA, f.slotB]) {
      const ref = parseSlot(label);
      if (ref?.kind === "group") places = Math.max(places, ref.place);
      if (ref?.kind === "best-third") bestThirds = Math.max(bestThirds, ref.rank);
    }
  }
  return { places: places || DEFAULT_PLACES, bestThirds };
}
