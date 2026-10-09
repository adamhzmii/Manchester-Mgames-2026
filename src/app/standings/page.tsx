import type { Metadata } from "next";

import { StandingsView, type StandingsTab } from "@/components/standings-view";
import { getFixtures, getSports, getStandingsData } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Standings",
  description:
    "MGames 2026 medal table, group tables and knockout brackets for every sport, updated as results come in.",
};

/** Live data — never prerendered or cached. */
export const dynamic = "force-dynamic";

const TABS: readonly StandingsTab[] = ["table", "bracket", "games"];

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function StandingsPage({ searchParams }: PageProps<"/standings">) {
  const [params, fixtures, sports, standings] = await Promise.all([
    searchParams,
    getFixtures(),
    getSports(),
    getStandingsData(),
  ]);

  // No sport in the link: the view opens on the one this phone last chose,
  // or the first sport.
  const asked = one(params.sport);
  const sport = asked && sports.some((s) => s.slug === asked) ? asked : null;
  const view = one(params.view);

  return (
    <StandingsView
      fixtures={fixtures}
      sports={sports}
      groups={standings.groups}
      standingTeams={standings.teams}
      initialSport={sport}
      initialTab={view && (TABS as readonly string[]).includes(view) ? (view as StandingsTab) : null}
      initialCategory={one(params.cat) ?? null}
    />
  );
}
