import "server-only";

import { courtKey, slotLengths } from "@/lib/delays";
import { byKickoff, type Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { previewDurationMin } from "@/lib/preview";
import { resolveSlot } from "@/lib/progression";
import type { GroupMeta, TeamMeta } from "@/lib/standings";
import type { AnnouncementType } from "@/lib/supabase/types";

/**
 * Matchday rehearsal: replays event day on top of the real fixture list, for
 * designing and testing the screens that only exist once games are being
 * played — live scores, results, filled-in brackets, the medal table.
 *
 *   MGAMES_DEMO=midday npm run dev
 *
 * Everything happens in memory on the way out of the query layer. Nothing is
 * written to Supabase, so it is safe to point at the production project, and
 * it is switched off on any Vercel deployment regardless of environment
 * variables — a rehearsal score must never reach a real visitor.
 *
 * Scenarios, by the clock they pretend it is:
 *   eve     — 19:00 the evening before, nothing played, the countdown on
 *   morning — 08:40, doors open, nothing started yet
 *   midday  — 13:20, groups done, semi-finals live
 *   post    — 18:00, every game played
 */
export type DemoScenario = "eve" | "morning" | "midday" | "post";

const SCENARIO_CLOCK: Record<DemoScenario, string> = {
  eve: "2026-10-23T19:00:00+01:00",
  morning: "2026-10-24T08:40:00+01:00",
  midday: "2026-10-24T13:20:00+01:00",
  post: "2026-10-24T18:00:00+01:00",
};

export function demoScenario(): DemoScenario | null {
  if (process.env.VERCEL) return null;
  const value = process.env.MGAMES_DEMO;
  return value === "eve" || value === "morning" || value === "midday" || value === "post"
    ? value
    : null;
}

/**
 * Shows the coordinator console in a rehearsal without signing in, to see
 * and test its layout. Its saves still go through the real server action as
 * an anonymous visitor, which the fixtures RLS policy refuses — so this
 * previews the console, it does not grant anything.
 */
export function demoScorer(): boolean {
  return demoScenario() !== null && process.env.MGAMES_DEMO_SCORER === "1";
}

/** The time the rehearsal is pretending it is, or null when not rehearsing. */
export function demoNow(): number | null {
  const scenario = demoScenario();
  return scenario ? Date.parse(SCENARIO_CLOCK[scenario]) : null;
}

/**
 * "Now" for server-side decisions — which phase the event is in, what counts
 * as up next. The rehearsal's clock when one is running, the real one
 * otherwise.
 */
export function serverNow(): number {
  return demoNow() ?? Date.now();
}

/**
 * How far the rehearsal clock is from the real one, handed to the browser so
 * client-side countdowns agree with what the server rendered. Zero for real
 * visitors.
 */
export function clockOffsetMs(): number {
  const now = demoNow();
  return now === null ? 0 : now - Date.now();
}

// ------------------------------------------------------------- scores ----

/** Rough minutes a game takes, to decide what is finished at a given time. */
const DURATION_MIN: Record<string, number> = {
  football: 25,
  basketball: 30,
  netball: 30,
  volleyball: 30,
  frisbee: 40,
  badminton: 30,
  "table-tennis": 30,
  pickleball: 20,
};

/** The most a rehearsed game runs over its slot, in minutes. */
const OVERRUN_MAX_MIN = 6;

/**
 * One game that kicks off late, so a rehearsal has a court running behind:
 * netball's 3rd-place game, ten minutes late. At midday it has just started,
 * and the final after it on the same court shows as late.
 */
const LATE_STARTS: { sport: string; stage: Fixture["stage"]; at: string; minutes: number }[] = [
  { sport: "netball", stage: "third_place", at: "13:00", minutes: 10 },
];

function lateStartMin(f: Fixture): number {
  return (
    LATE_STARTS.find(
      (l) => l.sport === f.sportSlug && l.stage === f.stage && l.at === formatTime(f.scheduledTime),
    )?.minutes ?? 0
  );
}

/** FNV-1a: stable per fixture, so a rehearsal shows the same results every time. */
function hash(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick(seed: string, min: number, max: number): number {
  return min + (hash(seed) % (max - min + 1));
}

/** Sports scored in sets or games, where the winner's total is fixed. */
const RACE_TO: Record<string, number> = {
  volleyball: 2,
  badminton: 2,
  "table-tennis": 3,
  pickleball: 11,
};

const RANGE: Record<string, [number, number]> = {
  football: [0, 4],
  basketball: [28, 62],
  netball: [12, 34],
  frisbee: [6, 15],
};

/**
 * A believable final score. Knockouts never end level; group games in sports
 * that allow it sometimes do.
 */
function finalScore(f: Fixture): [number, number] {
  const race = RACE_TO[f.sportSlug];
  if (race !== undefined) {
    const loser =
      f.sportSlug === "pickleball" ? pick(`${f.id}l`, 4, 9) : pick(`${f.id}l`, 0, race - 1);
    return hash(`${f.id}w`) % 2 === 0 ? [race, loser] : [loser, race];
  }
  const [min, max] = RANGE[f.sportSlug] ?? [0, 4];
  let a = pick(`${f.id}a`, min, max);
  let b = pick(`${f.id}b`, min, max);
  if (a === b && f.stage !== "group") {
    if (hash(`${f.id}t`) % 2 === 0) a += 1;
    else b += 1;
  }
  return [a, b];
}

/** The same score scaled back to how far through the game we are. */
function liveScore(f: Fixture, progress: number): [number, number] {
  const [a, b] = finalScore(f);
  if (RACE_TO[f.sportSlug] !== undefined && f.sportSlug !== "pickleball") {
    // Sets: show the match one set short of finished.
    return [Math.min(a, 1), Math.min(b, 1)];
  }
  return [Math.floor(a * progress), Math.floor(b * progress)];
}

// ----------------------------------------------------------- progress ----

export type DemoMeta = {
  groups: (GroupMeta & { sportSlug: string })[];
  teams: (TeamMeta & { sportSlug: string })[];
};

/**
 * Plays the tournament forward to the scenario's clock: every game that has
 * ended gets a result, every game in progress a partial score, and knockout
 * slots fill in as their feeders finish. Walks fixtures in kick-off order so
 * each result is available to everything scheduled after it.
 */
export function applyDemo(fixtures: readonly Fixture[], meta: DemoMeta): Fixture[] {
  const now = demoNow();
  if (now === null) return [...fixtures];

  const played: Fixture[] = [];
  const ordered = [...fixtures].sort(byKickoff);
  const slot = slotLengths(fixtures);
  // When each court is next free: a late start or an overrun pushes the
  // games after it, the way it would on the day.
  const courtFree = new Map<string, number>();

  for (const original of ordered) {
    let f: Fixture = { ...original };

    // Fill knockout slots the way a coordinator would on the day. Never the
    // team already in the other slot: the database refuses a team playing
    // itself, and a slot a coordinator filled by hand (in a dry run, say)
    // can disagree with what the rehearsed results say.
    if (f.teamAId === null) {
      const team = resolveSlot(f.teamA, f, played, meta.groups, meta.teams);
      if (team && team.id !== f.teamBId) f = { ...f, teamAId: team.id, teamA: team.name };
    }
    if (f.teamBId === null) {
      const team = resolveSlot(f.teamB, f, played, meta.groups, meta.teams);
      if (team && team.id !== f.teamAId) f = { ...f, teamBId: team.id, teamB: team.name };
    }

    const ready = f.teamAId !== null && f.teamBId !== null;
    const key = courtKey(f);
    const start = Math.max(
      Date.parse(f.scheduledTime) + lateStartMin(f) * 60_000,
      courtFree.get(key) ?? -Infinity,
    );
    // Its slot, plus the few minutes real games run over — warm-ups, a long
    // final set, swapping teams. Last year's volleyball sheet slipped 3–10
    // minutes a game and finished an hour late; a rehearsal that ran to the
    // minute would hide everything the delay screens are for.
    const length =
      Math.min(
        (previewDurationMin(f) ?? DURATION_MIN[f.sportSlug] ?? 30) * 60_000,
        slot.get(f.id) ?? Infinity,
      ) +
      pick(`${f.id}o`, 0, OVERRUN_MAX_MIN) * 60_000;
    const end = start + length;
    const iso = (ms: number) => new Date(ms).toISOString();

    // A rehearsal invents its own day: whatever timings the real database
    // holds from a dry run do not belong in it.
    f = { ...f, plannedStart: null, startedAt: null, finishedAt: null };
    if (!ready || now < start) {
      f = { ...f, status: "upcoming", scoreA: null, scoreB: null };
    } else if (now >= end) {
      const [a, b] = finalScore(f);
      f = { ...f, status: "finished", scoreA: a, scoreB: b, startedAt: iso(start), finishedAt: iso(end) };
    } else {
      const [a, b] = liveScore(f, (now - start) / (end - start));
      f = { ...f, status: "live", scoreA: a, scoreB: b, startedAt: iso(start) };
    }
    if (ready) courtFree.set(key, end);

    f = { ...f, updatedAt: iso(Math.min(now, end)) };
    played.push(f);
  }

  // Hand back in the caller's original order.
  const byId = new Map(played.map((f) => [f.id, f]));
  return fixtures.map((f) => byId.get(f.id)!);
}

// ------------------------------------------------------- announcements ----

type DemoAnnouncement = {
  id: string;
  type: AnnouncementType;
  title: string;
  body: string | null;
  publishedAt: string;
};

const SCRIPT: Record<
  DemoScenario,
  { minutesAgo: number; type: AnnouncementType; title: string; body: string | null }[]
> = {
  eve: [
    {
      minutesAgo: 90,
      type: "notice",
      title: "See you tomorrow",
      body: "Doors open at 08:30. Find your team's first game on the Schedule page.",
    },
  ],
  morning: [
    {
      minutesAgo: 10,
      type: "notice",
      title: "Doors are open",
      body: "Collect your wristband at reception — it gets you into both venues all day.",
    },
  ],
  midday: [
    {
      minutesAgo: 6,
      type: "delay",
      title: "Basketball semi-final 2 starts 10 min late",
      body: "Court 2 at Trinity is running behind after the first semi went the distance.",
    },
    {
      minutesAgo: 38,
      type: "schedule",
      title: "Netball semi-finals both on Court 3",
      body: "Back to back at Trinity — 13:10 and 13:40.",
    },
    {
      minutesAgo: 95,
      type: "result",
      title: "Group stages complete",
      body: "Every group game is in. Knockout brackets are filled in on the Standings page.",
    },
    {
      minutesAgo: 260,
      type: "notice",
      title: "Doors are open",
      body: "Collect your wristband at reception — it gets you into both venues all day.",
    },
  ],
  post: [
    {
      minutesAgo: 70,
      type: "result",
      title: "That's a wrap — thank you, Manchester",
      body: "Every final is in. Medals and champions are on the home page.",
    },
    {
      minutesAgo: 140,
      type: "notice",
      title: "Medal ceremony at 17:15 in Trinity Main Hall",
      body: null,
    },
  ],
};

export function demoAnnouncements(): DemoAnnouncement[] | null {
  const scenario = demoScenario();
  const now = demoNow();
  if (!scenario || now === null) return null;
  return SCRIPT[scenario].map((a, i) => ({
    id: `demo-${scenario}-${i}`,
    type: a.type,
    title: a.title,
    body: a.body,
    publishedAt: new Date(now - a.minutesAgo * 60_000).toISOString(),
  }));
}
