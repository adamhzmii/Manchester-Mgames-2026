import type { FixtureStage, FixtureStatus } from "@/lib/supabase/types";

/**
 * The column list every fixture query shares. `fixtures` has two foreign keys
 * into `teams`, so PostgREST needs the constraint name to tell the sides
 * apart — hence the `!fixtures_team_a_id_fkey` hints.
 */
export const FIXTURE_SELECT = `
  id,
  stage,
  status,
  score_a,
  score_b,
  scheduled_time,
  updated_at,
  placeholder_a,
  placeholder_b,
  group_id,
  team_a:teams!fixtures_team_a_id_fkey ( id, name ),
  team_b:teams!fixtures_team_b_id_fkey ( id, name ),
  category:categories ( id, name, slug, sport:sports ( id, slug, name, code, color, sort_order ) ),
  court:courts ( id, name, venue:venues ( id, slug, name, short_name ) )
` as const;

/** Shape PostgREST returns for the select above. */
export type FixtureRow = {
  id: string;
  stage: FixtureStage;
  status: FixtureStatus;
  score_a: number | null;
  score_b: number | null;
  scheduled_time: string;
  updated_at: string;
  placeholder_a: string | null;
  placeholder_b: string | null;
  group_id: string | null;
  team_a: { id: string; name: string } | null;
  team_b: { id: string; name: string } | null;
  category: {
    id: string;
    name: string;
    slug: string;
    sport: {
      id: string;
      slug: string;
      name: string;
      code: string;
      color: string;
      sort_order: number;
    } | null;
  } | null;
  court: {
    id: string;
    name: string;
    venue: { id: string; slug: string; name: string; short_name: string } | null;
  } | null;
};

/** Flattened fixture, ready to render. Serialisable — crosses to Client Components. */
export type Fixture = {
  id: string;
  stage: FixtureStage;
  stageLabel: string;
  status: FixtureStatus;
  scheduledTime: string;
  /**
   * When the row last changed. Two copies of the same fixture can reach a
   * client — one from a server render, one from the cached poll — and this is
   * how it decides which is newer. See useLiveFixtures.
   */
  updatedAt: string;
  scoreA: number | null;
  scoreB: number | null;
  /** null for a knockout slot whose feeder match has not finished. */
  teamAId: string | null;
  teamBId: string | null;
  teamA: string;
  teamB: string;
  groupId: string | null;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  sportId: string;
  sportSlug: string;
  sportName: string;
  sportCode: string;
  sportColor: string;
  sportOrder: number;
  courtName: string;
  venueSlug: string;
  venueShortName: string;
};

const STAGE_LABELS: Record<FixtureStage, string> = {
  group: "Group",
  playoff: "Play-off",
  quarterfinal: "Quarter-final",
  semifinal: "Semi-final",
  third_place: "3rd place",
  final: "Final",
};

export function stageLabel(stage: FixtureStage): string {
  return STAGE_LABELS[stage];
}

/** Groups the stage filter chips offer, and which stages each one covers. */
export const STAGE_FILTERS = [
  { value: "all", label: "All stages", stages: null },
  { value: "group", label: "Group", stages: ["group"] },
  { value: "quarters", label: "Quarters", stages: ["quarterfinal"] },
  { value: "semis", label: "Semis", stages: ["semifinal"] },
  { value: "finals", label: "Finals", stages: ["final", "third_place", "playoff"] },
] as const satisfies ReadonlyArray<{
  value: string;
  label: string;
  stages: readonly FixtureStage[] | null;
}>;

export type StageFilter = (typeof STAGE_FILTERS)[number]["value"];

/** Narrows a chip's string value back to the filter union. */
export function isStageFilter(value: string): value is StageFilter {
  return STAGE_FILTERS.some((s) => s.value === value);
}

export function toFixture(row: FixtureRow): Fixture {
  const sport = row.category?.sport;
  return {
    id: row.id,
    stage: row.stage,
    stageLabel: stageLabel(row.stage),
    status: row.status,
    scheduledTime: row.scheduled_time,
    updatedAt: row.updated_at,
    scoreA: row.score_a,
    scoreB: row.score_b,
    teamAId: row.team_a?.id ?? null,
    teamBId: row.team_b?.id ?? null,
    // A fixture always shows two sides; before a feeder result lands that is
    // the placeholder label the bracket was built with.
    teamA: row.team_a?.name ?? row.placeholder_a ?? "TBC",
    teamB: row.team_b?.name ?? row.placeholder_b ?? "TBC",
    groupId: row.group_id,
    categoryId: row.category?.id ?? "",
    categoryName: row.category?.name ?? "",
    categorySlug: row.category?.slug ?? "",
    sportId: sport?.id ?? "",
    sportSlug: sport?.slug ?? "",
    sportName: sport?.name ?? "",
    sportCode: sport?.code ?? "??",
    sportColor: sport?.color ?? "#3C2A6E",
    sportOrder: sport?.sort_order ?? 0,
    courtName: row.court?.name ?? "TBC",
    venueSlug: row.court?.venue?.slug ?? "",
    venueShortName: row.court?.venue?.short_name ?? "TBC",
  };
}

/** Live first, then what's coming up, then what's done — each by kick-off. */
const STATUS_ORDER: Record<FixtureStatus, number> = {
  live: 0,
  upcoming: 1,
  finished: 2,
};

export function byRelevance(a: Fixture, b: Fixture): number {
  const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
  if (byStatus !== 0) return byStatus;
  return a.scheduledTime.localeCompare(b.scheduledTime);
}

export type FixtureFilters = {
  sport: string;
  venue: string;
  stage: StageFilter;
  /** Team ids from localStorage; empty means the toggle is off. */
  favouriteTeamIds?: readonly string[];
};

export function filterFixtures(
  fixtures: readonly Fixture[],
  filters: FixtureFilters,
): Fixture[] {
  const stageDef = STAGE_FILTERS.find((s) => s.value === filters.stage);
  const stages: readonly FixtureStage[] | null = stageDef?.stages ?? null;
  const favourites = filters.favouriteTeamIds;

  return fixtures.filter((f) => {
    if (filters.sport !== "all" && f.sportSlug !== filters.sport) return false;
    if (filters.venue !== "all" && f.venueSlug !== filters.venue) return false;
    if (stages && !stages.includes(f.stage)) return false;
    if (favourites && favourites.length > 0) {
      const mine =
        (f.teamAId !== null && favourites.includes(f.teamAId)) ||
        (f.teamBId !== null && favourites.includes(f.teamBId));
      if (!mine) return false;
    }
    return true;
  });
}
