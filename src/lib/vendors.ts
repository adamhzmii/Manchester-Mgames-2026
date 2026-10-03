import type { Vendor } from "@/lib/queries";

/**
 * Small, client-safe helpers for showing a stall: the price it starts from
 * and where its buttons go.
 */

/** The cheapest thing on the menu, in pence — "from £2.50" sells. */
export function fromPrice(vendor: Pick<Vendor, "menu">): number | null {
  let min: number | null = null;
  for (const item of vendor.menu) {
    if (min === null || item.pricePence < min) min = item.pricePence;
  }
  return min;
}

/** Walking directions to the stall itself if it is pinned, else to its venue. */
export function stallDirections(
  vendor: Pick<Vendor, "latitude" | "longitude">,
  venue?: { latitude: number | null; longitude: number | null },
): string | null {
  const lat = vendor.latitude ?? venue?.latitude ?? null;
  const lng = vendor.longitude ?? venue?.longitude ?? null;
  if (lat === null || lng === null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=walking`;
}

export function instagramHref(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}
