import "server-only";

import webpush from "web-push";

import { createServiceClient } from "@/lib/supabase/service";

/**
 * Web Push sending.
 *
 * Runs only on the server, under the service role: the subscriptions table has
 * no SELECT policy on purpose, because the endpoints stored in it are the only
 * thing preventing a stranger from pushing to every device that ever opted in.
 */

export type PushPayload = {
  title: string;
  body: string;
  /** Where clicking the notification should land. */
  url?: string;
  /** Same tag replaces an earlier notification instead of stacking a second. */
  tag?: string;
};

function configured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function configure(): void {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/**
 * Sends to every subscription, optionally narrowed to those following at least
 * one of `teamIds`.
 *
 * Returns counts rather than throwing on individual failures: one dead
 * endpoint among two hundred should not abort the send. Endpoints the push
 * service rejects as gone (404/410) are deleted, which is the only cleanup
 * mechanism there is — a browser that clears its data never tells us.
 */
export async function sendPush(
  payload: PushPayload,
  options: { teamIds?: string[] } = {},
): Promise<{ sent: number; failed: number; pruned: number; skipped?: string }> {
  if (!configured()) {
    return { sent: 0, failed: 0, pruned: 0, skipped: "VAPID keys not configured" };
  }
  configure();

  const supabase = createServiceClient();
  let query = supabase.from("push_subscriptions").select("endpoint, p256dh, auth");

  if (options.teamIds && options.teamIds.length > 0) {
    // Postgres array overlap: this subscription follows any of these teams.
    query = query.overlaps("team_ids", options.teamIds);
  }

  const { data, error } = await query;
  if (error || !data) {
    return { sent: 0, failed: 0, pruned: 0, skipped: error?.message ?? "no subscriptions" };
  }

  let sent = 0;
  let failed = 0;
  const gone: string[] = [];

  await Promise.all(
    data.map(async (row) => {
      try {
        await webpush.sendNotification(
          { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
          JSON.stringify(payload),
          { TTL: 60 * 30 },
        );
        sent += 1;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) gone.push(row.endpoint);
        else failed += 1;
      }
    }),
  );

  if (gone.length > 0) {
    await supabase.from("push_subscriptions").delete().in("endpoint", gone);
  }

  return { sent, failed, pruned: gone.length };
}
