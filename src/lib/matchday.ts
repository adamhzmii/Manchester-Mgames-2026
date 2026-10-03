import type { Fixture } from "@/lib/fixtures";

/**
 * Where the tournament is, read from the fixtures themselves rather than a
 * hard-coded date: a committee dry run that marks a game live flips the whole
 * site into matchday mode exactly as the real day will, and a delayed start
 * or an overrun final is handled without anyone touching a config value.
 *
 *   before   — nothing has started, and it is not yet the morning of the event
 *   matchday — anything live or finished, or the event morning before kick-off
 *   after    — every game is finished
 */
export type Phase = "before" | "matchday" | "after";

/** How long before the first game the site starts behaving like matchday. */
const MORNING_WINDOW_MS = 3 * 60 * 60 * 1000;

export function phaseOf(fixtures: readonly Fixture[], now: number): Phase {
  if (fixtures.length === 0) return "before";
  if (fixtures.every((f) => f.status === "finished")) return "after";
  if (fixtures.some((f) => f.status !== "upcoming")) return "matchday";

  const first = firstKickoff(fixtures);
  return first !== null && now >= first - MORNING_WINDOW_MS ? "matchday" : "before";
}

export function firstKickoff(fixtures: readonly Fixture[]): number | null {
  let first: number | null = null;
  for (const f of fixtures) {
    const t = Date.parse(f.scheduledTime);
    if (first === null || t < first) first = t;
  }
  return first;
}

export function liveFixtures(fixtures: readonly Fixture[]): Fixture[] {
  return fixtures
    .filter((f) => f.status === "live")
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
}

/**
 * The next games to start. Anything still marked upcoming counts, including a
 * game whose slot has passed but that has not been started yet — on the day,
 * that is a game running late, and it is still "next".
 */
export function upNext(fixtures: readonly Fixture[], limit: number): Fixture[] {
  return fixtures
    .filter((f) => f.status === "upcoming")
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
    .slice(0, limit);
}

export function latestResults(fixtures: readonly Fixture[], limit: number): Fixture[] {
  return fixtures
    .filter((f) => f.status === "finished")
    .sort((a, b) => b.scheduledTime.localeCompare(a.scheduledTime))
    .slice(0, limit);
}

/**
 * Whole calendar days from `now` to `target`, both read as dates in
 * Manchester. "Tomorrow" at 23:59 is 1, not 0.
 */
export function daysUntil(now: number, target: number): number {
  const day = (t: number) => {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date(t));
    const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
    return Date.UTC(get("year"), get("month") - 1, get("day"));
  };
  return Math.round((day(target) - day(now)) / 86_400_000);
}

/**
 * "in 12 min", "in 1 hr 5 min", "now", "12 min ago". Short enough to sit
 * beside a kick-off time on a phone.
 */
export function relative(target: number, now: number): string {
  const diff = Math.round((target - now) / 60_000);
  if (Math.abs(diff) < 1) return "now";
  const abs = Math.abs(diff);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  // Weeks out, "in 493 hr 25 min" is noise; whole days say it.
  const days = Math.floor(hours / 24);
  const text =
    days > 0
      ? `${days} ${days === 1 ? "day" : "days"}`
      : hours === 0
        ? `${minutes} min`
        : minutes === 0
          ? `${hours} hr`
          : `${hours} hr ${minutes} min`;
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

/** The winning side of a finished game, or null for a draw or no result. */
export function winningSide(f: Fixture): "a" | "b" | null {
  if (f.status !== "finished" || f.scoreA === null || f.scoreB === null) return null;
  if (f.scoreA === f.scoreB) return null;
  return f.scoreA > f.scoreB ? "a" : "b";
}
