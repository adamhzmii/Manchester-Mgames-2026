import { byKickoff, type Fixture } from "@/lib/fixtures";
import { winningSide } from "@/lib/matchday";
import { DEFAULT_PLACES, qualification } from "@/lib/slots";

/**
 * Group tables are computed here rather than in the database. The whole
 * tournament is a few dozen fixtures, so recomputing on render costs nothing
 * and there is one less thing to keep in sync when a coordinator corrects a
 * score mid-afternoon.
 */

/**
 * Points for a win and a draw, by sport. The committee's 2026 fixture sheet
 * gives every sport 3 for a win, 1 for a draw and none for a loss; a sport
 * that ever needs its own goes here, keyed by slug. Anything unlisted gets
 * 3-1-0.
 */
const POINTS_RULES: Record<string, { win: number; draw: number }> = {};

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
  /** Group games forfeited, a double forfeit included (rulebook H.9.4). */
  forfeits: number;
  /**
   * Level with another team on every tie-break the site can apply: the Head
   * of Sport settles it (by drawing lots — or, in table tennis, by rally
   * points, which the site does not record). Shown together, alphabetically.
   */
  unresolved: boolean;
  /** Which dead tie, for naming the teams in it together; null when settled. */
  tie: number | null;
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
  /** Teams in this place go through too if they are among the best `count` across the groups. */
  best: { place: number; count: number } | null;
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


/** A finished group game, as the tie-breaks read it. */
type Result = {
  a: string;
  b: string;
  scoreA: number;
  scoreB: number;
  /** Who forfeited, if anyone: the game still gives its points, not its score. */
  forfeit: Fixture["forfeit"];
};

type Tally = { points: number; forfeits: number; scoreFor: number; scoreAgainst: number };

/**
 * Points and score from a set of results, for the teams given. A forfeit
 * gives its standings points (3 to the side that turned up, 0 to the side
 * that did not, 0 each for a double forfeit) but none of its score: the
 * rulebook leaves forfeited games out of every score-based measure (H.8).
 */
function tally(
  ids: readonly string[],
  results: readonly Result[],
  rules: { win: number; draw: number },
): Map<string, Tally> {
  const out = new Map(ids.map((id) => [id, { points: 0, forfeits: 0, scoreFor: 0, scoreAgainst: 0 }]));
  for (const r of results) {
    const a = out.get(r.a);
    const b = out.get(r.b);
    if (!a || !b) continue;
    if (r.forfeit) {
      if (r.forfeit !== "b") a.forfeits += 1;
      if (r.forfeit !== "a") b.forfeits += 1;
      if (r.forfeit === "a") b.points += rules.win;
      if (r.forfeit === "b") a.points += rules.win;
      continue;
    }
    a.scoreFor += r.scoreA;
    a.scoreAgainst += r.scoreB;
    b.scoreFor += r.scoreB;
    b.scoreAgainst += r.scoreA;
    if (r.scoreA > r.scoreB) a.points += rules.win;
    else if (r.scoreB > r.scoreA) b.points += rules.win;
    else {
      a.points += rules.draw;
      b.points += rules.draw;
    }
  }
  return out;
}

type Step = "headToHead" | "forfeits" | "miniDifference" | "miniScored" | "difference" | "scored";

/**
 * The rulebook's order for teams level on points (General Rules H.9). Table
 * tennis goes on to rally points after the head-to-head game difference,
 * which the site does not record, so a tie that far is left to the Head of
 * Sport rather than settled by a later measure out of order.
 */
function stepsFor(sportSlug: string): readonly Step[] {
  return sportSlug === "table-tennis"
    ? ["headToHead", "forfeits", "miniDifference"]
    : ["headToHead", "forfeits", "miniDifference", "miniScored", "difference", "scored"];
}

/**
 * Orders teams level on points, by H.9: the games between them first
 * (who won between two; a mini-table between three or more), then fewer
 * forfeits, then score difference and scored — between them, then across
 * the group. A step that separates some of them fixes those places; the rest
 * carry on from the next step, never restarting (H.9.7), and two still level
 * at any point are settled by their own game if it had a winner. Returns the
 * order as runs: a run of more than one is a tie the site cannot break.
 */
