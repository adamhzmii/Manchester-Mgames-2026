import { byRelevance, FIXTURE_SELECT, toFixture, type FixtureRow } from "@/lib/fixtures";
import { createPublicClient } from "@/lib/supabase/public";

/**
 * Every fixture, for phones polling for new scores.
 *
 * This is what lets the site scale with the crowd rather than with Supabase.
 * Every open page asks this route for updates every few seconds, but the
 * response is the same for everyone, so Vercel's CDN answers almost all of
 * those requests itself. Supabase sees roughly one query every few seconds per
 * CDN region whether ten phones are polling or ten thousand.
 *
 * Deliberately excluded from proxy.ts's matcher: the proxy runs as a function
 * on every request it matches, before the cache, so leaving this route in it
 * would turn every poll into a function call and burn through the Hobby plan's
 * monthly allowance within hours on event day.
 */

// Never prerender at build time — a snapshot from the build would be served
// as "live" scores until the next deploy.
export const dynamic = "force-dynamic";

/**
 * Fresh for 5s. After that the CDN keeps answering with the old copy while one
 * request refreshes it in the background, so no poll ever waits on Supabase.
 * If Supabase is down, the last good copy is served for up to a day instead
 * of an error: stale scores are better than no scores, and the client says how
 * old they are.
 */
const CDN_CACHE = "public, max-age=5, stale-while-revalidate=30, stale-if-error=86400";

export async function GET() {
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from("fixtures")
    .select(FIXTURE_SELECT)
    .order("scheduled_time");

  if (error) {
    // Must be a 5xx, not a 200 with an empty list: stale-if-error only kicks
    // in on an error status, and an empty 200 would be cached and would wipe
    // every schedule on every phone.
    console.error("[api/live] fixtures query failed:", error.message);
    return Response.json(
      { error: "Scores are temporarily unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const fixtures = (data as unknown as FixtureRow[]).map(toFixture).sort(byRelevance);

  return Response.json(
    { generatedAt: new Date().toISOString(), fixtures },
    {
      headers: {
        // Browsers always come back to the CDN rather than trusting their own
        // copy — the CDN is the thing that knows when it is stale.
        "Cache-Control": "public, max-age=0, must-revalidate",
        // Read only by Vercel's CDN, never forwarded to the browser.
        "Vercel-CDN-Cache-Control": CDN_CACHE,
      },
    },
  );
}
