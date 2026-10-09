import "server-only";

import { byKickoff, stageLabel, type Fixture } from "@/lib/fixtures";
import type { PickerTeam } from "@/lib/queries";
import type { GroupMeta, TeamMeta } from "@/lib/standings";
import type { FixtureStage } from "@/lib/supabase/types";

/**
 * A tournament set up differently from the one in the database, swapped in on
 * the way out of the query layer the way the matchday rehearsal is — to see a
 * format on the real site before committing to it.
 *
 *   MGAMES_PREVIEW=football-2025 npm run dev
 *
 * Add a rehearsal to watch it played (MGAMES_DEMO=midday). Nothing is written
 * to Supabase, and like the rehearsal it is off on every Vercel deployment
 * whatever the environment says.
 *
 *   football-2025 — MGames 2025's football, from the committee's sheet: 24
 *   teams in six groups of four on three pitches; the top two of each group
 *   and the four best third-placed teams into a round of 16; then
 *   quarter-finals, semi-finals, a 3rd-place game and the final.
 *
 * Three liberties with the sheet. Its unnamed "TEAM NAME" is "Team TBC". The
 * two sides both called WMSAFC are "WMSAFC A" (Group C) and "WMSAFC B"
 * (Group F), since one name for two teams would be one team on a website.
 * Nosky FC, listed in Group C's table but in none of its games, is left out.
 * The knockout labels say the same things in the site's words, with each
 * round numbered in kick-off order, Pitch A before Pitch B: the sheet's
 * round-of-16 game 5 (11:45, Pitch B) is "R16 2" here. Every pairing is the
 * sheet's.
 */
type Preview = "football-2025";

export function previewName(): Preview | null {
  if (process.env.VERCEL) return null;
  return process.env.MGAMES_PREVIEW === "football-2025" ? "football-2025" : null;
}

const GROUPS: Record<string, string[]> = {
  A: ["Santai FC", "Pernu & friends", "WAVES FC", "MCCH FC"],
  B: ["SOTONG FC", "Prime Ballerz", "Bosku FC", "KMGooners (KMG)"],
  C: ["6ola6oys", "Vesagan United", "Projek Satria", "WMSAFC A"],
  D: ["Team TBC", "UWEMSA X CRONYISM", "6eer6elly FC", "Hameediyah CF"],
  E: ["Muiz.PDFC", "AFM", "Westway FC", "MSS LLboro"],
  F: ["Blades Blokes FC", "2Chainz FC", "UWE Msa", "WMSAFC B"],
};

type Pitch = "A" | "B" | "S";

const PITCH: Record<Pitch, { courtName: string; venueSlug: string; venueShortName: string }> = {
  A: { courtName: "Pitch A", venueSlug: "trinity", venueShortName: "Trinity" },
  B: { courtName: "Pitch B", venueSlug: "trinity", venueShortName: "Trinity" },
  S: { courtName: "Pitch", venueSlug: "sugden", venueShortName: "Sugden" },
};

