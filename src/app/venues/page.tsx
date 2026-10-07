import type { Metadata } from "next";

import { VenuesView } from "@/components/venues-view";
import { getFixtures, getVendors, getVenues } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Venues",
  description:
    "Trinity, Sugden and Denmark Road for MGames 2026 — what's on each court, food stalls, first aid, prayer rooms, and getting between them.",
};

/** Live data — never prerendered or cached. */
export const dynamic = "force-dynamic";

export default async function VenuesPage({ searchParams }: PageProps<"/venues">) {
  const [params, venues, vendors, fixtures] = await Promise.all([
    searchParams,
    getVenues(),
    getVendors(),
    getFixtures(),
  ]);

  // ?v= from venue links; ?venue= kept for links from the first version.
  const raw = params.v ?? params.venue;
  const asked = Array.isArray(raw) ? raw[0] : raw;
  const initialVenue =
    asked && venues.some((v) => v.slug === asked) ? asked : (venues[0]?.slug ?? "");

  return (
    <VenuesView
      venues={venues}
      vendors={vendors}
      fixtures={fixtures}
      initialVenue={initialVenue}
    />
  );
}
