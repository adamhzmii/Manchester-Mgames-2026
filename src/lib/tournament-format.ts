import type { Fixture } from "@/lib/fixtures";
import { qualification, type Qualification } from "@/lib/slots";
import { pointsRule, type GroupMeta, type TeamMeta } from "@/lib/standings";
import type { FixtureStage } from "@/lib/supabase/types";

/**
 * How each sport's tournament works, in plain sentences, derived entirely
 * from the fixture list and groups — so it can never disagree with the
 * schedule, and says nothing the committee has not actually set up.
 *
 * Match length, squad sizes and the like are not in the data, and are not
 * guessed at here.
 */
export type SportFormat = {
  teams: number;
  lines: string[];
  rounds: string[];
};

const ROUND_ORDER: readonly FixtureStage[] = [
  "playoff",
  "round_of_16",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];

const ROUND_LABEL: Record<FixtureStage, string> = {
  group: "Group stage",
  playoff: "Play-off",
  round_of_16: "Round of 16",
  quarterfinal: "Quarter-finals",
  semifinal: "Semi-finals",
  third_place: "3rd-place game",
  final: "Final",
};

function numberWord(n: number): string {
  return ["no", "one", "two", "three", "four", "five", "six", "seven", "eight"][n] ?? String(n);
}

export function describeFormat(
  sportSlug: string,
  fixtures: readonly Fixture[],
  groups: readonly (GroupMeta & { sportSlug: string })[],
  teams: readonly (TeamMeta & { sportSlug: string })[],
): SportFormat {
  const games = fixtures.filter((f) => f.sportSlug === sportSlug);
  const sportGroups = groups.filter((g) => g.sportSlug === sportSlug);
  const sportTeams = teams.filter((t) => t.sportSlug === sportSlug);
  const rounds = ROUND_ORDER.filter((stage) => games.some((f) => f.stage === stage));
  const lines: string[] = [];

  if (sportGroups.length > 0) {
    const sizes = sportGroups.map((g) => sportTeams.filter((t) => t.groupId === g.id).length);
    const even = sizes.every((s) => s === sizes[0]);
    lines.push(
      sportGroups.length === 1
        ? `One group of ${sizes[0]}, everyone plays everyone.`
        : even
          ? `${numberWord(sportGroups.length)[0].toUpperCase()}${numberWord(sportGroups.length).slice(1)} groups of ${sizes[0]}, everyone plays everyone in their group.`
          : `${sportGroups.length} groups, everyone plays everyone in their group.`,
    );

    const rule = pointsRule(sportSlug);
    lines.push(`${rule.win} points for a win, ${rule.draw} for a draw.`);

    const firstKnockout = rounds.find((r) => r !== "third_place");
    if (firstKnockout) {
      lines.push(
        throughLine(qualification(sportGroups[0].categoryId, games), {
          groups: sportGroups.length,
          groupSize: Math.max(...sizes),
          round: firstKnockout,
        }),
      );
    }
  } else if (rounds.length > 0 || games.length > 0) {
    lines.push("Straight knockout: win and you go through.");
  }

  if (rounds.includes("third_place")) {
    lines.push("Losing semi-finalists play off for third.");
  }

  return {
    teams: sportTeams.length,
    lines,
    rounds: rounds.filter((r) => r !== "third_place").map((r) => ROUND_LABEL[r]),
  };
}

/**
 * Who goes through, in a sentence: "Top 2 in each group, and the 4 best
 * third-placed teams, go through to the round of 16." Said of one group when
 * `group` names it, as a match or team page does.
 */
export function throughLine(
  rule: Qualification,
  {
    groups,
    groupSize,
    round,
    group,
  }: { groups: number; groupSize: number; round: FixtureStage | null; group?: string },
): string {
  const to = round ? ` to the ${ROUND_LABEL[round].toLowerCase()}` : "";

  if (rule.places >= groupSize && rule.bestThirds === 0) {
    return `Everyone goes through${to}; the table decides who plays whom.`;
  }

  const where = group ? ` in ${group}` : groups > 1 ? " in each group" : "";
  if (rule.bestThirds > 0) {
    return group
      ? `Top ${rule.places}${where} go through${to}. Third might too: the ` +
          `${rule.bestThirds} best third-placed teams across the groups join them.`
      : `Top ${rule.places}${where}, and the ${rule.bestThirds} best third-placed teams, ` +
          `go through${to}.`;
  }
  return `Top ${rule.places}${where} go through${to}.`;
}

/** The first knockout round a category's groups lead into. */
export function firstKnockoutRound(
  categoryId: string,
  fixtures: readonly Fixture[],
): FixtureStage | null {
  const played = (stage: FixtureStage) =>
    fixtures.some((f) => f.categoryId === categoryId && f.stage === stage);
  return ROUND_ORDER.find((stage) => stage !== "third_place" && played(stage)) ?? null;
}
