import type { Metadata } from "next";
import { Suspense } from "react";

import { ScoresView } from "@/components/scores-view";
import { getFixtures, getSports, getStandingsData } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Scores & Standings",
  description:
    "Live MGames 2026 group tables and knockout brackets for every sport, updated as results come in.",
};

/**
 * Live data — never prerendered or cached. Scores and announcements change
 * during the event, and a stale page is worse than a slower one.
 */
export const dynamic = "force-dynamic";

export default function ScoresPage() {
  return (
    <Suspense fallback={<ScoresSkeleton />}>
      <Scores />
    </Suspense>
  );
}

async function Scores() {
  const [fixtures, sports, standingsData] = await Promise.all([
    getFixtures(),
    getSports(),
    getStandingsData(),
  ]);

  return (
    <ScoresView
      fixtures={fixtures}
      sports={sports}
      groups={standingsData.groups}
      teams={standingsData.teams}
    />
  );
}

function ScoresSkeleton() {
  return (
    <div className="mg-page mg-container">
      <h1 className="mg-page-title">Scores &amp; Standings</h1>
      <p className="mg-muted">Loading results…</p>
    </div>
  );
}
