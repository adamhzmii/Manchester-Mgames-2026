import type { Fixture } from "@/lib/fixtures";
import { winningSide } from "@/lib/matchday";

/**
 * Champions and the medal table, derived only from what the results decide.
 *
 *   gold   — winner of the final
 *   silver — loser of the final
 *   bronze — winner of the third-place play-off, where one is played
 *
 * Sports without a third-place game award no bronze rather than one invented
 * here: whether two losing semi-finalists share it is the committee's call,
 * and a medal table that guessed would be wrong in public.
 */

export type Medallist = { teamId: string; name: string };

export type Podium = {
  categoryId: string;
  /** "Football", or "Pickleball · Women's Doubles" where a sport splits. */
  title: string;
  sportSlug: string;
  sportCode: string;
  sportColor: string;
  final: Fixture;
  gold: Medallist;
  silver: Medallist;
  bronze: Medallist | null;
};

function sides(f: Fixture): { won: Medallist; lost: Medallist } | null {
  const side = winningSide(f);
  if (side === null || f.teamAId === null || f.teamBId === null) return null;
  const a = { teamId: f.teamAId, name: f.teamA };
  const b = { teamId: f.teamBId, name: f.teamB };
  return side === "a" ? { won: a, lost: b } : { won: b, lost: a };
}

/** One podium per category whose final has been played. */
export function podiums(fixtures: readonly Fixture[]): Podium[] {
  const result: Podium[] = [];

  for (const final of fixtures.filter((f) => f.stage === "final")) {
    const decided = sides(final);
    if (!decided) continue;

    const third = fixtures.find(
      (f) => f.stage === "third_place" && f.categoryId === final.categoryId,
    );
    const bronze = third ? (sides(third)?.won ?? null) : null;

    result.push({
      categoryId: final.categoryId,
      title:
        final.categoryName && final.categoryName !== "Open"
          ? `${final.sportName} · ${final.categoryName}`
          : final.sportName,
      sportSlug: final.sportSlug,
      sportCode: final.sportCode,
      sportColor: final.sportColor,
      final,
      gold: decided.won,
      silver: decided.lost,
      bronze,
    });
  }

  return result.sort(
    (a, b) => a.final.sportOrder - b.final.sportOrder || a.title.localeCompare(b.title),
  );
}

export type MedalRow = {
  /** The team, by name. */
  name: string;
  gold: number;
  silver: number;
  bronze: number;
  total: number;
};

/**
 * Medals by team, ranked the Olympic way: golds first, then silvers, then
 * bronzes.
 *
 * Counted by team name rather than by university. Teams are not reliably one
 * university — some squads mix players from several — so a university table
 * would credit medals to institutions that did not win them. A contingent
 * that keeps its name across sports (the same "Melaka Mariners" in netball and
 * volleyball) still adds up, because the name is the same.
 */
export function medalTable(list: readonly Podium[]): MedalRow[] {
  const rows = new Map<string, MedalRow>();
  const add = (medallist: Medallist | null, kind: "gold" | "silver" | "bronze") => {
    if (!medallist) return;
    const row = rows.get(medallist.name) ?? {
      name: medallist.name,
      gold: 0,
      silver: 0,
      bronze: 0,
      total: 0,
    };
    row[kind] += 1;
    row.total += 1;
    rows.set(medallist.name, row);
  };

  for (const podium of list) {
    add(podium.gold, "gold");
    add(podium.silver, "silver");
    add(podium.bronze, "bronze");
  }

  return [...rows.values()].sort(
    (a, b) =>
      b.gold - a.gold || b.silver - a.silver || b.bronze - a.bronze || a.name.localeCompare(b.name),
  );
}
