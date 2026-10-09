import { byKickoff, type Fixture } from "@/lib/fixtures";
import { feederGame } from "@/lib/slots";

/**
 * When each game should now kick off, worked out from what has really
 * happened on its court.
 *
 * A late start does not stay on one game: everything after it on the same
 * court slides too, until a gap in the schedule absorbs it. Nobody has time
 * to retype a dozen kick-offs mid-tournament, so the site reads the real
 * start and finish times coordinators already create by tapping Start and
 * Finish, and carries any slip down the court:
 *
 *   - a game is due when its printed time comes, but not before the game
 *     before it on the court is done, and not before any game it waits on
 *     (the semi-final whose winner it needs) is done;
 *   - unless a coordinator has said when it starts ("starts at 10:05"): they
 *     are standing at the court, so that time stands — never before the
 *     printed one — and the games after it follow on from it;
 *   - a game takes its slot: the time until the next game on its court, at
 *     most the court's usual slot, so a lunch break counts as slack;
 *   - a live game that runs past its slot pushes everything after it, minute
 *     by minute — until a later game on the court starts, which means it is
 *     over whatever its button says;
 *   - a game that is due and has not started is late by however long it has
 *     been.
 *
 * The printed kick-off never changes. This is shown beside it.
 */
export type Expected = {
  /** When the game should now kick off, in ms. */
  at: number;
  /** How far behind its printed time, in minutes, rounded to 5. 0 when on time. */
  lateMin: number;
  /** When it became due: its time, a coordinator's, or the court coming free. */
  due: number;
  /** Due and not started yet — waiting on teams, or on someone tapping Start. */
  overdue: boolean;
  /** A coordinator set the time, rather than the site working it out. */
  planned: boolean;
  /** Games still to finish before this one on its court: 0 means it is next. */
  ahead: number;
};

/** Less than this behind is just a normal day: nobody needs telling. */
export const LATE_MIN = 5;

/** A game's length on a court with nothing to measure from. */
const FALLBACK_SLOT_MIN = 20;

const MINUTE = 60_000;

export const courtKey = (f: Fixture) =>
  f.courtName === "TBC" || f.venueSlug === "" ? `game:${f.id}` : `${f.venueSlug}|${f.courtName}`;

/** Rounded to 5, and nothing at all below the threshold. */
export function roundLate(minutes: number): number {
  return minutes < LATE_MIN ? 0 : Math.round(minutes / 5) * 5;
}

/**
 * When a started game counts as having begun: its real kick-off, but never
 * before its printed time or the time a coordinator set. A Start tapped
 * early — by mistake, or a week early while trying the console out — must
 * not make the court look ahead of itself and wipe out a delay everyone has
 * already been told about. Games never begin before their time on the day.
 */
export function effectiveStart(f: Fixture): number {
  const floor = Math.max(
    Date.parse(f.scheduledTime),
    f.plannedStart ? Date.parse(f.plannedStart) : -Infinity,
  );
  return f.startedAt ? Math.max(Date.parse(f.startedAt), floor) : floor;
}

/** Each court's games in the order they are played: printed time, then id. */
export function gamesByCourt(fixtures: readonly Fixture[]): Map<string, Fixture[]> {
  const byCourt = new Map<string, Fixture[]>();
  for (const f of [...fixtures].sort(byKickoff)) {
    const list = byCourt.get(courtKey(f)) ?? [];
    list.push(f);
    byCourt.set(courtKey(f), list);
  }
  return byCourt;
}

/**
 * Each game's slot, in ms: the time until the next game on its court, capped
 * at the court's usual gap so a long break is slack rather than a long game.
 */
export function slotLengths(fixtures: readonly Fixture[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const sorted of gamesByCourt(fixtures).values()) {
    const gaps = sorted
      .slice(1)
      .map((f, i) => Date.parse(f.scheduledTime) - Date.parse(sorted[i].scheduledTime))
      .filter((gap) => gap > 0)
      .sort((a, b) => a - b);
    const usual = gaps.length > 0 ? gaps[Math.floor(gaps.length / 2)] : FALLBACK_SLOT_MIN * MINUTE;
    sorted.forEach((f, i) => {
      const next = sorted[i + 1];
      const gap = next ? Date.parse(next.scheduledTime) - Date.parse(f.scheduledTime) : 0;
      result.set(f.id, gap > 0 ? Math.min(gap, usual) : usual);
    });
  }
  return result;
}

