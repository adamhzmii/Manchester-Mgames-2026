import "server-only";

import { createClient } from "@supabase/supabase-js";

import { supabaseEnv } from "./env";
import type { Database } from "./types";

/**
 * Anonymous client with no cookie handling at all.
 *
 * For responses that must be identical for every visitor so the CDN can cache
 * them. The cookie-aware server client reads the request's session and may
 * rotate it, and a response carrying one person's Set-Cookie must never be
 * cached and handed to the next. This client cannot do either: it only ever
 * has the permissions RLS grants to `anon`.
 */
export function createPublicClient() {
  const { url, anonKey } = supabaseEnv();

  return createClient<Database>(url, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
