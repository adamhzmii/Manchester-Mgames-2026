import type { Metadata } from "next";
import { Suspense } from "react";

import { ScheduleView } from "@/components/schedule-view";
import { getFixtures, getIsCoordinator, getSports, getTeams, getVenues } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Schedule",
  description:
    "Every MGames 2026 fixture, filterable by sport, venue and stage — with live scores and your followed teams.",
};

/**
 * Live data — never prerendered or cached. Scores and announcements change
 * during the event, and a stale page is worse than a slower one.
 */
export const dynamic = "force-dynamic";

export default function SchedulePage() {
  return (
    <Suspense fallback={<ScheduleSkeleton />}>
      <Schedule />
    </Suspense>
  );
}

async function Schedule() {
  // One await for all five: they are independent, and serialising them would
  // stack five round trips before anything renders.
  const [fixtures, sports, venues, teams, canEdit] = await Promise.all([
    getFixtures(),
    getSports(),
    getVenues(),
    getTeams(),
    getIsCoordinator(),
  ]);

  return (
    <ScheduleView
      fixtures={fixtures}
      sports={sports}
      venues={venues}
      teams={teams}
      canEdit={canEdit}
    />
  );
}

function ScheduleSkeleton() {
  return (
    <div className="mg-page mg-container">
      <h1 className="mg-page-title">Schedule</h1>
      <p className="mg-muted">Loading fixtures…</p>
    </div>
  );
}
