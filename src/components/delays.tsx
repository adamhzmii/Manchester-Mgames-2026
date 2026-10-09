"use client";

import { createContext, useContext, useMemo } from "react";

import { ClockIcon } from "@/components/icons";
import { RelTime } from "@/components/rel-time";
import { useMinute } from "@/lib/clock";
import { expectedStarts, type Expected } from "@/lib/delays";
import { phaseOf } from "@/lib/matchday";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { useLiveFeed } from "@/lib/live-feed";

import styles from "./delays.module.css";

type Delays = {
  expected: ReadonlyMap<string, Expected>;
  /**
   * The day is underway (or about to be): "on time" and a game's place in
   * its court's queue mean something. A week out they would be noise.
   */
  underway: boolean;
};

const NONE: Delays = { expected: new Map(), underway: false };

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

/**
 * The kick-off to show: the time the game is now expected at, in the same
 * colours as any other time. Delays happen on every court on the day; the
 * committee chose not to flag each one, so a moved time is simply the time.
 */
export function KickoffTime({ fixture, className }: { fixture: Fixture; className?: string }) {
  const { iso } = useKickoff(fixture);
  return <span className={className}>{formatTime(iso)}</span>;
}

/** Where a game is in its court's queue, in words. */
export function queueText(fixture: Fixture, ahead: number, overdue: boolean): string {
  const court = fixture.courtName;
  if (ahead === 0) return overdue ? `Up next on ${court} · starting soon` : `Next on ${court}`;
  return `${ahead} ${ahead === 1 ? "game" : "games"} before this one on ${court}`;
}

/**
 * Two quiet lines under a game's time, for the places someone checks before
 * walking over: "Delayed 30 min · was 10:00" where it has moved (small and
 * warm — the one place a delay is said, since lists just show the time),
 * and on the day
 * where it is in its court's queue — "2 games before this one on Hall B".
 * The queue is the line to trust: an estimate can be wrong, the order of
 * games on a court cannot.
 */
export function LateNote({
  fixture,
  className,
  onNight = false,
  queue = true,
}: {
  fixture: Fixture;
  className?: string;
  /** On a dark band. */
  onNight?: boolean;
  /** Add the court queue line on the day. */
  queue?: boolean;
}) {
  const { underway } = useContext(DelaysContext);
  const { lateMin, ahead, overdue } = useKickoff(fixture);
  if (fixture.status !== "upcoming") return null;

  const showQueue = queue && underway && ahead !== null && fixture.courtName !== "TBC";
  if (lateMin === 0 && !showQueue) return null;
  return (
    <span className={`${styles.timing} ${className ?? ""}`}>
      {lateMin > 0 ? (
        <span className={`${styles.delayed} ${onNight ? styles.delayedNight : ""}`}>
          <ClockIcon size={13} />
          Delayed {lateMin} min · was {formatTime(fixture.scheduledTime)}
        </span>
      ) : null}
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
