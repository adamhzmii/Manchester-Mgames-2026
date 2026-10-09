"use client";

import { createContext, useContext, useMemo } from "react";

import { CheckIcon, ClockIcon } from "@/components/icons";
import { RelTime } from "@/components/rel-time";
import { useMinute } from "@/lib/clock";
import { expectedStarts, lateCourts, type CourtDelay, type Expected } from "@/lib/delays";
import { phaseOf } from "@/lib/matchday";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { useLiveFeed } from "@/lib/live-feed";

import styles from "./delays.module.css";

type Delays = {
  expected: ReadonlyMap<string, Expected>;
  courts: CourtDelay[];
  /**
   * The day is underway (or about to be): "on time" and a game's place in
   * its court's queue mean something. A week out they would be noise.
   */
  underway: boolean;
};

const NONE: Delays = { expected: new Map(), courts: [], underway: false };

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
    return {
      expected,
      courts: lateCourts(fixtures, expected),
      underway: phaseOf(fixtures, now) === "matchday",
    };
  }, [fixtures, now]);
  return <DelaysContext.Provider value={value}>{children}</DelaysContext.Provider>;
}

export type Kickoff = {
  /** The time to show: the printed one, or printed plus the rounded slip. */
  iso: string;
  lateMin: number;
  /** Games still to finish before it on its court, or null when unknown. */
  ahead: number | null;
  /** Its time has come and it has not started. */
  overdue: boolean;
};

/**
 * When a game should now kick off. The official time plus the rounded slip,
 * not the raw estimate: "+10 min" next to 08:56 would read as a sum that
 * does not add up.
 */
export function useKickoff(fixture: Fixture): Kickoff {
  const { expected } = useContext(DelaysContext);
  const e = fixture.status === "upcoming" ? expected.get(fixture.id) : undefined;
  const lateMin = e?.lateMin ?? 0;
  return {
    iso:
      lateMin > 0
        ? new Date(Date.parse(fixture.scheduledTime) + lateMin * 60_000).toISOString()
        : fixture.scheduledTime,
    lateMin,
    ahead: e?.ahead ?? null,
    overdue: e?.overdue ?? false,
  };
}

/** The full estimate map, for screens that work across a whole court. */
export function useExpected(): ReadonlyMap<string, Expected> {
  return useContext(DelaysContext).expected;
}

export function useLateCourts(): CourtDelay[] {
  return useContext(DelaysContext).courts;
}

/**
 * The kick-off to show: the official one, or the new one in orange — with
 * the old one struck through beside it where there is room (`showWas`).
 */
export function KickoffTime({
  fixture,
  className,
  showWas = false,
}: {
  fixture: Fixture;
  className?: string;
  showWas?: boolean;
}) {
  const { iso, lateMin } = useKickoff(fixture);
  if (showWas && lateMin > 0) {
    return (
      <span className={styles.moved}>
        <s className={styles.was}>
          <span className="mg-sr-only">was </span>
          {formatTime(fixture.scheduledTime)}
        </s>
        <span className={className} data-late="">
          <span className="mg-sr-only">now </span>
          {formatTime(iso)}
        </span>
      </span>
    );
  }
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

/** Where a game is in its court's queue, in words. */
export function queueText(fixture: Fixture, ahead: number, overdue: boolean): string {
  const court = fixture.courtName;
  if (ahead === 0) return overdue ? `Up next on ${court} · starting soon` : `Next on ${court}`;
  return `${ahead} ${ahead === 1 ? "game" : "games"} before this one on ${court}`;
}

/**
 * How a game's time stands, for the places someone checks before walking
 * over: "Running 15 min late · was 08:30", or "On time", and on the day
 * where it is in its court's queue — "2 games before this one on Hall B".
 * The queue is the line to trust: an estimate can be wrong, the order of
 * games on a court cannot.
 */
export function LateNote({
  fixture,
  className,
  onNight = false,
  queue = true,
  onTime = true,
}: {
  fixture: Fixture;
  className?: string;
  /** On a dark band, where the page's orange is too dim. */
  onNight?: boolean;
  /** Add the court queue line on the day. */
  queue?: boolean;
  /** Say "On time" on the day when it is. */
  onTime?: boolean;
}) {
  const { underway } = useContext(DelaysContext);
  const { lateMin, ahead, overdue } = useKickoff(fixture);
  if (fixture.status !== "upcoming") return null;

  const showQueue = queue && underway && ahead !== null && fixture.courtName !== "TBC";
  const status =
    lateMin > 0 ? (
      <span className={`${styles.note} ${onNight ? styles.night : ""}`}>
        <ClockIcon size={14} />
        Running {lateMin} min late · was {formatTime(fixture.scheduledTime)}
      </span>
    ) : onTime && underway ? (
      <span className={`${styles.note} ${styles.onTime} ${onNight ? styles.onTimeNight : ""}`}>
        <CheckIcon size={14} />
        On time
      </span>
    ) : null;

  if (!status && !showQueue) return null;
  return (
    <span className={`${styles.timing} ${className ?? ""}`}>
      {status}
      {showQueue ? (
        <span className={`${styles.queue} ${onNight ? styles.queueNight : ""}`}>
          {queueText(fixture, ahead!, overdue)}
        </span>
      ) : null}
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
