import "server-only";

import type { Fixture } from "@/lib/fixtures";
import { computeStandings, type GroupMeta, type TeamMeta } from "@/lib/standings";
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
 *   morning — 08:40, doors open, nothing started yet
 *   midday  — 13:20, groups done, semi-finals live
 *   post    — 18:00, every game played
 */
export type DemoScenario = "morning" | "midday" | "post";

const SCENARIO_CLOCK: Record<DemoScenario, string> = {
  morning: "2026-10-24T08:40:00+01:00",
  midday: "2026-10-24T13:20:00+01:00",
  post: "2026-10-24T18:00:00+01:00",
};

export function demoScenario(): DemoScenario | null {
  if (process.env.VERCEL) return null;
  const value = process.env.MGAMES_DEMO;
  return value === "morning" || value === "midday" || value === "post" ? value : null;
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

const GROUP_SLOT = /^Group ([A-Z]) (winner|runner-up|1st|2nd|3rd|4th)$/;
const SLOT_POSITION: Record<string, number> = {
  winner: 0,
  "1st": 0,
  "runner-up": 1,
  "2nd": 1,
  "3rd": 2,
  "4th": 3,
};
const SEMI_SLOT = /^(Winner|Loser) SF([12])$/;

function winnerOf(f: Fixture): { id: string; name: string } | null {
  if (f.status !== "finished" || f.scoreA === null || f.scoreB === null) return null;
  if (f.teamAId === null || f.teamBId === null || f.scoreA === f.scoreB) return null;
  return f.scoreA > f.scoreB
    ? { id: f.teamAId, name: f.teamA }
    : { id: f.teamBId, name: f.teamB };
}

function loserOf(f: Fixture): { id: string; name: string } | null {
  const winner = winnerOf(f);
  if (!winner) return null;
  return winner.id === f.teamAId
    ? { id: f.teamBId!, name: f.teamB }
    : { id: f.teamAId!, name: f.teamA };
}

/**
 * Fills a knockout slot the way a coordinator would on the day: group places
 * once the whole group has been played, semi-final results once the semi is
 * over. Returns null while the feeder is still undecided.
 */
function resolveSlot(
  label: string,
  fixture: Fixture,
  done: readonly Fixture[],
  meta: DemoMeta,
): { id: string; name: string } | null {
  const group = GROUP_SLOT.exec(label);
  if (group) {
    const [, letter, place] = group;
    const groupMeta = meta.groups.find(
      (g) => g.sportSlug === fixture.sportSlug && g.name === `Group ${letter}`,
    );
    if (!groupMeta) return null;
    const groupGames = done.filter((f) => f.groupId === groupMeta.id);
    if (groupGames.some((f) => f.status !== "finished")) return null;
    const [table] = computeStandings(
      groupGames,
      [groupMeta],
      meta.teams.filter((t) => t.sportSlug === fixture.sportSlug),
      fixture.sportSlug,
    );
    const row = table?.rows[SLOT_POSITION[place]];
    return row ? { id: row.teamId, name: row.teamName } : null;
  }

  const semi = SEMI_SLOT.exec(label);
  if (semi) {
    const [, outcome, number] = semi;
    const semis = done
      .filter((f) => f.categoryId === fixture.categoryId && f.stage === "semifinal")
      .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));
    const feeder = semis[Number(number) - 1];
    if (!feeder) return null;
    return outcome === "Winner" ? winnerOf(feeder) : loserOf(feeder);
  }

  return null;
}

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
  const ordered = [...fixtures].sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  for (const original of ordered) {
    let f: Fixture = { ...original };

    if (f.teamAId === null) {
      const team = resolveSlot(f.teamA, f, played, meta);
      if (team) f = { ...f, teamAId: team.id, teamA: team.name };
    }
    if (f.teamBId === null) {
      const team = resolveSlot(f.teamB, f, played, meta);
      if (team) f = { ...f, teamBId: team.id, teamB: team.name };
    }

    const start = Date.parse(f.scheduledTime);
    const minutes = DURATION_MIN[f.sportSlug] ?? 30;
    const end = start + minutes * 60_000;
    const ready = f.teamAId !== null && f.teamBId !== null;

    if (!ready || now < start) {
      f = { ...f, status: "upcoming", scoreA: null, scoreB: null };
    } else if (now >= end) {
      const [a, b] = finalScore(f);
      f = { ...f, status: "finished", scoreA: a, scoreB: b };
    } else {
      const [a, b] = liveScore(f, (now - start) / (end - start));
      f = { ...f, status: "live", scoreA: a, scoreB: b };
    }

    f = { ...f, updatedAt: new Date(Math.min(now, end)).toISOString() };
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
      body: "Every group game is in. Knockout brackets are now filled in on the Scores page.",
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
