import type { Metadata } from "next";
import { Suspense } from "react";

import { FoodView } from "@/components/food-view";
import { getVendors, getVenues } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Food & Drink",
  description: "Every food and drink stall at MGames 2026, with menus and prices.",
};

/**
 * Live data — never prerendered or cached. Scores and announcements change
 * during the event, and a stale page is worse than a slower one.
 */
export const dynamic = "force-dynamic";

export default function FoodPage({ searchParams }: PageProps<"/food">) {
  return (
    <Suspense
      fallback={
        <div className="mg-page mg-container">
          <h1 className="mg-page-title">Food &amp; Drink</h1>
          <p className="mg-muted">Loading vendors…</p>
        </div>
      }
    >
      <Food searchParams={searchParams} />
    </Suspense>
  );
}

async function Food({ searchParams }: { searchParams: PageProps<"/food">["searchParams"] }) {
  const [params, vendors, venues] = await Promise.all([searchParams, getVendors(), getVenues()]);
  const asked = Array.isArray(params.venue) ? params.venue[0] : params.venue;
  const initialVenue = asked && venues.some((v) => v.slug === asked) ? asked : "all";
  return <FoodView vendors={vendors} venues={venues} initialVenue={initialVenue} />;
}
