"use client";

import { createContext, useContext, useMemo } from "react";

import { ClockIcon } from "@/components/icons";
import { RelTime } from "@/components/rel-time";
import { useMinute } from "@/lib/clock";
import { expectedStarts, lateCourts, type CourtDelay, type Expected } from "@/lib/delays";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { useLiveFeed } from "@/lib/live-feed";

import styles from "./delays.module.css";

type Delays = { expected: ReadonlyMap<string, Expected>; courts: CourtDelay[] };

const NONE: Delays = { expected: new Map(), courts: [] };

const DelaysContext = createContext<Delays>(NONE);

/**
 * Works out every game's expected kick-off once for the whole page, from the
 * shared live feed and the minute clock, so every time shown agrees.
 *
 * Empty until the first poll lands and the clock is running: the server's
 * HTML shows official times only, and the estimates appear a moment later.
 */
export function DelaysProvider({ children }: { children: React.ReactNode }) {
  const { fixtures } = useLiveFeed();
  const now = useMinute();
  const value = useMemo<Delays>(() => {
    if (!fixtures || now === null) return NONE;
    const expected = expectedStarts(fixtures, now);
    return { expected, courts: lateCourts(fixtures, expected) };
  }, [fixtures, now]);
  return <DelaysContext.Provider value={value}>{children}</DelaysContext.Provider>;
}

/**
 * When a game should now kick off. The official time plus the rounded slip,
 * not the raw estimate: "+10 min" next to 08:56 would read as a sum that
 * does not add up.
 */
export function useKickoff(fixture: Fixture): { iso: string; lateMin: number } {
  const { expected } = useContext(DelaysContext);
  const lateMin = fixture.status === "upcoming" ? (expected.get(fixture.id)?.lateMin ?? 0) : 0;
  return lateMin > 0
    ? { iso: new Date(Date.parse(fixture.scheduledTime) + lateMin * 60_000).toISOString(), lateMin }
    : { iso: fixture.scheduledTime, lateMin: 0 };
}

export function useLateCourts(): CourtDelay[] {
  return useContext(DelaysContext).courts;
}

/** The kick-off to show: the official one, or the new one in orange. */
export function KickoffTime({ fixture, className }: { fixture: Fixture; className?: string }) {
  const { iso, lateMin } = useKickoff(fixture);
  return (
    <span className={className} data-late={lateMin > 0 ? "" : undefined}>
      {formatTime(iso)}
    </span>
  );
}

/** "+15 min", under a time that has moved. Nothing when it has not. */
export function LateTag({ fixture, className }: { fixture: Fixture; className?: string }) {
  const { lateMin } = useKickoff(fixture);
  if (lateMin === 0) return null;
  return (
    <span className={`${styles.tag} ${className ?? ""}`}>
      <span className="mg-sr-only">Running </span>+{lateMin} min
      <span className="mg-sr-only"> late</span>
    </span>
  );
}

/** "Running 15 min late · was 08:30", or nothing. */
export function LateNote({
  fixture,
  className,
  onNight = false,
}: {
  fixture: Fixture;
  className?: string;
  /** On a dark band, where the page's orange is too dim. */
  onNight?: boolean;
}) {
  const { lateMin } = useKickoff(fixture);
  if (lateMin === 0) return null;
  return (
    <span className={`${styles.note} ${onNight ? styles.night : ""} ${className ?? ""}`}>
      <ClockIcon size={14} />
      Running {lateMin} min late · was {formatTime(fixture.scheduledTime)}
    </span>
  );
}

/** "in 12 min", counted to the kick-off the game is now expected at. */
export function KickoffCountdown({ fixture, className }: { fixture: Fixture; className?: string }) {
  const { iso } = useKickoff(fixture);
  return <RelTime iso={iso} className={className} />;
}

/** Courts behind schedule right now, worst first — for the top of a list of games. */
export function LateCourts({ className }: { className?: string }) {
  const courts = useLateCourts();
  if (courts.length === 0) return null;
  return (
    <div className={`${styles.strip} ${className ?? ""}`} role="status">
      <span className={styles.stripTitle}>
        <ClockIcon size={15} />
        Running late
      </span>
      <ul className={styles.stripList}>
        {courts.map((c) => (
          <li key={`${c.venueShortName}-${c.courtName}`} className={styles.stripItem}>
            {c.venueShortName} {c.courtName}
            <span className={styles.stripMin}>+{c.lateMin} min</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
