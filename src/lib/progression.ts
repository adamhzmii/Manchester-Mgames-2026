import type { Fixture } from "@/lib/fixtures";
import { computeStandings, type GroupMeta, type TeamMeta } from "@/lib/standings";

/**
 * Works out who a knockout placeholder refers to, from results already in.
 *
 * Knockout slots are labelled ("Group A winner", "Winner SF1") rather than
 * linked to the games that feed them, so on the day a coordinator fills each
 * slot by hand. This reads the label the way they would and proposes the
 * team, so filling a semi-final is one tap rather than a scan down a list —
 * the coordinator still confirms it, because they are the one watching.
 *
 * Returns null while the feeder is undecided: a group with games still to
 * play, or a semi-final not yet finished.
 */
export type SlotTeam = { id: string; name: string };

const GROUP_SLOT = /^Group ([A-Z]) (winner|runner-up|1st|2nd|3rd|4th)$/i;
const POSITION: Record<string, number> = {
  winner: 0,
  "1st": 0,
  "runner-up": 1,
  "2nd": 1,
  "3rd": 2,
  "4th": 3,
};
const SEMI_SLOT = /^(Winner|Loser) SF([12])$/i;

export function winnerOf(f: Fixture): SlotTeam | null {
  if (f.status !== "finished" || f.scoreA === null || f.scoreB === null) return null;
  if (f.teamAId === null || f.teamBId === null || f.scoreA === f.scoreB) return null;
  return f.scoreA > f.scoreB ? { id: f.teamAId, name: f.teamA } : { id: f.teamBId, name: f.teamB };
}

export function loserOf(f: Fixture): SlotTeam | null {
  const winner = winnerOf(f);
  if (!winner) return null;
  return winner.id === f.teamAId
    ? { id: f.teamBId!, name: f.teamB }
    : { id: f.teamAId!, name: f.teamA };
}

export function resolveSlot(
  label: string,
  fixture: Fixture,
  fixtures: readonly Fixture[],
  groups: readonly (GroupMeta & { sportSlug: string })[],
  teams: readonly (TeamMeta & { sportSlug: string })[],
): SlotTeam | null {
  const group = GROUP_SLOT.exec(label);
  if (group) {
    const [, letter, place] = group;
    const meta = groups.find(
      (g) => g.categoryId === fixture.categoryId && g.name.toLowerCase() === `group ${letter.toLowerCase()}`,
    );
    if (!meta) return null;
    const games = fixtures.filter((f) => f.groupId === meta.id);
    if (games.length === 0 || games.some((f) => f.status !== "finished")) return null;
    const [table] = computeStandings(
      games,
      [meta],
      teams.filter((t) => t.sportSlug === fixture.sportSlug),
      fixture.sportSlug,
    );
    const row = table?.rows[POSITION[place.toLowerCase()]];
    return row ? { id: row.teamId, name: row.teamName } : null;
  }

  const semi = SEMI_SLOT.exec(label);
  if (semi) {
    const [, outcome, number] = semi;
    const feeder = semiFinals(fixture.categoryId, fixtures)[Number(number) - 1];
    if (!feeder) return null;
    return outcome.toLowerCase() === "winner" ? winnerOf(feeder) : loserOf(feeder);
  }

  return null;
}

/** A category's semi-finals in kick-off order: index 0 is SF1. */
export function semiFinals(categoryId: string, fixtures: readonly Fixture[]): Fixture[] {
  return fixtures
    .filter((f) => f.categoryId === categoryId && f.stage === "semifinal")
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}
