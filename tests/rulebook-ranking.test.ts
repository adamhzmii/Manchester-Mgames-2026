import assert from "node:assert/strict";
import { test } from "node:test";

import type { Fixture } from "../src/lib/fixtures.ts";
import { winningSide } from "../src/lib/matchday.ts";
import { resolveSlot } from "../src/lib/progression.ts";
import { bestPlaceTable, computeStandings, teamForm, type TeamMeta } from "../src/lib/standings.ts";
import { fixture, played } from "./helpers.ts";

// The rulebook's group rankings (General Rules H.7–H.10), one rule a test.

const GROUP = { id: "g", name: "Group A", sortOrder: 1, categoryId: "c-football" };
const team = (id: string, name: string, groupId = "g"): TeamMeta => ({ id, name, groupId });
const A = ["a", "Alpha"] as [string, string];
const B = ["b", "Bravo"] as [string, string];
const C = ["c", "Charlie"] as [string, string];
const D = ["d", "Delta"] as [string, string];
const FOUR = [team("a", "Alpha"), team("b", "Bravo"), team("c", "Charlie"), team("d", "Delta")];

const game = (x: [string, string], y: [string, string], sx: number, sy: number, more: Partial<Fixture> = {}) =>
  played(x, y, sx, sy, { groupId: "g", ...more });

const order = (fixtures: Fixture[], sport = "football", teams = FOUR) =>
  computeStandings(fixtures, [GROUP], teams, sport)[0].rows.map((r) => r.teamName);

test("two level on points: the game between them decides, before score difference", () => {
  // Alpha beat Bravo 1–0; Bravo won its other games by far more.
  const fixtures = [game(A, B, 1, 0), game(B, C, 6, 0), game(A, C, 0, 1), game(B, D, 5, 0), game(A, D, 1, 0), game(C, D, 0, 0)];
  // Alpha and Bravo both have 6 points; Bravo's difference is far better.
  assert.deepEqual(order(fixtures).slice(0, 2), ["Alpha", "Bravo"]);
});

test("two level who drew with each other go to forfeits, then difference, then scored", () => {
  const fixtures = [game(A, B, 1, 1), game(A, C, 2, 0), game(B, C, 1, 0), game(A, D, 0, 1), game(B, D, 0, 1)];
  // Alpha and Bravo: 4 points each, drew; Alpha's difference is better (+1 v 0).
  assert.deepEqual(order(fixtures).slice(1, 3), ["Alpha", "Bravo"]);
});

test("three level: a mini-table of their games, then the two still level by their own game", () => {
  // Alpha, Bravo and Charlie each beat Delta and one another in a cycle: 6
  // points each, 3 each among themselves. Mini difference is 0 for all;
  // mini scored puts Charlie (1) third behind Alpha and Bravo (2 each); those
  // two are still level, and Alpha beat Bravo, so Alpha is first.
  const fixtures = [
    game(A, B, 2, 1), game(C, A, 1, 0), game(B, C, 1, 0),
    game(A, D, 1, 0), game(B, D, 1, 0), game(C, D, 1, 0),
  ];
  assert.deepEqual(order(fixtures).slice(0, 3), ["Alpha", "Bravo", "Charlie"]);
});

test("a forfeit gives the points but none of the score, and counts against the team", () => {
  const fixtures = [
    // Delta did not turn up against Alpha: 0–0, Alpha wins by forfeit.
    game(A, D, 0, 0, { forfeit: "b" }),
    game(B, C, 1, 0),
  ];
  const [table] = computeStandings(fixtures, [GROUP], FOUR, "football");
  const alpha = table.rows.find((r) => r.teamName === "Alpha")!;
  const delta = table.rows.find((r) => r.teamName === "Delta")!;
  assert.equal(alpha.points, 3);
  assert.equal(alpha.won, 1);
  assert.equal(alpha.scoreDifference, 0, "a forfeit adds nothing to score difference");
  assert.equal(delta.forfeits, 1);
  assert.equal(delta.lost, 1);
  assert.equal(winningSide(fixtures[0]), "a");
});

test("fewer forfeits ranks higher before score difference", () => {
  // Alpha and Bravo: 3 points each, never met. Alpha's came by forfeit from
  // Charlie; Bravo beat Delta 5–0 but was in a double forfeit with Charlie.
  // Bravo's difference is far better, but it has a forfeit and Alpha has none.
  const fixtures = [
    game(A, C, 0, 0, { forfeit: "b" }),
    game(B, D, 5, 0),
    game(B, C, 0, 0, { forfeit: "both" }),
  ];
  assert.deepEqual(order(fixtures).slice(0, 2), ["Alpha", "Bravo"]);
});

