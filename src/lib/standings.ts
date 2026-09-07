import type { Fixture } from "@/lib/fixtures";

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
  /** Top two of each group go through — drives the highlight and the "Q" tag. */
  qualifying: boolean;
};

export type StandingsGroup = {
  groupId: string;
  groupName: string;
  rows: StandingsRow[];
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

const QUALIFYING_PLACES = 2;

/**
 * Builds one table per group for a single sport.
 *
 * Only finished group-stage fixtures count. A live match is deliberately not
 * folded in early: a half-played score would reorder the table and then
 * reorder it back, which reads as a bug to anyone watching.
 */
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
        // Points, then difference, then scored — the usual order. Alphabetical
        // last so the table never jitters between renders on a dead tie.
        .sort(
          (a, b) =>
            b.points - a.points ||
            b.scoreDifference - a.scoreDifference ||
            b.scoreFor - a.scoreFor ||
            a.teamName.localeCompare(b.teamName),
        )
        .map((row, index, sorted) => ({
          ...row,
          position: index + 1,
          // A place inside the cut is not the same as having earned it. Before
          // a group has been played every team is level, and the order above is
          // just alphabetical — marking the top two "Q" there would tell a team
          // it had qualified on the strength of its name. So a row only counts
          // as qualifying if it is strictly ahead of the first team below the
          // line; while that tie stands, qualification is genuinely undecided.
          qualifying: index < QUALIFYING_PLACES && isAheadOf(row, sorted[QUALIFYING_PLACES]),
        }));

      return { groupId: group.id, groupName: group.name, rows };
    })
    .filter((group) => group.rows.length > 0);
}