function breakTie(
  tied: readonly string[],
  step: number,
  steps: readonly Step[],
  results: readonly Result[],
  overall: ReadonlyMap<string, Tally>,
  rules: { win: number; draw: number },
): string[][] {
  if (tied.length === 1) return [[...tied]];

  const among = (ids: readonly string[]) =>
    tally(ids, results.filter((r) => ids.includes(r.a) && ids.includes(r.b)), rules);

  if (tied.length === 2 && step > 0) {
    const [x, y] = tied;
    const h2h = among(tied);
    const px = h2h.get(x)!.points;
    const py = h2h.get(y)!.points;
    if (px !== py) return px > py ? [[x], [y]] : [[y], [x]];
  }
  if (step >= steps.length) return [[...tied]];

  const mini = among(tied);
  const value = (id: string): number => {
    const m = mini.get(id)!;
    const o = overall.get(id)!;
    switch (steps[step]) {
      case "headToHead":
        return m.points;
      case "forfeits":
        return -o.forfeits;
      case "miniDifference":
        return m.scoreFor - m.scoreAgainst;
      case "miniScored":
        return m.scoreFor;
      case "difference":
        return o.scoreFor - o.scoreAgainst;
      case "scored":
        return o.scoreFor;
    }
  };

  const runs = new Map<number, string[]>();
  for (const id of tied) runs.set(value(id), [...(runs.get(value(id)) ?? []), id]);
  if (runs.size === 1) return breakTie(tied, step + 1, steps, results, overall, rules);
  return [...runs.entries()]
    .sort(([a], [b]) => b - a)
    .flatMap(([, ids]) => breakTie(ids, step + 1, steps, results, overall, rules));
}

/**
 * Positions from runs: one after another, a dead tie together in name order
 * so the table does not jitter. A place goes through only if it is clear of
 * any tie the cut runs through: before a group is played every team is
 * level, and the top two by name have not qualified.
 */
function placeRows<T extends { teamName: string; unresolved?: boolean }>(
  runs: readonly T[][],
  places: number,
): (T & { position: number; unresolved: boolean; tie: number | null; qualifying: boolean })[] {
  const out: (T & { position: number; unresolved: boolean; tie: number | null; qualifying: boolean })[] = [];
  for (const [index, run] of runs.entries()) {
    const start = out.length;
    const end = start + run.length; // exclusive
    const straddles = start < places && end > places;
    for (const row of [...run].sort((a, b) => a.teamName.localeCompare(b.teamName))) {
      // A row already unresolved in its own group (ranked across groups) is
      // not settled here either: which team holds that place is undecided.
      const unresolved = run.length > 1 || row.unresolved === true;
      out.push({
        ...row,
        position: out.length + 1,
        unresolved,
        tie: run.length > 1 ? index : null,
        qualifying: out.length < places && !straddles && !(row.unresolved === true),
      });
    }
  }
  return out;
}

/**
 * Builds one table per group for a single sport.
 *
 * Only finished group-stage fixtures count. A live match is deliberately not
 * folded in early: a half-played score would reorder the table and then
 * reorder it back, which reads as a bug to anyone watching.
 *
 * Order follows the rulebook (General Rules H.9): points, then the tie-breaks
 * in breakTie. Forfeited games give their points but none of their score.
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
  const steps = stepsFor(sportSlug);

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
      const { places, best } = qualification(group.categoryId, fixtures);
      const members = teams.filter((t) => t.groupId === group.id);
      const ids = members.map((t) => t.id);
      const results: Result[] = counted
        .filter((f) => f.groupId === group.id && ids.includes(f.teamAId!) && ids.includes(f.teamBId!))
        .map((f) => ({ a: f.teamAId!, b: f.teamBId!, scoreA: f.scoreA!, scoreB: f.scoreB!, forfeit: f.forfeit }));
      const overall = tally(ids, results, rules);

      const rows = new Map(
        members.map((team) => {
          const t = overall.get(team.id)!;
          const mine = results.filter((r) => r.a === team.id || r.b === team.id);
          const side = (r: Result) => (r.a === team.id ? "a" : "b");
          const won = mine.filter((r) =>
            r.forfeit ? r.forfeit !== "both" && r.forfeit !== side(r) : side(r) === "a" ? r.scoreA > r.scoreB : r.scoreB > r.scoreA,
          ).length;
          const drawn = mine.filter((r) => !r.forfeit && r.scoreA === r.scoreB).length;
          const row: Omit<StandingsRow, "position" | "unresolved" | "tie" | "qualifying"> = {
            teamId: team.id,
            teamName: team.name,
            played: mine.length,
            won,
            drawn,
            lost: mine.length - won - drawn,
            scoreFor: t.scoreFor,
            scoreAgainst: t.scoreAgainst,
            scoreDifference: t.scoreFor - t.scoreAgainst,
            points: t.points,
            forfeits: t.forfeits,
          };
          return [team.id, row] as const;
        }),
      );

      // Points first; each set of teams level on points through breakTie.
      const byPoints = new Map<number, string[]>();
      for (const id of ids) {
        const p = overall.get(id)!.points;
        byPoints.set(p, [...(byPoints.get(p) ?? []), id]);
      }
      const runs = [...byPoints.entries()]
        .sort(([a], [b]) => b - a)
        .flatMap(([, level]) => breakTie(level, 0, steps, results, overall, rules))
        .map((run) => run.map((id) => rows.get(id)!));

      return {
        groupId: group.id,
        groupName: group.name,
        categoryId: group.categoryId,
        rows: placeRows(runs, places),
        places,
        best,
      };
    })
    .filter((group) => group.rows.length > 0);
}

const PLACE_NAME: Record<number, string> = {
  2: "Runners-up",
  3: "Third-placed teams",
  4: "Fourth-placed teams",
};

/**
 * Teams from different groups never met, so they are compared on what their
 * groups give them: points, fewer forfeits, score difference, scored.
 */
