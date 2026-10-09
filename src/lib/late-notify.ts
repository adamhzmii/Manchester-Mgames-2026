import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { demoScenario } from "@/lib/demo";
import { expectedStarts } from "@/lib/delays";
import { FIXTURE_SELECT, toFixture, type FixtureRow } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { sendPush } from "@/lib/push/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";

/** A slip has to reach this before followers are told about it... */
const NOTIFY_FROM_MIN = 10;
/** ...and grow by this much again before they are told a second time. */
const NOTIFY_STEP_MIN = 10;

/** How often the background check may run, however many phones are polling. */
const BACKGROUND_EVERY_MS = 60_000;

type Client = SupabaseClient<Database>;

/**
 * Tells a game's followers when it is running late — once it has slipped 10
 * minutes, and again each further 10 — using the same estimate every page
 * shows. Runs after anything that can move a court's timetable, and in the
 * background (below) for the slips nobody saves: a game that simply has not
 * started.
 *
 * Each slip is claimed in the database before it is sent, so two runs at the
 * same moment cannot both announce it. Best effort throughout: a failure here
 * never undoes the save that caused it.
 */
export async function notifyLateGames(supabase: Client): Promise<void> {
  try {
    const { data } = await supabase
      .from("fixtures")
      .select(`${FIXTURE_SELECT}, delay_notified_minutes`)
      .order("scheduled_time");
    if (!data) return;

    const rows = data as unknown as (FixtureRow & { delay_notified_minutes: number })[];
    const fixtures = rows.map(toFixture);
    const expected = expectedStarts(fixtures, Date.now());

    for (const [i, game] of fixtures.entries()) {
      const lateMin = expected.get(game.id)?.lateMin ?? 0;
      const told = rows[i].delay_notified_minutes;
      if (game.status !== "upcoming" || game.teamAId === null || game.teamBId === null) continue;
      if (lateMin < NOTIFY_FROM_MIN || lateMin < told + NOTIFY_STEP_MIN) continue;

      const { data: claimed } = await supabase
        .from("fixtures")
        .update({ delay_notified_minutes: lateMin })
        .eq("id", game.id)
        .lte("delay_notified_minutes", lateMin - NOTIFY_STEP_MIN)
        .select("id");
      if (!claimed || claimed.length === 0) continue;

      const now = new Date(Date.parse(game.scheduledTime) + lateMin * 60_000).toISOString();
      await sendPush(
        {
          title: `Running ${lateMin} min late`,
          body: `${game.teamA} v ${game.teamB} is now about ${formatTime(now)} (was ${formatTime(game.scheduledTime)}), ${game.venueShortName} ${game.courtName}.`,
          url: `/match/${game.id}`,
          tag: `late-${game.id}`,
        },
        { teamIds: [game.teamAId, game.teamBId] },
      );
    }
  } catch {
    // Best effort by design — see the docblock.
  }
}

/**
 * The same check with nobody saving anything, at most once a minute.
 *
 * Vercel's Hobby plan runs scheduled jobs once a day, far too seldom, so
 * this rides on the live feed instead: phones poll it all day, and every
 * request that reaches the server (rather than the CDN's copy) offers to run
 * the check. The job_claims row makes sure only one of them does.
 *
 * Off in a local rehearsal, whose scores never reach the database, and on a
 * development machine unless asked for — it would otherwise notify real
 * phones from a laptop.
 */
export async function checkLateInBackground(): Promise<void> {
  if (demoScenario()) return;
  if (!process.env.VERCEL && process.env.MGAMES_LATE_CHECK !== "1") return;

  try {
    const supabase = createServiceClient();
    const { data: claimed } = await supabase
      .from("job_claims")
      .update({ ran_at: new Date().toISOString() })
      .eq("name", "late-check")
      .lt("ran_at", new Date(Date.now() - BACKGROUND_EVERY_MS).toISOString())
      .select("name");
    if (!claimed || claimed.length === 0) return;
    await notifyLateGames(supabase);
  } catch {
    // A missed check is caught by the next one a minute later.
  }
}