test("a double forfeit: no winner, no points, a forfeit and a loss each", () => {
  const f = game(A, B, 0, 0, { forfeit: "both" });
  const [table] = computeStandings([f], [GROUP], FOUR, "football");
  for (const name of ["Alpha", "Bravo"]) {
    const row = table.rows.find((r) => r.teamName === name)!;
    assert.deepEqual([row.points, row.lost, row.forfeits], [0, 1, 1]);
  }
  assert.equal(winningSide(f), null);
  assert.deepEqual(teamForm([f], "a"), ["L"]);
});

test("level on everything: the Head of Sport decides — no tick, no suggestion", () => {
  const three = [team("a", "Alpha"), team("b", "Bravo"), team("c", "Charlie")];
  // A cycle with identical scores: nothing separates anyone.
  const fixtures = [game(A, B, 1, 0), game(B, C, 1, 0), game(C, A, 1, 0)];
  const [table] = computeStandings(fixtures, [GROUP], three, "football");
  assert.ok(table.rows.every((r) => r.unresolved));
  assert.ok(table.rows.every((r) => !r.qualifying));
  const semi = fixture({ stage: "semifinal", teamAId: null, teamBId: null });
  const groups = [{ ...GROUP, sportSlug: "football" }];
  const teams = three.map((t) => ({ ...t, sportSlug: "football" }));
  assert.equal(resolveSlot("Group A winner", semi, fixtures, groups, teams), null);
});

test("a tie entirely inside the qualifying places still ticks both", () => {
  // Alpha and Bravo dead level at the top, both clear of Charlie and Delta.
  const fixtures = [
    game(A, B, 1, 1),
    game(A, C, 1, 0), game(B, C, 1, 0),
    game(A, D, 1, 0), game(B, D, 1, 0),
    game(C, D, 0, 0),
  ];
  const [table] = computeStandings(fixtures, [GROUP], FOUR, "football");
  assert.deepEqual(table.rows.slice(0, 2).map((r) => [r.teamName, r.unresolved, r.qualifying]), [
    ["Alpha", true, true],
    ["Bravo", true, true],
  ]);
});

test("table tennis stops at the games between them: rally points are not recorded", () => {
  // Alpha and Bravo level on points, drew nothing (no draws in table tennis),
  // never met; Alpha's game difference overall is better — but table tennis
  // goes to head-to-head rally points before overall difference.
  const fixtures = [game(A, C, 2, 0), game(B, D, 2, 1)];
  const [table] = computeStandings(fixtures, [GROUP], FOUR, "table-tennis");
  const top = table.rows.slice(0, 2);
  assert.deepEqual(top.map((r) => r.unresolved), [true, true]);
});

test("pickleball and badminton use the same order as football", () => {
  const fixtures = [game(A, C, 15, 3), game(B, D, 15, 13)];
  assert.deepEqual(order(fixtures, "pickleball").slice(0, 2), ["Alpha", "Bravo"]);
  assert.deepEqual(order(fixtures, "badminton").slice(0, 2), ["Alpha", "Bravo"]);
});

test("across groups, fewer forfeits beats a better difference", () => {
  const g2 = { id: "h", name: "Group B", sortOrder: 2, categoryId: "c-football" };
  const teams = [team("a", "Alpha"), team("b", "Bravo"), team("x", "Xray", "h"), team("y", "Yankee", "h")];
  const fixtures = [
    // Group A: Alpha wins by forfeit and Bravo forfeited — Bravo is 2nd on 0.
    game(A, B, 0, 0, { forfeit: "b" }),
    // Group B: Xray beats Yankee 5–0 — Yankee 2nd on 0, no forfeits.
    played(["x", "Xray"], ["y", "Yankee"], 5, 0, { groupId: "h" }),
    // Best runner-up slot, so runners-up are ranked across groups.
    fixture({ stage: "semifinal", slotA: "Group A winner", slotB: "Best 2nd (1)", teamAId: null, teamBId: null }),
    fixture({ stage: "semifinal", slotA: "Group B winner", slotB: "Group A runner-up", teamAId: null, teamBId: null }),
  ];
  const tables = computeStandings(fixtures, [GROUP, g2], teams, "football");
  const best = bestPlaceTable(tables);
  assert.equal(best?.rows[0].teamName, "Yankee", "Bravo's forfeit puts it behind, despite a better difference");
});
