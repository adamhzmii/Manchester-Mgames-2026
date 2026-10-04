import { byKickoff, type Fixture } from "@/lib/fixtures";
import { DEFAULT_PLACES, qualification } from "@/lib/slots";

/**
 * Group tables are computed here rather than in the database. The whole
 * tournament is a few dozen fixtures, so recomputing on render costs nothing
 * and there is one less thing to keep in sync when a coordinator corrects a
 * score mid-afternoon.
 */

/**
 * Points per win differ by sport: football runs 3-1-0, the court sports run
 * 2-1-0. Keyed by sport slug so adding a sport is a one-line change; anything
 * unlisted falls back to 3-1-0.
 */
const POINTS_RULES: Record<string, { win: number; draw: number }> = {
  football: { win: 3, draw: 1 },
  basketball: { win: 2, draw: 1 },
  netball: { win: 2, draw: 1 },
  volleyball: { win: 2, draw: 1 },
  frisbee: { win: 2, draw: 1 },
};

const DEFAULT_POINTS = { win: 3, draw: 1 };

export type StandingsRow = {
  position: number;
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scoreFor: number;
  scoreAgainst: number;
  scoreDifference: number;
  points: number;
  /** In a place that goes through, as things stand — drives the tick and the highlight. */
  qualifying: boolean;
  /** The group a row comes from, in a table drawn across groups (the third-placed teams). */
  group?: string;
};

export type StandingsGroup = {
  groupId: string;
  groupName: string;
  categoryId: string;
  rows: StandingsRow[];
  /** How many go through from this table: the line is drawn under that place. */
  places: number;
  /** How many of the groups' third-placed teams also go through, across all the groups. */
  bestThirds: number;
};

export type GroupMeta = {
  id: string;
  name: string;
  sortOrder: number;
  categoryId: string;
};

export type TeamMeta = {
  id: string;
  name: string;
  groupId: string | null;
};


/**
 * Strictly better on the tiebreaker chain — the same comparison the table sorts
 * by, minus the alphabetical fallback, which orders tied teams for display
 * without settling anything between them.
 *
 * `below` is undefined when a group holds no more teams than there are
 * qualifying places: nobody to be separated from, so the place is safe.
 */
function isAheadOf(
  row: { points: number; scoreDifference: number; scoreFor: number },
  below: { points: number; scoreDifference: number; scoreFor: number } | undefined,
): boolean {
  if (!below) return true;
  return (
    row.points !== below.points ||
    row.scoreDifference !== below.scoreDifference ||
    row.scoreFor !== below.scoreFor
  );
}

/** Points, then difference, then scored — the usual order. */
function byRanking(a: StandingsRow, b: StandingsRow): number {
  return (
    b.points - a.points ||
    b.scoreDifference - a.scoreDifference ||
    b.scoreFor - a.scoreFor ||
    // Alphabetical last so the table never jitters between renders on a dead tie.
    a.teamName.localeCompare(b.teamName)
  );
}

/**
 * Builds one table per group for a single sport.
 *
 * Only finished group-stage fixtures count. A live match is deliberately not
 * folded in early: a half-played score would reorder the table and then
 * reorder it back, which reads as a bug to anyone watching.
 *
 * How many go through comes from the knockout slots in `fixtures` (see
 * slots.ts), so pass the sport's knockout games along with its group games.
 */
