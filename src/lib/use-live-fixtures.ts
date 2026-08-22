"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import type { Fixture } from "@/lib/fixtures";
import { createClient } from "@/lib/supabase/client";
import type { FixtureStatus } from "@/lib/supabase/types";

/**
 * Keeps a server-rendered fixture list current.
 *
 * A realtime payload carries the raw `fixtures` row — no joined team, sport or
 * court. Rather than re-query for each change, the three columns coordinators
 * actually touch (score_a, score_b, status) are patched straight onto the
 * fixture we already hold. Anything that cannot be patched from a bare row —
 * a new fixture, a deletion, an id we have never seen, a rescheduled kick-off
 * — falls back to `router.refresh()`, which re-runs the server query and hands
 * back a fully joined list.
 *
 * `initial` wins whenever the server re-renders, so a refresh does not get
 * overwritten by older patched state. That resync happens during render rather
 * than in an effect — an effect would paint the stale list first and then
 * immediately re-render over it.
 */
export function useLiveFixtures(initial: Fixture[]): Fixture[] {
  const [fixtures, setFixtures] = useState(initial);
  const [seenInitial, setSeenInitial] = useState(initial);
  const router = useRouter();

  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setFixtures(initial);
  }

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("fixtures-live")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fixtures" },
        (payload) => {
          if (payload.eventType !== "UPDATE") {
            router.refresh();
            return;
          }

          const row = payload.new as {
            id: string;
            score_a: number | null;
            score_b: number | null;
            status: FixtureStatus;
            scheduled_time: string;
            court_id: string | null;
          };

          setFixtures((current) => {
            const index = current.findIndex((f) => f.id === row.id);
            if (index === -1) {
              // Not in this view — it may have just become relevant (a fixture
              // going live on the home rail). Let the server decide.
              router.refresh();
              return current;
            }

            const existing = current[index];
            // A move to another court needs the joined court name, which the
            // payload does not carry.
            if (row.scheduled_time !== existing.scheduledTime) {
              router.refresh();
            }

            const next = [...current];
            next[index] = {
              ...existing,
              scoreA: row.score_a,
              scoreB: row.score_b,
              status: row.status,
              scheduledTime: row.scheduled_time,
            };
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [router]);

  return fixtures;
}
