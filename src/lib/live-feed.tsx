"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { Fixture } from "@/lib/fixtures";
import type { AnnouncementType } from "@/lib/supabase/types";

/** How often an open page asks for new scores. */
const POLL_MS = 15_000;

export type LatestUpdate = {
  id: string;
  type: AnnouncementType;
  title: string;
  publishedAt: string;
};

export type LiveFeed = {
  /** Every fixture as of the last successful poll; null until the first lands. */
  fixtures: Fixture[] | null;
  /** The newest committee update, if there has been one. */
  latestUpdate: LatestUpdate | null;
  /** When the last poll succeeded, in ms since epoch. */
  lastSuccess: number | null;
  /** The most recent poll failed — the page is showing older data. */
  failing: boolean;
};

const EMPTY: LiveFeed = { fixtures: null, latestUpdate: null, lastSuccess: null, failing: false };

const LiveFeedContext = createContext<LiveFeed>(EMPTY);

/**
 * One poller per tab, shared by everything on the page that shows a score.
 *
 * Before this, each screen polled on its own and the header could not show
 * what was live at all. Now the header's live count, the schedule and any
 * open match all read the same response, so they can never disagree with
 * each other and a tab makes one request every ~15s however much is on it.
 *
 * Polls /api/live, which Vercel's CDN answers for everyone at once — see that
 * route for why this replaced a Realtime subscription. Pauses while the tab is
 * hidden and catches up the moment it returns or the network comes back.
 */
export function LiveFeedProvider({ children }: { children: React.ReactNode }) {
  const [feed, setFeed] = useState<LiveFeed>(EMPTY);

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
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const body = (await response.json()) as {
          fixtures: Fixture[];
          latestUpdate: LatestUpdate | null;
        };
        setFeed({
          fixtures: body.fixtures,
          latestUpdate: body.latestUpdate ?? null,
          lastSuccess: Date.now(),
          failing: false,
        });
      } catch (error) {
        if (controller.signal.aborted && stopped) return;
        // Keep the last good data; just record that it is now old.
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          setFeed((current) => ({ ...current, failing: true }));
        }
      }

      if (!stopped && !document.hidden) schedule();
    };

    // Jittered so a crowd that opened the site together — the end of a final
    // — does not keep polling in lockstep.
    const schedule = () => {
      timer = setTimeout(poll, POLL_MS * (0.8 + Math.random() * 0.4));
    };

    const onVisibility = () => {
      if (document.hidden) clearTimeout(timer);
      else void poll();
    };
    const onOnline = () => void poll();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOnline);
    // Straight away rather than after the first interval: the header's live
    // count has nothing to show until this lands.
    if (!document.hidden) void poll();

    return () => {
      stopped = true;
      clearTimeout(timer);
      inFlight?.abort();
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOnline);
    };
  }, []);

  return <LiveFeedContext.Provider value={feed}>{children}</LiveFeedContext.Provider>;
}

export function useLiveFeed(): LiveFeed {
  return useContext(LiveFeedContext);
}

/**
 * A server-rendered fixture list, kept current by the shared feed.
 *
 * Returns the feed's full list once it has one — callers filter to what they
 * show — and the server's list until then. Either way, for any fixture both
 * sides hold, the newer copy wins: the feed can be ~20s behind the database,
 * and without this a coordinator who has just saved a score would watch it
 * flip back to the old value when the next poll landed.
 */
export function useLiveFixtures(initial: Fixture[]): Fixture[] {
  const { fixtures } = useLiveFeed();
  return useMemo(() => (fixtures ? newest(initial, fixtures) : initial), [initial, fixtures]);
}

function newest(mine: readonly Fixture[], incoming: readonly Fixture[]): Fixture[] {
  const ours = new Map(mine.map((f) => [f.id, f]));
  return incoming.map((theirs) => {
    const local = ours.get(theirs.id);
    return local && Date.parse(local.updatedAt) > Date.parse(theirs.updatedAt) ? local : theirs;
  });
}
