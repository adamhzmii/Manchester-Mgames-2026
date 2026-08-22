import { cookies } from "next/headers";

import { createServerClient } from "@supabase/ssr";

import { supabaseEnv } from "./env";
import type { Database } from "./types";

/**
 * Server client for Server Components, Server Actions and Route Handlers.
 *
 * Must be created per request — never hoisted to a module-level constant, or
 * one visitor's session would leak into another's render.
 */
export async function createClient() {
  // cookies() first: reading it is what marks the caller as request-time.
  // Doing the env check ahead of it would throw during a build with no
  // configuration instead of simply deferring the page to a request.
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();

  return createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Server Components get a read-only cookie store. Swallowing here is
          // safe *because* src/proxy.ts refreshes the session on every request
          // and writes the rotated tokens to the response itself. If that proxy
          // is ever removed, sessions will start expiring silently.
        }
      },
    },
  });
}
