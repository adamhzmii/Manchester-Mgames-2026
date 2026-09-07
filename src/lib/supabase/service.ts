import "server-only";

import { createClient } from "@supabase/supabase-js";

import type { Database } from "./types";

/**
 * Service-role client. Bypasses RLS entirely, so it must never be constructed
 * anywhere a request's own session should be the authority.
 *
 * The one legitimate use here is Web Push: `push_subscriptions` has no SELECT
 * policy by design — the endpoints in it are what stop a stranger pushing to
 * every device that ever opted in — so reading them to send a notification has
 * to happen above RLS.
 *
 * `server-only` above makes importing this from a Client Component a build
 * error rather than a leaked key.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY — required to send push notifications.",
    );
  }

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
