"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/**
 * The page's sense of "now", for countdowns and "in 12 min" labels.
 *
 * One ticking store for the whole page rather than an interval per component:
 * a schedule with forty relative times would otherwise run forty timers.
 *
 * The server snapshot is null, and every consumer renders an absolute time
 * until the client has mounted. Rendering a relative time on the server would
 * put a string in the HTML that is already wrong by the time the browser
 * hydrates it.
 */

const TICK_MS = 1_000;

let current = 0;
let timer: ReturnType<typeof setInterval> | undefined;
const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  if (listeners.size === 1) {
    current = Date.now();
    timer = setInterval(() => {
      current = Date.now();
      for (const listener of listeners) listener();
    }, TICK_MS);
  }
  return () => {
    listeners.delete(onChange);
    if (listeners.size === 0) clearInterval(timer);
  };
}

function getSnapshot(): number {
  return current || Date.now();
}

function getServerSnapshot(): null {
  return null;
}

/**
 * Milliseconds between the real clock and the one the page should show. Zero
 * for every real visitor; non-zero only in a local matchday rehearsal, so the
 * countdowns match the day the server is pretending it is.
 */
const OffsetContext = createContext(0);

export function ClockProvider({
  offset,
  children,
}: {
  offset: number;
  children: React.ReactNode;
}) {
  return <OffsetContext.Provider value={offset}>{children}</OffsetContext.Provider>;
}

/** Current time in ms, or null during server render and hydration. */
export function useNow(): number | null {
  const offset = useContext(OffsetContext);
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return now === null ? null : now + offset;
}

function getMinuteSnapshot(): number {
  return Math.floor(getSnapshot() / 60_000) * 60_000;
}

/**
 * Current time to the minute. For things that only change by the minute —
 * which phase the day is in, "in 12 min" — so a whole page does not re-render
 * every second just because a countdown elsewhere on it is ticking.
 */
export function useMinute(): number | null {
  const offset = useContext(OffsetContext);
  const now = useSyncExternalStore(subscribe, getMinuteSnapshot, getServerSnapshot);
  return now === null ? null : now + offset;
}