function acrossGroups(a: StandingsRow, b: StandingsRow): number {
  return (
    b.points - a.points ||
    a.forfeits - b.forfeits ||
    b.scoreDifference - a.scoreDifference ||
    b.scoreFor - a.scoreFor
  );
}

/**
 * The teams finishing in a given place across a category's groups, ranked
 * against each other, for a format where the best of them go through — "the
 * four best third-placed teams", "the three best runners-up". Ranked and
 * ticked exactly like a group table, as things stand. Null when the format
 * has no such rule.
 */
export function bestPlaceTable(tables: readonly StandingsGroup[]): StandingsGroup | null {
  const first = tables[0];
  if (!first?.best) return null;
  const { place, count } = first.best;

  return {
    groupId: `${first.categoryId}-best-${place}`,
    groupName: PLACE_NAME[place] ?? `Teams finishing ${place}th`,
    categoryId: first.categoryId,
    rows: rankAcross(tables, place, count),
    places: count,
    best: null,
  };
}

/** A place's teams across the groups, in runs of teams that cannot be separated. */
function rankAcross(tables: readonly StandingsGroup[], place: number, count: number): StandingsRow[] {
  const first = tables[0];
  if (!first) return [];
  const sorted = tables
    .filter((t) => t.categoryId === first.categoryId)
    .flatMap((t) =>
      t.rows.filter((r) => r.position === place).map((r) => ({ ...r, group: t.groupName })),
    )
    .sort(acrossGroups);
  const runs: StandingsRow[][] = [];
  for (const row of sorted) {
    const last = runs.at(-1);
    if (last && acrossGroups(last[0], row) === 0) last.push(row);
    else runs.push([row]);
  }
  return placeRows(runs, count);
}

/**
 * Every group's team in a given place, best first, whatever the format says
 * about them — for reading "Best 3rd (2)" off a bracket that is still being
 * filled in, before every slot naming one is in place.
 */
export function rankPlace(tables: readonly StandingsGroup[], place: number): StandingsRow[] {
  return rankAcross(tables, place, 0);
}

/** How teams level on points are separated, in a sentence (rulebook H.9). */
export function tieBreakLine(sportSlug: string): string {
  return sportSlug === "table-tennis"
    ? "Level on points: results between the teams decide, then fewer forfeits, then game difference between them. Still level? The Head of Sport decides on rally points."
    : "Level on points: results between the teams decide, then fewer forfeits, then score difference and total score — between them first, then across the group.";
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
      // Through winningSide, so a knockout won on penalties is a W, not a D.
      // A double forfeit is a loss for both.
      if (f.forfeit === "both") return "L";
      const side = winningSide(f);
      if (side === null) return "D";
      return side === (f.teamAId === teamId ? "a" : "b") ? "W" : "L";
    });
}

/** Points a win and a draw are worth in this sport, for explaining the table. */
/**
 * Sports whose group games always produce a winner (rulebook: table tennis
 * and pickleball have no draws). A level score there can't be a result.
 */
const NO_DRAWS = new Set(["table-tennis", "pickleball"]);

export function allowsDraws(sportSlug: string): boolean {
  return !NO_DRAWS.has(sportSlug);
}

/** "3 points for a win, 1 for a draw." — or no draw, where there are none. */
export function pointsLine(sportSlug: string): string {
  const rule = pointsRule(sportSlug);
  return allowsDraws(sportSlug)
    ? `${rule.win} points for a win, ${rule.draw} for a draw.`
    : `${rule.win} points for a win. No draws.`;
}

export function pointsRule(sportSlug: string): { win: number; draw: number } {
  return POINTS_RULES[sportSlug] ?? DEFAULT_POINTS;
}

/** How many places in a group go through when the knockout slots do not say. */
export const QUALIFYING = DEFAULT_PLACES;
