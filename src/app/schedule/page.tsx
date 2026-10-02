import type { Metadata } from "next";

import { ScheduleView, type ScheduleFilters } from "@/components/schedule-view";
import { getCoordinator, getFixtures, getSports, getTeams, getVenues } from "@/lib/queries";

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
  const [params, fixtures, sports, venues, teams, coordinator] = await Promise.all([
    searchParams,
    getFixtures(),
    getSports(),
    getVenues(),
    getTeams(),
    getCoordinator(),
  ]);

  // Read here rather than from useSearchParams in the browser, so the server
  // renders the filtered list a shared link asked for and hydration agrees.
  const sport = one(params.sport);
  const venue = one(params.venue);
  const initialFilters: ScheduleFilters = {
    sport: sport && sports.some((s) => s.slug === sport) ? sport : "all",
    venue: venue && venues.some((v) => v.slug === venue) ? venue : "all",
    mine: one(params.mine) === "1",
    live: one(params.live) === "1",
  };

  return (
    <ScheduleView
      fixtures={fixtures}
      sports={sports}
      venues={venues}
      teams={teams}
      coordinator={coordinator}
      initialFilters={initialFilters}
    />
  );
}
