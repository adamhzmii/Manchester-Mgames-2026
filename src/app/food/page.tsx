import type { Metadata } from "next";

import { FoodView } from "@/components/food-view";
import { getVendors, getVenues } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Food & drink",
  description:
    "Every food and drink stall at MGames 2026 — what they serve, what it costs, and where to find them at Trinity and Sugden.",
};

/** Live data — never prerendered or cached. */
export const dynamic = "force-dynamic";

export default async function FoodPage({ searchParams }: PageProps<"/food">) {
  const [params, vendors, venues] = await Promise.all([searchParams, getVendors(), getVenues()]);
  const asked = Array.isArray(params.venue) ? params.venue[0] : params.venue;
  const initialVenue = asked && venues.some((v) => v.slug === asked) ? asked : "all";
  return <FoodView vendors={vendors} venues={venues} initialVenue={initialVenue} />;
}
