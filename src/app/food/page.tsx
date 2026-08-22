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

export default function FoodPage() {
  return (
    <Suspense
      fallback={
        <div className="mg-page mg-container">
          <h1 className="mg-page-title">Food &amp; Drink</h1>
          <p className="mg-muted">Loading vendors…</p>
        </div>
      }
    >
      <Food />
    </Suspense>
  );
}

async function Food() {
  const [vendors, venues] = await Promise.all([getVendors(), getVenues()]);
  return <FoodView vendors={vendors} venues={venues} />;
}