/** Kick-off, pitch, group, and the two teams, as the sheet has them. */
const GROUP_GAMES: [string, Pitch, string, string, string][] = [
  ["08:30", "A", "A", "Santai FC", "Pernu & friends"],
  ["08:45", "A", "A", "WAVES FC", "MCCH FC"],
  ["09:00", "A", "A", "Santai FC", "WAVES FC"],
  ["09:15", "A", "A", "Pernu & friends", "MCCH FC"],
  ["09:30", "A", "A", "Pernu & friends", "WAVES FC"],
  ["09:45", "A", "A", "Santai FC", "MCCH FC"],
  ["10:00", "A", "B", "SOTONG FC", "Prime Ballerz"],
  ["10:15", "A", "B", "Bosku FC", "KMGooners (KMG)"],
  ["10:30", "A", "B", "SOTONG FC", "Bosku FC"],
  ["10:45", "A", "B", "Prime Ballerz", "KMGooners (KMG)"],
  ["11:00", "A", "B", "Prime Ballerz", "Bosku FC"],
  ["11:15", "A", "B", "SOTONG FC", "KMGooners (KMG)"],

  ["08:30", "B", "C", "6ola6oys", "Vesagan United"],
  ["08:45", "B", "C", "Projek Satria", "WMSAFC A"],
  ["09:00", "B", "C", "6ola6oys", "Projek Satria"],
  ["09:15", "B", "C", "Vesagan United", "WMSAFC A"],
  ["09:30", "B", "C", "Vesagan United", "Projek Satria"],
  ["09:45", "B", "C", "6ola6oys", "WMSAFC A"],
  ["10:00", "B", "D", "Team TBC", "UWEMSA X CRONYISM"],
  ["10:15", "B", "D", "6eer6elly FC", "Hameediyah CF"],
  ["10:30", "B", "D", "Team TBC", "6eer6elly FC"],
  ["10:45", "B", "D", "UWEMSA X CRONYISM", "Hameediyah CF"],
  ["11:00", "B", "D", "UWEMSA X CRONYISM", "6eer6elly FC"],
  ["11:15", "B", "D", "Team TBC", "Hameediyah CF"],

  ["08:30", "S", "E", "Muiz.PDFC", "AFM"],
  ["08:45", "S", "E", "Westway FC", "MSS LLboro"],
  ["09:00", "S", "E", "Muiz.PDFC", "Westway FC"],
  ["09:15", "S", "E", "AFM", "MSS LLboro"],
  ["09:30", "S", "E", "AFM", "Westway FC"],
  ["09:45", "S", "E", "Muiz.PDFC", "MSS LLboro"],
  ["10:00", "S", "F", "Blades Blokes FC", "2Chainz FC"],
  ["10:15", "S", "F", "UWE Msa", "WMSAFC B"],
  ["10:30", "S", "F", "Blades Blokes FC", "UWE Msa"],
  ["10:45", "S", "F", "2Chainz FC", "WMSAFC B"],
  ["11:00", "S", "F", "2Chainz FC", "UWE Msa"],
  ["11:15", "S", "F", "Blades Blokes FC", "WMSAFC B"],
];

/**
 * Kick-off, pitch, round, and the two slots. The sheet's own labels, for
 * checking against it: R16 games 1–8 are its games 1, 5, 2, 6, 3, 7, 4, 8;
 * QF1–4 its rounds 1, 3, 2, 4.
 */
const KNOCKOUTS: [string, Pitch, FixtureStage, string, string][] = [
  ["11:45", "A", "round_of_16", "Group A winner", "Best 3rd (3)"], //       1: Winner A v 3rd place (3)
  ["11:45", "B", "round_of_16", "Group A runner-up", "Group C runner-up"], // 5: Runner Up A v Runner Up C
  ["12:05", "A", "round_of_16", "Group B winner", "Best 3rd (1)"], //       2: Winner B v 3rd place (1)
  ["12:05", "B", "round_of_16", "Group B runner-up", "Best 3rd (4)"], //    6: Runner Up B v 3rd place (4)
  ["12:25", "A", "round_of_16", "Group C winner", "Group D runner-up"], //  3: Winner C v Runner Up D
  ["12:25", "B", "round_of_16", "Group E winner", "Group F runner-up"], //  7: Winner E v Runner Up F
  ["12:45", "A", "round_of_16", "Group D winner", "Best 3rd (2)"], //       4: Winner D v 3rd place (2)
  ["12:45", "B", "round_of_16", "Group F winner", "Group E runner-up"], //  8: Winner F v Runner Up E

  ["13:10", "A", "quarterfinal", "Winner R16 1", "Winner R16 6"], // R1: Winner 1 v Winner 7
  ["13:10", "B", "quarterfinal", "Winner R16 5", "Winner R16 2"], // R3: Winner 3 v Winner 5
  ["13:30", "A", "quarterfinal", "Winner R16 3", "Winner R16 8"], // R2: Winner 2 v Winner 8
  ["13:30", "B", "quarterfinal", "Winner R16 7", "Winner R16 4"], // R4: Winner 4 v Winner 6

  ["14:30", "A", "semifinal", "Winner QF1", "Winner QF3"], // Winner R1 v Winner R2
  ["14:55", "A", "semifinal", "Winner QF2", "Winner QF4"], // Winner R3 v Winner R4

  ["15:20", "A", "third_place", "Loser SF1", "Loser SF2"],
  ["15:45", "A", "final", "Winner SF1", "Winner SF2"],
];

/** Minutes a game lasts, from the sheet's halves: 6-1-6, 7-1-7, 8-2-8 and 10-2-10. */
const DURATION_MIN: Partial<Record<FixtureStage, number>> = {
  group: 13,
  round_of_16: 15,
  quarterfinal: 15,
  semifinal: 18,
  third_place: 22,
  final: 22,
};

const ID_PREFIX = "fb25-";

function slug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * A UK kick-off on the day, written the way the database writes times (UTC,
 * "+00:00"), so preview games sit among the real ones exactly as stored ones would.
 */
