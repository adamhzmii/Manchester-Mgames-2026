import type { Fixture } from "../src/lib/fixtures.ts";

let seq = 0;

/** A fixture with sensible defaults; override only what a test is about. */
export function fixture(overrides: Partial<Fixture> = {}): Fixture {
  seq += 1;
  return {
    id: `f${seq}`,
    stage: "group",
    stageLabel: "Group",
    status: "upcoming",
    scheduledTime: "2026-10-24T09:00:00+01:00",
    updatedAt: "2026-10-24T08:00:00+01:00",
    scoreA: null,
    scoreB: null,
    teamAId: "a",
    teamBId: "b",
    teamA: "Team A",
    teamB: "Team B",
    slotA: null,
    slotB: null,
    groupId: null,
    groupName: null,
    categoryId: "c-football",
    categoryName: "Open",
    categorySlug: "open",
    sportId: "s-football",
    sportSlug: "football",
    sportName: "Football",
    sportCode: "FB",
    sportColor: "#3C2A6E",
    sportOrder: 1,
    courtId: "court-1",
    courtName: "Court 1",
    venueSlug: "sugden",
    venueShortName: "Sugden",
    startedAt: null,
    finishedAt: null,
    plannedStart: null,
    ...overrides,
  };
}

/** A finished game between two teams with the given score. */
export function played(
  a: [string, string],
  b: [string, string],
  scoreA: number,
  scoreB: number,
  overrides: Partial<Fixture> = {},
): Fixture {
  return fixture({
    teamAId: a[0],
    teamA: a[1],
    teamBId: b[0],
    teamB: b[1],
    scoreA,
    scoreB,
    status: "finished",
    ...overrides,
  });
}
