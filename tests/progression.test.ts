import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveSlot } from "../src/lib/progression.ts";
import { fixture, played } from "./helpers.ts";

const groups = [{ id: "gA", name: "Group A", sortOrder: 1, categoryId: "c-football", sportSlug: "football" }];
const teams = [
  { id: "t1", name: "Melaka", groupId: "gA", sportSlug: "football" },
  { id: "t2", name: "Kedah", groupId: "gA", sportSlug: "football" },
  { id: "t3", name: "KL", groupId: "gA", sportSlug: "football" },
];

const groupGames = [
  played(["t1", "Melaka"], ["t2", "Kedah"], 2, 0, { groupId: "gA" }),
  played(["t2", "Kedah"], ["t3", "KL"], 3, 1, { groupId: "gA" }),
  played(["t1", "Melaka"], ["t3", "KL"], 1, 0, { groupId: "gA" }),
];

const semi = fixture({ stage: "semifinal", teamAId: null, teamA: "Group A winner", teamBId: null, teamB: "Group A runner-up" });

test("a group place is suggested once the whole group has been played", () => {
  assert.deepEqual(resolveSlot("Group A winner", semi, groupGames, groups, teams), { id: "t1", name: "Melaka" });
  assert.deepEqual(resolveSlot("Group A runner-up", semi, groupGames, groups, teams), { id: "t2", name: "Kedah" });
});

test("nothing is suggested while a group game is still to play", () => {
  const unfinished = [...groupGames.slice(0, 2), fixture({ groupId: "gA", teamAId: "t1", teamBId: "t3" })];
  assert.equal(resolveSlot("Group A winner", semi, unfinished, groups, teams), null);
});

test("semi-final winners and losers feed the final and third place", () => {
  const sf1 = played(["t1", "Melaka"], ["t4", "Penang"], 4, 1, {
    stage: "semifinal",
    scheduledTime: "2026-10-24T12:30:00+01:00",
  });
  const sf2 = played(["t2", "Kedah"], ["t5", "Johor"], 0, 1, {
    stage: "semifinal",
    scheduledTime: "2026-10-24T13:15:00+01:00",
  });
  const final = fixture({ stage: "final", teamAId: null, teamBId: null });
  const all = [sf2, sf1, final];
  assert.deepEqual(resolveSlot("Winner SF1", final, all, groups, teams), { id: "t1", name: "Melaka" });
  assert.deepEqual(resolveSlot("Winner SF2", final, all, groups, teams), { id: "t5", name: "Johor" });
  assert.deepEqual(resolveSlot("Loser SF1", final, all, groups, teams), { id: "t4", name: "Penang" });
});

test("a semi still being played suggests no one", () => {
  const sf1 = fixture({ stage: "semifinal", status: "live", scoreA: 1, scoreB: 0, teamAId: "t1", teamBId: "t4" });
  const final = fixture({ stage: "final", teamAId: null, teamBId: null });
  assert.equal(resolveSlot("Winner SF1", final, [sf1, final], groups, teams), null);
});

test("a label it does not understand is left to the coordinator", () => {
  assert.equal(resolveSlot("Best loser", semi, groupGames, groups, teams), null);
});