export function computeStandings(
  fixtures: readonly Fixture[],
  groups: readonly GroupMeta[],
  teams: readonly TeamMeta[],
  sportSlug: string,
): StandingsGroup[] {
  const rules = POINTS_RULES[sportSlug] ?? DEFAULT_POINTS;

  const counted = fixtures.filter(
    (f) =>
      f.stage === "group" &&
      f.status === "finished" &&
      f.scoreA !== null &&
      f.scoreB !== null &&
      f.teamAId !== null &&
      f.teamBId !== null,
  );

  return [...groups]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
    .map((group) => {
      const { places, bestThirds } = qualification(group.categoryId, fixtures);
      const tallies = new Map<string, StandingsRow>();

      for (const team of teams) {
        if (team.groupId !== group.id) continue;
        tallies.set(team.id, {
          position: 0,
          teamId: team.id,
          teamName: team.name,
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          scoreFor: 0,
          scoreAgainst: 0,
          scoreDifference: 0,
          points: 0,
          qualifying: false,
        });
      }

      for (const fixture of counted) {
        if (fixture.groupId !== group.id) continue;
        const home = tallies.get(fixture.teamAId!);
        const away = tallies.get(fixture.teamBId!);
        if (!home || !away) continue;

        const scoreA = fixture.scoreA!;
        const scoreB = fixture.scoreB!;

        home.played += 1;
        away.played += 1;
        home.scoreFor += scoreA;
        home.scoreAgainst += scoreB;
        away.scoreFor += scoreB;
        away.scoreAgainst += scoreA;

        if (scoreA > scoreB) {
          home.won += 1;
          away.lost += 1;
          home.points += rules.win;
        } else if (scoreB > scoreA) {
          away.won += 1;
          home.lost += 1;
          away.points += rules.win;
        } else {
          home.drawn += 1;
          away.drawn += 1;
          home.points += rules.draw;
          away.points += rules.draw;
        }
      }

      const rows = [...tallies.values()]
        .map((row) => ({
          ...row,
          scoreDifference: row.scoreFor - row.scoreAgainst,
        }))
        .sort(byRanking)
        .map((row, index, sorted) => ({
          ...row,
          position: index + 1,
          // A place inside the cut is not the same as having earned it. Before
          // a group has been played every team is level, and the order above is
          // just alphabetical — marking the top two "Q" there would tell a team
          // it had qualified on the strength of its name. So a row only counts
          // as qualifying if it is strictly ahead of the first team below the
          // line; while that tie stands, qualification is genuinely undecided.
          qualifying: index < places && isAheadOf(row, sorted[places]),
        }));

      return {
        groupId: group.id,
        groupName: group.name,
        categoryId: group.categoryId,
        rows,
        places,
        bestThirds,
      };
    })
    .filter((group) => group.rows.length > 0);
}

/**
 * The teams finishing third in a category's groups, ranked against each
 * other, for a format where the best of them go through ("the four best
 * third-placed teams"). Ranked and ticked exactly like a group table, as
 * things stand. Null when the format has no such rule.
 */
export function thirdPlaceTable(tables: readonly StandingsGroup[]): StandingsGroup | null {
  const first = tables[0];
  if (!first || first.bestThirds === 0) return null;
  const places = first.bestThirds;

  const rows = rankThirds(tables).map((row, index, sorted) => ({
    ...row,
    qualifying: index < places && isAheadOf(row, sorted[places]),
  }));

  return {
    groupId: `${first.categoryId}-thirds`,
    groupName: "Third-placed teams",
    categoryId: first.categoryId,
    rows,
    places,
    bestThirds: 0,
  };
}

export type FormResult = "W" | "D" | "L";

/**
 * A team's results in kick-off order — the "form" column every football table
 * carries. Counts every finished game the team has played, knockouts
 * included, because that is the run a spectator is asking about.
 */
export function teamForm(fixtures: readonly Fixture[], teamId: string): FormResult[] {
  return fixtures
    .filter(
      (f) =>
        f.status === "finished" &&
        f.scoreA !== null &&
        f.scoreB !== null &&
        (f.teamAId === teamId || f.teamBId === teamId),
    )
    .sort(byKickoff)
    .map((f) => {
      const mine = f.teamAId === teamId ? f.scoreA! : f.scoreB!;
      const theirs = f.teamAId === teamId ? f.scoreB! : f.scoreA!;
      return mine > theirs ? "W" : mine < theirs ? "L" : "D";
    });
}

/** Points a win and a draw are worth in this sport, for explaining the table. */
export function pointsRule(sportSlug: string): { win: number; draw: number } {
  return POINTS_RULES[sportSlug] ?? DEFAULT_POINTS;
}

/** How many places in a group go through when the knockout slots do not say. */
export const QUALIFYING = DEFAULT_PLACES;

/**
 * Every group's third-placed team, best first, whatever the format says
 * about them — for reading "Best 3rd (2)" off a bracket that is still being
 * filled in, before every slot naming a third is in place.
 */
export function rankThirds(tables: readonly StandingsGroup[]): StandingsRow[] {
  const first = tables[0];
  if (!first) return [];
  return tables
    .filter((t) => t.categoryId === first.categoryId)
    .flatMap((t) => t.rows.filter((r) => r.position === 3).map((r) => ({ ...r, group: t.groupName })))
    .sort(byRanking)
    .map((row, index) => ({ ...row, position: index + 1 }));
}
