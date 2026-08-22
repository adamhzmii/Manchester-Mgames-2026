"use client";

import { createBrowserClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";
import type { Database } from "./types";

/**
 * Browser client — used by the realtime subscriptions on /schedule, /scores
 * and /announcements, and by the coordinator login form.
 *
 * `createBrowserClient` is already a singleton per (url, key), so calling this
 * from several components does not open several connections.
 */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient<Database>(url, anonKey);
}
