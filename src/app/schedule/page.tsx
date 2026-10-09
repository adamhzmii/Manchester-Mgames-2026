import type { Metadata } from "next";

import { ScheduleView, type ScheduleFilters } from "@/components/schedule-view";
import { getCoordinator, getFixtures, getSports, getTeams } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Schedule",
  description:
    "Every MGames 2026 game, hour by hour — live scores, results, courts, and your own team's games.",
};

/** Live data — never prerendered or cached. */
export const dynamic = "force-dynamic";

function one(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function SchedulePage({ searchParams }: PageProps<"/schedule">) {
  // One await for all of them: they are independent, and serialising them
  // would stack round trips before anything renders.
  const [params, fixtures, sports, teams, coordinator] = await Promise.all([
    searchParams,
    getFixtures(),
    getSports(),
    getTeams(),
    getCoordinator(),
  ]);

  // Read here rather than from useSearchParams in the browser, so the server
  // renders the filtered list a shared link asked for and hydration agrees.
  // No sport in the link: the view opens on the one this phone last chose,
  // or the first sport.
  const sport = one(params.sport);
  const initialFilters: ScheduleFilters = {
    sport: sport && sports.some((s) => s.slug === sport) ? sport : null,
    category: one(params.cat) ?? null,
    court: one(params.court) ?? null,
    mine: one(params.mine) === "1",
    live: one(params.live) === "1",
  };

  return (
    <ScheduleView
      fixtures={fixtures}
      sports={sports}
      teams={teams}
      coordinator={coordinator}
      initialFilters={initialFilters}
    />
  );
}
