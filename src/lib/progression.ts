import type { Fixture } from "@/lib/fixtures";
import { feederGame, parseSlot, roundGames } from "@/lib/slots";
import { computeStandings, rankThirds, type GroupMeta, type TeamMeta } from "@/lib/standings";
import type { FixtureStage } from "@/lib/supabase/types";

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
 * play, or a semi-final not yet finished. The label grammar is in slots.ts.
 */
export type SlotTeam = { id: string; name: string };

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
  const ref = parseSlot(label);
  if (!ref) return null;

  const categoryGroups = groups.filter((g) => g.categoryId === fixture.categoryId);
  const sportTeams = teams.filter((t) => t.sportSlug === fixture.sportSlug);
  const finished = (groupIds: string[]) => {
    const games = fixtures.filter((f) => f.groupId !== null && groupIds.includes(f.groupId));
    return games.length > 0 && games.every((f) => f.status === "finished");
  };

  if (ref.kind === "group") {
    const meta = categoryGroups.find((g) => g.name.toLowerCase() === `group ${ref.group.toLowerCase()}`);
    if (!meta || !finished([meta.id])) return null;
    const [table] = computeStandings(fixtures, [meta], sportTeams, fixture.sportSlug);
    const row = table?.rows[ref.place - 1];
    return row ? { id: row.teamId, name: row.teamName } : null;
  }

  if (ref.kind === "best-third") {
    // Every group has to be done: one game anywhere can reorder the thirds.
    if (!finished(categoryGroups.map((g) => g.id))) return null;
    const thirds = rankThirds(
      computeStandings(fixtures, categoryGroups, sportTeams, fixture.sportSlug),
    );
    const row = thirds[ref.rank - 1];
    return row ? { id: row.teamId, name: row.teamName } : null;
  }

  const feeder = feederGame(label, fixture.categoryId, fixtures);
  if (!feeder) return null;
  return feeder.outcome === "winner" ? winnerOf(feeder.game) : loserOf(feeder.game);
}

/** A category's semi-finals in the order they are numbered: index 0 is SF1. */
export function semiFinals(categoryId: string, fixtures: readonly Fixture[]): Fixture[] {
  return roundGames(categoryId, "semifinal", fixtures);
}

/**
 * Where a knockout game sends its winner and its loser: the games whose
 * slots name it ("Winner QF2", "Loser SF1").
 */
export function nextGames(
  fixture: Fixture,
  fixtures: readonly Fixture[],
): { winner: Fixture | null; loser: Fixture | null } {
  const result: { winner: Fixture | null; loser: Fixture | null } = { winner: null, loser: null };
  for (const f of fixtures) {
    if (f.categoryId !== fixture.categoryId || f.id === fixture.id) continue;
    for (const label of [f.slotA, f.slotB]) {
      const feeder = feederGame(label, f.categoryId, fixtures);
      if (feeder?.game.id === fixture.id) result[feeder.outcome] ??= f;
    }
  }
  return result;
}

/**
 * Knockout rounds arranged the way a bracket is drawn: the two games feeding
 * a game sit next to each other, the upper feeding its top slot.
 *
 * Kick-off order is not that order once two pitches run side by side —
 * 2025's quarter-final 1 took the winners of round-of-16 games 1 and 7 — so
 * each round is ordered from the slots of the round after it, working back
 * from the final. Games no slot names keep their kick-off order, at the end.
 */
export function bracketOrder(
  rounds: readonly { stage: FixtureStage; matches: readonly Fixture[] }[],
  fixtures: readonly Fixture[],
): { stage: FixtureStage; matches: Fixture[] }[] {
  const ordered = rounds.map((round) => ({ stage: round.stage, matches: [...round.matches] }));

  for (let i = ordered.length - 2; i >= 0; i -= 1) {
    const round = ordered[i];
    const placed: Fixture[] = [];
    for (const next of ordered[i + 1].matches) {
      for (const label of [next.slotA, next.slotB]) {
        const feeder = feederGame(label, next.categoryId, fixtures);
        if (feeder?.outcome !== "winner") continue;
        const game = round.matches.find((m) => m.id === feeder.game.id);
        if (game && !placed.includes(game)) placed.push(game);
      }
    }
    round.matches = [...placed, ...round.matches.filter((m) => !placed.includes(m))];
  }

  return ordered;
}
