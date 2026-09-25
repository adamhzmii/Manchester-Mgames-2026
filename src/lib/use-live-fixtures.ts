"use client";

import { useEffect, useState } from "react";

import type { Fixture } from "@/lib/fixtures";

/** How often an open page asks for new scores. */
const POLL_MS = 15_000;

/**
 * Keeps a server-rendered fixture list current by polling /api/live.
 *
 * This replaced a Supabase Realtime subscription. Realtime holds one open
 * connection per phone, and the plan caps those — past the cap, the next
 * person to open the site simply never received updates, and nothing on the
 * page said so. Polling a CDN-cached route has no such ceiling: every phone
 * gets the same response from Vercel's edge, so a thousand phones cost
 * Supabase what ten do. The price is latency — a score reaches phones within
 * about 20 seconds (the poll interval plus the CDN's 5s freshness window)
 * rather than instantly.
 *
 * A dropped signal also stops being silent. A Realtime socket that died
 * stayed dead; a poll that fails just tries again next tick.
 *
 * `initial` still wins whenever the server re-renders — after a coordinator
 * saves a score, their Server Action revalidates the page and hands down a
 * fresh list. That resync happens during render, not in an effect, so the
 * stale list is never painted first.
 */
export function useLiveFixtures(initial: Fixture[]): Fixture[] {
  const [fixtures, setFixtures] = useState(initial);
  const [seenInitial, setSeenInitial] = useState(initial);

  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setFixtures((current) => newest(current, initial));
  }

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let inFlight: AbortController | undefined;
    let stopped = false;

    const poll = async () => {
      clearTimeout(timer);
      inFlight?.abort();
      const controller = new AbortController();
      inFlight = controller;

      try {
        const response = await fetch("/api/live", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (response.ok) {
          const body = (await response.json()) as { fixtures: Fixture[] };
          setFixtures((current) => newest(current, body.fixtures));
        }
      } catch {
        // Offline, aborted, or a bad response: keep what we have and try again
        // on the next tick. Nothing to show here — the page already has data.
      }

      if (!stopped && !document.hidden) schedule();
    };

    // Jittered so a crowd that all opened the site at the same moment — the
    // end of a final — does not keep polling in lockstep.
    const schedule = () => {
      timer = setTimeout(poll, POLL_MS * (0.8 + Math.random() * 0.4));
    };

    // A phone in a pocket should not poll. When it comes back, catch up at
    // once rather than showing a score that could be minutes old.
    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer);
      else void poll();
    };
    const onOnline = () => void poll();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    if (!document.hidden) schedule();

    return () => {
      stopped = true;
      clearTimeout(timer);
      inFlight?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, []);

  return fixtures;
}

/**
 * Takes `incoming` as the set of fixtures, but keeps our own copy of any
 * fixture we already hold a newer version of.
 *
 * The poll can be up to ~20 seconds behind. Without this, a coordinator who
 * has just saved a score — and whose page already shows it — would watch it
 * flip back to the old value when the next poll landed, then forward again.
 */
function newest(current: Fixture[], incoming: Fixture[]): Fixture[] {
  const mine = new Map(current.map((f) => [f.id, f]));
  return incoming.map((theirs) => {
    const ours = mine.get(theirs.id);
    return ours && Date.parse(ours.updatedAt) > Date.parse(theirs.updatedAt) ? ours : theirs;
  });
}
