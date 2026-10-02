import type { Metadata } from "next";

import { StandingsView, type StandingsTab } from "@/components/standings-view";
import { podiums } from "@/lib/medals";
import { getFixtures, getSports, getStandingsData, getTeams } from "@/lib/queries";

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
  const [params, fixtures, sports, standings, teams] = await Promise.all([
    searchParams,
    getFixtures(),
    getSports(),
    getStandingsData(),
    getTeams(),
  ]);

  // Opens on the medal table once there is one to show; before that, on the
  // first sport, which is what people come here to look at.
  const asked = one(params.sport);
  const fallback = podiums(fixtures).length > 0 ? "overall" : (sports[0]?.slug ?? "overall");
  const sport =
    asked === "overall" || (asked && sports.some((s) => s.slug === asked)) ? asked : fallback;
  const view = one(params.view);

  return (
    <StandingsView
      fixtures={fixtures}
      sports={sports}
      teams={teams}
      groups={standings.groups}
      standingTeams={standings.teams}
      initialSport={sport}
      initialTab={view && (TABS as readonly string[]).includes(view) ? (view as StandingsTab) : null}
    />
  );
}
