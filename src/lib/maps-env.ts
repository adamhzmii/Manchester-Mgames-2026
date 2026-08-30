/**
 * The Google Maps key is optional, unlike Supabase's: the map page has a
 * working fallback (the venue list + a `geo:` directions link) when it's
 * absent, so this returns null instead of throwing — the caller decides
 * whether to render the live map or the fallback.
 */
export function googleMapsApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || null;
}
