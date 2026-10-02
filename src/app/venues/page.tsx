import type { Metadata } from "next";
import { Suspense } from "react";

import { MapView } from "@/components/map-view";
import { getCourts, getVendors, getVenues } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Venue Map",
  description:
    "What is where at Trinity and Sugden for MGames 2026 — courts, halls, food stalls and travel between the two venues.",
};

/**
 * Live data — never prerendered or cached. Scores and announcements change
 * during the event, and a stale page is worse than a slower one.
 */
export const dynamic = "force-dynamic";

export default function MapPage(props: PageProps<"/venues">) {
  return (
    <Suspense
      fallback={
        <div className="mg-page mg-container">
          <h1 className="mg-page-title">Venue Map</h1>
          <p className="mg-muted">Loading venues…</p>
        </div>
      }
    >
      <VenueMap searchParams={props.searchParams} />
    </Suspense>
  );
}

async function VenueMap({
  searchParams,
}: {
  searchParams: PageProps<"/venues">["searchParams"];
}) {
  const [{ venue }, venues, courts, vendors] = await Promise.all([
    searchParams,
    getVenues(),
    getCourts(),
    getVendors(),
  ]);

  return (
    <MapView
      venues={venues}
      courts={courts}
      vendors={vendors}
      initialVenue={typeof venue === "string" ? venue : undefined}
    />
  );
}
