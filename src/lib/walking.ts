/**
 * How far apart the venues are on foot, from their coordinates, so adding a
 * venue does not mean someone timing a walk to every other one.
 */
type Place = { latitude: number | null; longitude: number | null };

const EARTH_RADIUS_M = 6_371_000;

/** Straight-line distance in metres. */
export function metresBetween(a: Place, b: Place): number | null {
  if (a.latitude === null || a.longitude === null || b.latitude === null || b.longitude === null) {
    return null;
  }
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/**
 * Minutes to walk: the straight line plus a quarter for streets that do not
 * run straight, at 5 km/h. That gives 12 minutes from Trinity to Sugden — the
 * time the committee walked it in.
 */
export function walkMinutes(a: Place, b: Place): number | null {
  const metres = metresBetween(a, b);
  if (metres === null) return null;
  return Math.max(1, Math.ceil((metres * 1.25) / (5000 / 60)));
}

/** Google Maps walking directions from one place to another. */
export function walkingDirections(from: Place, to: Place): string | null {
  if (from.latitude === null || from.longitude === null || to.latitude === null || to.longitude === null) {
    return null;
  }
  return (
    "https://www.google.com/maps/dir/?api=1" +
    `&origin=${from.latitude},${from.longitude}` +
    `&destination=${to.latitude},${to.longitude}` +
    "&travelmode=walking"
  );
}