/**
 * The earliest real kick-off of any later game on the same court. A game
 * still showing live after that has been left running by mistake: it ended
 * when the next one began.
 */
function nextKickoffs(byCourt: Map<string, Fixture[]>): Map<string, number> {
  const result = new Map<string, number>();
  for (const games of byCourt.values()) {
    let earliest = Infinity;
    for (let i = games.length - 1; i >= 0; i -= 1) {
      if (earliest < Infinity) result.set(games[i].id, earliest);
      const g = games[i];
      if (g.status !== "upcoming") {
        earliest = Math.min(earliest, effectiveStart(g));
      }
    }
  }
  return result;
}

export function expectedStarts(fixtures: readonly Fixture[], now: number): Map<string, Expected> {
  const slot = slotLengths(fixtures);
  const byCourt = gamesByCourt(fixtures);
  const startedAfter = nextKickoffs(byCourt);
  const courtFree = new Map<string, number>();
  const endOf = new Map<string, number>();
  const expected = new Map<string, Expected>();

  const ahead = new Map<string, number>();
  for (const games of byCourt.values()) {
    let unfinished = 0;
    for (const g of games) {
      ahead.set(g.id, unfinished);
      // A game still marked live after the next one began is over.
      const over = g.status === "finished" || (g.status === "live" && startedAfter.has(g.id));
      if (!over) unfinished += 1;
    }
  }

  // Kick-off order across every court, so a game's feeders — earlier games,
  // possibly elsewhere — are always worked out before it.
  for (const f of [...fixtures].sort(byKickoff)) {
    const scheduled = Date.parse(f.scheduledTime);
    const length = slot.get(f.id) ?? FALLBACK_SLOT_MIN * MINUTE;
    const key = courtKey(f);
    let end: number;

    if (f.status === "finished") {
      const start = effectiveStart(f);
      const finished = f.finishedAt ? Date.parse(f.finishedAt) : -Infinity;
      // A whistle before the game could have begun (an early test tap) says
      // nothing about when the court is free: assume it took its slot.
      end = finished > start ? finished : start + length;
    } else if (f.status === "live") {
      const start = effectiveStart(f);
      // Past its slot it is overrunning: it ends no sooner than now. Unless
      // the court has already moved on to a later game.
      end = Math.min(Math.max(start + length, now), startedAfter.get(f.id) ?? Infinity);
    } else {
      let due: number;
      const planned = f.plannedStart !== null;
      if (planned) {
        due = Math.max(scheduled, Date.parse(f.plannedStart!));
      } else {
        due = Math.max(scheduled, courtFree.get(key) ?? -Infinity);
        for (const label of [f.slotA, f.slotB]) {
          const feeder = feederGame(label, f.categoryId, fixtures);
          const ready = feeder ? endOf.get(feeder.game.id) : undefined;
          if (ready !== undefined) due = Math.max(due, ready);
        }
      }
      const overdue = now >= due;
      const start = overdue ? now : due;
      expected.set(f.id, {
        at: start,
        lateMin: roundLate((start - scheduled) / MINUTE),
        due,
        overdue,
        planned,
        ahead: ahead.get(f.id) ?? 0,
      });
      end = start + length;
    }

    endOf.set(f.id, end);
    courtFree.set(key, Math.max(courtFree.get(key) ?? -Infinity, end));
  }

  return expected;
}

/** A court running behind, as the next game there shows it. */
export type CourtDelay = {
  venueShortName: string;
  courtName: string;
  lateMin: number;
  /** The sport of that next game. */
  sportSlug: string;
};