function kickoff(time: string): string {
  return new Date(`2026-10-24T${time}:00+01:00`).toISOString().replace(".000Z", "+00:00");
}

const teamId = (name: string) => `${ID_PREFIX}${slug(name)}`;
const groupId = (letter: string) => `${ID_PREFIX}group-${letter.toLowerCase()}`;

type FootballMeta = Pick<
  Fixture,
  | "categoryId"
  | "categoryName"
  | "categorySlug"
  | "sportId"
  | "sportSlug"
  | "sportName"
  | "sportCode"
  | "sportColor"
  | "sportOrder"
>;

function previewFixtures(meta: FootballMeta): Fixture[] {
  let n = 0;
  const game = (time: string, pitch: Pitch, stage: FixtureStage) => {
    n += 1;
    return {
      id: `${ID_PREFIX}${String(n).padStart(2, "0")}`,
      stage,
      stageLabel: stageLabel(stage),
      status: "upcoming" as const,
      scheduledTime: kickoff(time),
      updatedAt: "2026-10-01T12:00:00+01:00",
      scoreA: null,
      scoreB: null,
      ...meta,
      ...PITCH[pitch],
      courtId: null,
      startedAt: null,
      finishedAt: null,
      plannedStart: null,
    };
  };

  return [
    ...GROUP_GAMES.map(([time, pitch, group, a, b]) => ({
      ...game(time, pitch, "group"),
      teamAId: teamId(a),
      teamBId: teamId(b),
      teamA: a,
      teamB: b,
      slotA: null,
      slotB: null,
      groupId: groupId(group),
      groupName: `Group ${group}`,
    })),
    ...KNOCKOUTS.map(([time, pitch, stage, a, b]) => ({
      ...game(time, pitch, stage),
      teamAId: null,
      teamBId: null,
      teamA: a,
      teamB: b,
      slotA: a,
      slotB: b,
      groupId: null,
      groupName: null,
    })),
  ];
}

/** Football's fixtures swapped for the preview's, kept in the database's kick-off order. */
export function applyPreviewFixtures(fixtures: Fixture[]): Fixture[] {
  if (!previewName()) return fixtures;
  // Borrow the real sport and category, so the preview slots in where football already is.
  const real = fixtures.find((f) => f.sportSlug === "football");
  if (!real) return fixtures;
  const meta: FootballMeta = {
    categoryId: real.categoryId,
    categoryName: real.categoryName,
    categorySlug: real.categorySlug,
    sportId: real.sportId,
    sportSlug: real.sportSlug,
    sportName: real.sportName,
    sportCode: real.sportCode,
    sportColor: real.sportColor,
    sportOrder: real.sportOrder,
  };
  return [...fixtures.filter((f) => f.sportSlug !== "football"), ...previewFixtures(meta)].sort(
    byKickoff,
  );
}

export function applyPreviewStandings(data: {
  groups: (GroupMeta & { sportSlug: string })[];
  teams: (TeamMeta & { sportSlug: string })[];
}): typeof data {
  if (!previewName()) return data;
  const categoryId = data.groups.find((g) => g.sportSlug === "football")?.categoryId;
  if (!categoryId) return data;
  return {
    groups: [
      ...data.groups.filter((g) => g.sportSlug !== "football"),
      ...Object.keys(GROUPS).map((letter, i) => ({
        id: groupId(letter),
        name: `Group ${letter}`,
        sortOrder: i + 1,
        categoryId,
        sportSlug: "football",
      })),
    ],
    teams: [
      ...data.teams.filter((t) => t.sportSlug !== "football"),
      ...Object.entries(GROUPS).flatMap(([letter, names]) =>
        names.map((name) => ({ id: teamId(name), name, groupId: groupId(letter), sportSlug: "football" })),
      ),
    ],
  };
}

export function applyPreviewTeams(teams: PickerTeam[]): PickerTeam[] {
  if (!previewName()) return teams;
  const sample = teams.find((t) => t.sportSlug === "football");
  if (!sample) return teams;
  const football = Object.values(GROUPS)
    .flat()
    .map((name) => ({ ...sample, id: teamId(name), name }));
  return [...teams.filter((t) => t.sportSlug !== "football"), ...football].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
}

/** How long a preview game lasts, for a rehearsal deciding what has finished. */
export function previewDurationMin(f: Fixture): number | null {
  if (!previewName() || !f.id.startsWith(ID_PREFIX)) return null;
  return DURATION_MIN[f.stage] ?? null;
}
