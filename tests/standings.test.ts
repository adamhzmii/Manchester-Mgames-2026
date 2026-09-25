import assert from "node:assert/strict";
import { test } from "node:test";

import type { Fixture } from "../src/lib/fixtures.ts";
import { computeStandings, type GroupMeta, type TeamMeta } from "../src/lib/standings.ts";

const GROUP: GroupMeta = { id: "g1", name: "Group A", sortOrder: 1, categoryId: "c1" };

const TEAMS: TeamMeta[] = [
  { id: "kl", name: "KL Tigers", groupId: "g1" },
  { id: "mel", name: "Melaka Mariners", groupId: "g1" },
  { id: "ked", name: "Kedah Eagles", groupId: "g1" },
  { id: "per", name: "Perak Bison", groupId: "g1" },
];

let seq = 0;

function match(
  a: string,
  b: string,
  scoreA: number | null,
  scoreB: number | null,
  overrides: Partial<Fixture> = {},
): Fixture {
  seq += 1;
  return {
    id: `m${seq}`,
    stage: "group",
    stageLabel: "Group",
    status: "finished",
    scheduledTime: "2026-10-24T09:00:00Z",
    updatedAt: "2026-10-24T09:00:00Z",
    scoreA,
    scoreB,
    teamAId: a,
    teamBId: b,
    teamA: a,
    teamB: b,
    groupId: "g1",
    categoryId: "c1",
    categoryName: "Open",
    categorySlug: "open",
    sportId: "s1",
    sportSlug: "football",
    sportName: "Football",
    sportCode: "FB",
    sportColor: "#3C2A6E",
    sportOrder: 1,
    courtName: "Court 1",
    venueSlug: "sugden",
    venueShortName: "Sugden",
    ...overrides,
  };
}

/** The seeded Football Group A round robin. */
function footballGroupA(): Fixture[] {
  return [
    match("kl", "mel", 3, 1),
    match("ked", "per", 2, 1),
    match("kl", "ked", 2, 0),
    match("mel", "per", 1, 1),
    match("kl", "per", 1, 0),
    match("mel", "ked", 2, 0),
  ];
}

test("football tables use three points for a win", () => {
  const [group] = computeStandings(footballGroupA(), [GROUP], TEAMS, "football");
  assert.deepEqual(
    group.rows.map((r) => [r.teamName, r.played, r.won, r.drawn, r.lost, r.points]),
    [
      ["KL Tigers", 3, 3, 0, 0, 9],
      ["Melaka Mariners", 3, 1, 1, 1, 4],
      ["Kedah Eagles", 3, 1, 0, 2, 3],
      ["Perak Bison", 3, 0, 1, 2, 1],
    ],
  );
});

test("court sports use two points for a win", () => {
  const [group] = computeStandings(footballGroupA(), [GROUP], TEAMS, "basketball");
  const kl = group.rows.find((r) => r.teamName === "KL Tigers")!;
  assert.equal(kl.points, 6);
});

test("the top two of a group are flagged as qualifying", () => {
  const [group] = computeStandings(footballGroupA(), [GROUP], TEAMS, "football");
  assert.deepEqual(
    group.rows.map((r) => r.qualifying),
    [true, true, false, false],
  );
  assert.deepEqual(
    group.rows.map((r) => r.position),
    [1, 2, 3, 4],
  );
});

test("nobody is flagged as qualifying before a group has been played", () => {
  // Every team level on zero, so the sort order is alphabetical. Marking the
  // first two "Q" would tell a team it had qualified on the strength of its
  // name — which is exactly what the table looked like on a pre-event reset.
  const [group] = computeStandings([], [GROUP], TEAMS, "football");
  assert.deepEqual(
    group.rows.map((r) => r.qualifying),
    [false, false, false, false],
  );
});

test("a team level with the one below the cut is not yet qualifying", () => {
  const teams: TeamMeta[] = [
    { id: "a", name: "Alpha", groupId: "g1" },
    { id: "b", name: "Bravo", groupId: "g1" },
    { id: "c", name: "Charlie", groupId: "g1" },
    { id: "d", name: "Delta", groupId: "g1" },
  ];
  // Alpha wins clearly; Bravo and Charlie are dead level on every tiebreaker,
  // so second place is still open between them.
  const fixtures = [
    match("a", "d", 3, 0),
    match("b", "d", 1, 0),
    match("c", "d", 1, 0),
  ];

  const [group] = computeStandings(fixtures, [GROUP], teams, "football");
  const byName = Object.fromEntries(group.rows.map((r) => [r.teamName, r.qualifying]));
  assert.equal(byName["Alpha"], true, "a clear leader has earned its place");
  assert.equal(byName["Bravo"], false, "tied with Charlie, so undecided");
  assert.equal(byName["Charlie"], false);
});

test("a live match is not counted until it finishes", () => {
  const fixtures = footballGroupA();
  // Perak are thrashing KL, but it is still in progress.
  fixtures.push(match("per", "kl", 5, 0, { status: "live" }));

  const [group] = computeStandings(fixtures, [GROUP], TEAMS, "football");
  const perak = group.rows.find((r) => r.teamName === "Perak Bison")!;
  assert.equal(perak.played, 3, "an in-progress match must not add to played");
  assert.equal(perak.points, 1);
});

test("score difference breaks a tie on points", () => {
  const teams: TeamMeta[] = [
    { id: "a", name: "Alpha", groupId: "g1" },
    { id: "b", name: "Bravo", groupId: "g1" },
    { id: "c", name: "Charlie", groupId: "g1" },
  ];
  // Alpha and Bravo both beat Charlie once; Bravo did it by more.
  const fixtures = [match("a", "c", 1, 0), match("b", "c", 5, 0)];

  const [group] = computeStandings(fixtures, [GROUP], teams, "football");
  assert.deepEqual(
    group.rows.map((r) => r.teamName),
    ["Bravo", "Alpha", "Charlie"],
  );
  assert.equal(group.rows[0].scoreDifference, 5);
});

test("knockout fixtures never reach the group table", () => {
  const fixtures = [
    ...footballGroupA(),
    match("kl", "mel", 4, 0, { stage: "final", stageLabel: "Final", groupId: null }),
  ];
  const [group] = computeStandings(fixtures, [GROUP], TEAMS, "football");
  const kl = group.rows.find((r) => r.teamName === "KL Tigers")!;
  assert.equal(kl.played, 3);
});

test("a sport with no groups produces no tables", () => {
  assert.deepEqual(computeStandings([], [], [], "badminton"), []);
});

test("teams appear with a played count of zero before any results", () => {
  const [group] = computeStandings([], [GROUP], TEAMS, "football");
  assert.equal(group.rows.length, 4);
  assert.deepEqual(
    group.rows.map((r) => r.played),
    [0, 0, 0, 0],
  );
});
