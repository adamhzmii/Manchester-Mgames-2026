import assert from "node:assert/strict";
import { test } from "node:test";

import { describeFormat } from "../src/lib/tournament-format.ts";
import { fixture } from "./helpers.ts";

const footballGroups = [
  { id: "gA", name: "Group A", sortOrder: 1, categoryId: "c", sportSlug: "football" },
  { id: "gB", name: "Group B", sortOrder: 2, categoryId: "c", sportSlug: "football" },
];
const footballTeams = ["A", "B"].flatMap((g) =>
  [1, 2, 3, 4].map((n) => ({ id: `${g}${n}`, name: `${g}${n}`, groupId: `g${g}`, sportSlug: "football" })),
);

test("a grouped sport explains groups, points, qualifying and knockouts", () => {
  const fixtures = [
    fixture({ stage: "group", groupId: "gA" }),
    fixture({ stage: "semifinal" }),
    fixture({ stage: "third_place" }),
    fixture({ stage: "final" }),
  ];
  const format = describeFormat("football", fixtures, footballGroups, footballTeams);
  assert.equal(format.teams, 8);
  assert.deepEqual(format.lines, [
    "Two groups of 4, everyone plays everyone in their group.",
    "3 points for a win, 1 for a draw.",
    "Top 2 in each group go through to the semi-finals.",
    "Losing semi-finalists play off for third.",
  ]);
  assert.deepEqual(format.rounds, ["Semi-finals", "Final"]);
});

test("a single group says so, with the court sports' two points for a win", () => {
  const groups = [{ id: "g", name: "Group A", sortOrder: 1, categoryId: "c", sportSlug: "netball" }];
  const teams = [1, 2, 3, 4].map((n) => ({ id: `n${n}`, name: `n${n}`, groupId: "g", sportSlug: "netball" }));
  const fixtures = [
    fixture({ sportSlug: "netball", stage: "group", groupId: "g" }),
    fixture({ sportSlug: "netball", stage: "semifinal" }),
    fixture({ sportSlug: "netball", stage: "final" }),
  ];
  const format = describeFormat("netball", fixtures, groups, teams);
  assert.deepEqual(format.lines, [
    "One group of 4, everyone plays everyone.",
    "2 points for a win, 1 for a draw.",
    "Top 2 go through to the semi-finals.",
  ]);
});

test("a sport with no groups is described as a straight knockout", () => {
  const teams = [1, 2].map((n) => ({ id: `p${n}`, name: `p${n}`, groupId: null, sportSlug: "frisbee" }));
  const fixtures = [fixture({ sportSlug: "frisbee", stage: "playoff" })];
  const format = describeFormat("frisbee", fixtures, [], teams);
  assert.deepEqual(format.lines, ["Straight knockout: win and you go through."]);
  assert.deepEqual(format.rounds, ["Play-off"]);
});
