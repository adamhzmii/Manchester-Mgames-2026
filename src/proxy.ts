import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh. (Next.js 16 renamed Middleware to Proxy; same mechanism.)
 *
 * Supabase access tokens are short-lived. Server Components cannot write
 * cookies, so if nothing refreshed the session here, a coordinator's login
 * would quietly stop working after an hour or so mid-event. This runs before
 * every page render, rotates the token when needed, and writes the new cookies
 * onto the outgoing response.
 *
 * Deliberately does NOT gate any route: attendees are anonymous by design and
 * every page is public. Login only changes what the UI offers, and the real
 * enforcement is the RLS policy on `fixtures`, not anything decided here.
 */
/**
 * The first backup address, before the short one. Phones that last updated
 * the site's worker before the change still send blocked visitors there —
 * and on a network that blocks manchestermgames.com they can never fetch
 * the newer worker — so the old address forwards everyone to the new one,
 * keeping the page and its query (the followed teams ride along in it).
 */
const OLD_BACKUP_HOST = "manchester-mgames-2026.vercel.app";
const BACKUP_HOST = "manchestermgames.vercel.app";

export async function proxy(request: NextRequest) {
  if (request.nextUrl.hostname === OLD_BACKUP_HOST) {
    const to = request.nextUrl.clone();
    to.protocol = "https";
    to.hostname = BACKUP_HOST;
    to.port = "";
    return NextResponse.redirect(to, 308);
  }

  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Without configuration there is no session to refresh. Letting the request
  // through keeps `next dev` usable before .env.local is filled in.
  if (!url || !anonKey) return response;

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Cache-Control: private, no-store and friends. A CDN that cached a
        // response carrying Set-Cookie would hand one person's session to the
        // next visitor.
        for (const [key, headerValue] of Object.entries(headers)) {
          response.headers.set(key, headerValue);
        }
      },
    },
  });

  // Must be awaited before the response is generated — a refresh that lands
  // after the response is committed cannot write its cookies.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except Next's own assets and static files — those never carry
     * a session and refreshing on each of them wastes a round trip — and the
     * live-scores poll. That route is anonymous and CDN-cached; running the
     * proxy in front of it would make every poll from every phone a function
     * invocation, before the cache could answer it.
     */
    "/((?!_next/static|_next/image|api/live|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|avif|ico)$).*)",
  ],
};