export function lateCourts(
  fixtures: readonly Fixture[],
  expected: ReadonlyMap<string, Expected>,
): CourtDelay[] {
  const next = new Map<string, Fixture>();
  for (const f of [...fixtures].sort(byKickoff)) {
    if (f.status !== "upcoming" || f.courtName === "TBC") continue;
    if (!next.has(courtKey(f))) next.set(courtKey(f), f);
  }
  return [...next.values()]
    .map((f) => ({
      venueShortName: f.venueShortName,
      courtName: f.courtName,
      lateMin: expected.get(f.id)?.lateMin ?? 0,
      sportSlug: f.sportSlug,
    }))
    .filter((c) => c.lateMin > 0)
    .sort((a, b) => b.lateMin - a.lateMin);
}

// ------------------------------------------------------------ courts ----

/** Something on a court that a person should look at. */
export type CourtAlert =
  /** Live far longer than a game there takes: Finish probably not tapped. */
  | { kind: "long-live"; minutes: number; fixtureId: string }
  /** Marked live, but a later game on the court has started. */
  | { kind: "left-live"; fixtureId: string }
  /** Due a while ago and not started: teams missing, or Start not tapped. */
  | { kind: "not-started"; minutes: number; fixtureId: string };

export type CourtState = {
  key: string;
  courtId: string | null;
  courtName: string;
  venueShortName: string;
  /** The court's games in order, played or not. */
  games: Fixture[];
  /** The game being played, if any. */
  live: Fixture | null;
  /** The next game to start, if any. */
  next: Fixture | null;
  /** How far behind the court is, as its next game shows it. */
  lateMin: number;
  /** The last time anyone tapped Start or Finish here, in ms. */
  lastTap: number | null;
  alerts: CourtAlert[];
};

/** A live game this far past its slot is probably finished. */
const LONG_LIVE_FACTOR = 2;
/** Due this long without starting is worth a phone call. */
const NOT_STARTED_ALERT_MIN = 15;

/**
 * Each court as a coordinator needs it: what is on, what is next, how far
 * behind it is, and anything that looks wrong. Courts in the order their
 * first game is played.
 */
export function courtStates(
  fixtures: readonly Fixture[],
  expected: ReadonlyMap<string, Expected>,
  now: number,
): CourtState[] {
  const slot = slotLengths(fixtures);
  const byCourt = gamesByCourt(fixtures);
  const startedAfter = nextKickoffs(byCourt);
  const states: CourtState[] = [];

  for (const [key, games] of byCourt) {
    if (key.startsWith("game:")) continue;
    const alerts: CourtAlert[] = [];
    let live: Fixture | null = null;
    let lastTap: number | null = null;

    for (const g of games) {
      for (const stamp of [g.startedAt, g.finishedAt]) {
        if (stamp) lastTap = Math.max(lastTap ?? -Infinity, Date.parse(stamp));
      }
      if (g.status !== "live") continue;
      if (startedAfter.has(g.id)) {
        alerts.push({ kind: "left-live", fixtureId: g.id });
        continue;
      }
      live ??= g;
      const started = effectiveStart(g);
      const length = slot.get(g.id) ?? FALLBACK_SLOT_MIN * MINUTE;
      const minutes = Math.floor((now - started) / MINUTE);
      if (now - started > length * LONG_LIVE_FACTOR) {
        alerts.push({ kind: "long-live", minutes, fixtureId: g.id });
      }
    }

    const next = games.find((g) => g.status === "upcoming") ?? null;
    const nextExpected = next ? expected.get(next.id) : undefined;
    if (next && nextExpected && live === null) {
      const waiting = Math.floor((now - nextExpected.due) / MINUTE);
      if (waiting >= NOT_STARTED_ALERT_MIN) {
        alerts.push({ kind: "not-started", minutes: waiting, fixtureId: next.id });
      }
    }

    states.push({
      key,
      courtId: games[0].courtId,
      courtName: games[0].courtName,
      venueShortName: games[0].venueShortName,
      games,
      live,
      next,
      lateMin: nextExpected?.lateMin ?? 0,
      lastTap,
      alerts,
    });
  }

  return states;
}
