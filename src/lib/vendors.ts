import type { Vendor } from "@/lib/queries";

/**
 * Small, client-safe helpers for showing a stall: the price it starts from
 * and where its buttons go.
 */

/**
 * The cheapest thing on the menu, in pence — "from £2.50" sells. Items without
 * a price do not count; a menu with none has no "from".
 */
export function fromPrice(vendor: Pick<Vendor, "menu">): number | null {
  let min: number | null = null;
  for (const item of vendor.menu) {
    if (item.pricePence === null) continue;
    if (min === null || item.pricePence < min) min = item.pricePence;
  }
  return min;
}

export function instagramHref(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(handle)}`;
}
