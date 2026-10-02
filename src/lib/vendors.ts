import type { Vendor } from "@/lib/queries";

/**
 * Small, client-safe helpers for showing a stall: the price it starts from,
 * the monogram on its card, and where its buttons go.
 */

/** The cheapest thing on the menu, in pence — "from £2.50" sells. */
export function fromPrice(vendor: Pick<Vendor, "menu">): number | null {
  let min: number | null = null;
  for (const item of vendor.menu) {
    if (min === null || item.pricePence < min) min = item.pricePence;
  }
  return min;
}

/** "Nasi Lemak Corner" → "NL"; "Boba Lab" → "BL"; "Sweet Kuih Co." → "SK". */
export function monogram(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .split(/\s+/)
    .filter((w) => w.length > 0 && !/^(co|and|the|of)$/i.test(w));
  return words
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

/**
 * A colour from a Malaysian kitchen for each stall's card — pandan, chilli,
 * turmeric, teh tarik, ube, kopi — picked from the name so a stall keeps its
 * colour everywhere it appears.
 */
const FOOD_TONES = ["#2f7d4a", "#c2402e", "#c9871a", "#8a5a3c", "#6b4aa0", "#3d5a80"] as const;

export function stallTone(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FOOD_TONES[h % FOOD_TONES.length]!;
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
