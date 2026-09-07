"use server";

import { createClient } from "@/lib/supabase/server";

export type PushState = {
  status: "idle" | "saved" | "error";
  message: string | null;
};

/**
 * Stores (or refreshes) this browser's push subscription.
 *
 * Goes through a SECURITY DEFINER function rather than touching the table:
 * `push_subscriptions` has no client-facing policies at all, because its
 * endpoints are the only thing stopping a stranger pushing to every device
 * that ever opted in.
 *
 * The function upserts on `endpoint`: a browser that re-subscribes hands back
 * the same endpoint, and inserting again would send that person a duplicate of
 * every notification.
 */
export async function savePushSubscription(
  subscription: { endpoint: string; p256dh: string; auth: string },
  teamIds: string[],
): Promise<PushState> {
  if (!subscription.endpoint || !subscription.p256dh || !subscription.auth) {
    return { status: "error", message: "Incomplete subscription." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("register_push_subscription", {
    p_endpoint: subscription.endpoint,
    p_p256dh: subscription.p256dh,
    p_auth: subscription.auth,
    p_team_ids: teamIds,
  });

  if (error) {
    return { status: "error", message: `Could not save: ${error.message}` };
  }
  return { status: "saved", message: "Notifications on." };
}

/** Called when a visitor turns notifications off, or the browser revokes them. */
export async function removePushSubscription(endpoint: string): Promise<PushState> {
  if (!endpoint) return { status: "error", message: "Missing endpoint." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unregister_push_subscription", {
    p_endpoint: endpoint,
  });

  if (error) return { status: "error", message: error.message };
  return { status: "saved", message: "Notifications off." };
}
