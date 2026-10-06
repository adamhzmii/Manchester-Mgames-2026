import { byKickoff, type Fixture } from "@/lib/fixtures";
import { feederGame } from "@/lib/slots";

/**
 * When each game should now kick off, worked out from what has really
 * happened on its court.
 *
 * A late start does not stay on one game: everything after it on the same
 * court slides too, until a gap in the schedule absorbs it. Nobody has time
 * to retype a dozen kick-offs mid-tournament, so the site reads the real
 * start and finish times coordinators already create by tapping Start game
 * and Final whistle, and carries any slip down the court:
 *
 *   - a game kicks off when its scheduled time comes, but not before the
 *     game before it on the court is done, any game it waits on (the
 *     semi-final whose winner it needs) is done, and any "starting late" a
 *     coordinator set has passed;
 *   - a game takes its slot: the time until the next game on its court, at
 *     most the court's usual slot, so a lunch break counts as slack;
 *   - a live game that runs past its slot pushes everything after it, minute
 *     by minute;
 *   - a game whose time has come and gone without starting is late by
 *     however long it has been.
 *
 * The official kick-off never changes. This is an estimate shown beside it.
 */
export type Expected = {
  /** When the game should now kick off, in ms. */
  at: number;
  /** How far behind its scheduled time, in minutes, rounded to 5. 0 when on time. */
  lateMin: number;
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
 * Each game's slot, in ms: the time until the next game on its court, capped
 * at the court's usual gap so a long break is slack rather than a long game.
 */
export function slotLengths(fixtures: readonly Fixture[]): Map<string, number> {
  const byCourt = new Map<string, Fixture[]>();
  for (const f of fixtures) {
    const list = byCourt.get(courtKey(f)) ?? [];
    list.push(f);
    byCourt.set(courtKey(f), list);
  }

  const result = new Map<string, number>();
  for (const games of byCourt.values()) {
    const sorted = [...games].sort(byKickoff);
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

export function expectedStarts(fixtures: readonly Fixture[], now: number): Map<string, Expected> {
  const slot = slotLengths(fixtures);
  const courtFree = new Map<string, number>();
  const endOf = new Map<string, number>();
  const expected = new Map<string, Expected>();

  // Kick-off order across every court, so a game's feeders — earlier games,
  // possibly elsewhere — are always worked out before it.
  for (const f of [...fixtures].sort(byKickoff)) {
    const scheduled = Date.parse(f.scheduledTime);
    const length = slot.get(f.id) ?? FALLBACK_SLOT_MIN * MINUTE;
    const key = courtKey(f);
    let end: number;

    if (f.status === "finished") {
      const start = f.startedAt ? Date.parse(f.startedAt) : scheduled;
      end = f.finishedAt ? Date.parse(f.finishedAt) : start + length;
    } else if (f.status === "live") {
      const start = f.startedAt ? Date.parse(f.startedAt) : scheduled;
      // Past its slot it is overrunning: it ends no sooner than now.
      end = Math.max(start + length, now);
    } else {
      let start = Math.max(scheduled + f.delayMinutes * MINUTE, courtFree.get(key) ?? -Infinity);
      for (const label of [f.slotA, f.slotB]) {
        const feeder = feederGame(label, f.categoryId, fixtures);
        const ready = feeder ? endOf.get(feeder.game.id) : undefined;
        if (ready !== undefined) start = Math.max(start, ready);
      }
      // Its time has come and it has not started: it is at least this late.
      if (now >= scheduled) start = Math.max(start, now);
      expected.set(f.id, { at: start, lateMin: roundLate((start - scheduled) / MINUTE) });
      end = start + length;
    }

    endOf.set(f.id, end);
    courtFree.set(key, Math.max(courtFree.get(key) ?? -Infinity, end));
  }

  return expected;
}

/** A court running behind, as the next game there shows it. */
export type CourtDelay = { venueShortName: string; courtName: string; lateMin: number };

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
    }))
    .filter((c) => c.lateMin > 0)
    .sort((a, b) => b.lateMin - a.lateMin);
}
