import assert from "node:assert/strict";
import { test } from "node:test";

import type { Fixture } from "../src/lib/fixtures.ts";
import { bracketOrder, nextGames, resolveSlot } from "../src/lib/progression.ts";
import { parseSlot, qualification, roundGames } from "../src/lib/slots.ts";
import { computeStandings, thirdPlaceTable } from "../src/lib/standings.ts";
import type { FixtureStage } from "../src/lib/supabase/types.ts";
import { fixture, played } from "./helpers.ts";

/** A knockout game waiting on its two slots. */
function slot(stage: FixtureStage, time: string, court: string, a: string, b: string): Fixture {
  return fixture({
    stage,
    scheduledTime: `2026-10-24T${time}:00+01:00`,
    courtName: court,
    teamAId: null,
    teamBId: null,
    teamA: a,
    teamB: b,
    slotA: a,
    slotB: b,
  });
}

/** MGames 2025's football knockouts, as the preview sets them up. */
function knockouts2025(): Fixture[] {
  return [
    slot("round_of_16", "11:45", "Pitch A", "Group A winner", "Best 3rd (3)"),
    slot("round_of_16", "11:45", "Pitch B", "Group A runner-up", "Group C runner-up"),
    slot("round_of_16", "12:05", "Pitch A", "Group B winner", "Best 3rd (1)"),
    slot("round_of_16", "12:05", "Pitch B", "Group B runner-up", "Best 3rd (4)"),
    slot("round_of_16", "12:25", "Pitch A", "Group C winner", "Group D runner-up"),
    slot("round_of_16", "12:25", "Pitch B", "Group E winner", "Group F runner-up"),
    slot("round_of_16", "12:45", "Pitch A", "Group D winner", "Best 3rd (2)"),
    slot("round_of_16", "12:45", "Pitch B", "Group F winner", "Group E runner-up"),
    slot("quarterfinal", "13:10", "Pitch A", "Winner R16 1", "Winner R16 6"),
    slot("quarterfinal", "13:10", "Pitch B", "Winner R16 5", "Winner R16 2"),
    slot("quarterfinal", "13:30", "Pitch A", "Winner R16 3", "Winner R16 8"),
    slot("quarterfinal", "13:30", "Pitch B", "Winner R16 7", "Winner R16 4"),
    slot("semifinal", "14:30", "Pitch A", "Winner QF1", "Winner QF3"),
    slot("semifinal", "14:55", "Pitch A", "Winner QF2", "Winner QF4"),
    slot("third_place", "15:20", "Pitch A", "Loser SF1", "Loser SF2"),
    slot("final", "15:45", "Pitch A", "Winner SF1", "Winner SF2"),
  ];
}

test("slot labels are read the way a coordinator would read them", () => {
  assert.deepEqual(parseSlot("Group A winner"), { kind: "group", group: "A", place: 1 });
  assert.deepEqual(parseSlot("Group D runner-up"), { kind: "group", group: "D", place: 2 });
  assert.deepEqual(parseSlot("Best 3rd (3)"), { kind: "best-third", rank: 3 });
  assert.deepEqual(parseSlot("Winner R16 6"), {
    kind: "round",
    outcome: "winner",
    stage: "round_of_16",
    number: 6,
  });
  assert.deepEqual(parseSlot("Loser SF1"), {
    kind: "round",
    outcome: "loser",
    stage: "semifinal",
    number: 1,
  });
  assert.deepEqual(parseSlot("Winner QF 2"), {
    kind: "round",
    outcome: "winner",
    stage: "quarterfinal",
    number: 2,
  });
  assert.equal(parseSlot("Best loser"), null);
  assert.equal(parseSlot(null), null);
});

test("games kicking off together are numbered by court, Pitch A before Pitch B", () => {
  const b = slot("quarterfinal", "13:10", "Pitch B", "x", "y");
  const a = slot("quarterfinal", "13:10", "Pitch A", "x", "y");
  const later = slot("quarterfinal", "13:30", "Pitch A", "x", "y");
  assert.deepEqual(
    roundGames("c-football", "quarterfinal", [later, b, a]).map((f) => f.id),
    [a.id, b.id, later.id],
  );
  const ten = slot("semifinal", "14:00", "Court 10", "x", "y");
  const two = slot("semifinal", "14:00", "Court 2", "x", "y");
  assert.deepEqual(roundGames("c-football", "semifinal", [ten, two]).map((f) => f.id), [two.id, ten.id]);
});

test("who goes through is read off the knockout slots", () => {
  assert.deepEqual(qualification("c-football", knockouts2025()), { places: 2, bestThirds: 4 });

  const seeded = [
    slot("semifinal", "12:15", "Court 2", "Group A 1st", "Group A 4th"),
    slot("semifinal", "13:00", "Court 2", "Group A 2nd", "Group A 3rd"),
  ];
  assert.deepEqual(qualification("c-football", seeded), { places: 4, bestThirds: 0 });

  // Knockout teams entered by name: nothing to read, so the usual top two.
  assert.deepEqual(qualification("c-football", [fixture({ stage: "final" })]), { places: 2, bestThirds: 0 });
});

test("the bracket pairs each game with the two that feed it, not by kick-off", () => {
  const all = knockouts2025();
  const stages: FixtureStage[] = ["round_of_16", "quarterfinal", "semifinal", "final"];
  const rounds = bracketOrder(
    stages.map((stage) => ({ stage, matches: roundGames("c-football", stage, all) })),
    all,
  );
  const number = (f: Fixture) => roundGames("c-football", f.stage, all).indexOf(f) + 1;

  // Quarter-final 1 takes R16 1 and 6, so they are drawn next to each other.
  assert.deepEqual(rounds[0].matches.map(number), [1, 6, 3, 8, 5, 2, 7, 4]);
  assert.deepEqual(rounds[1].matches.map(number), [1, 3, 2, 4]);
  assert.deepEqual(rounds[2].matches.map(number), [1, 2]);
});

test("a knockout game knows where its winner and loser go next", () => {
  const all = knockouts2025();
  const [qf1] = roundGames("c-football", "quarterfinal", all);
  const [sf1] = roundGames("c-football", "semifinal", all);
  const third = all.find((f) => f.stage === "third_place")!;
  const final = all.find((f) => f.stage === "final")!;

  assert.deepEqual(nextGames(qf1, all), { winner: sf1, loser: null });
  assert.deepEqual(nextGames(sf1, all), { winner: final, loser: third });
});

// -------------------------------------------------------- best thirds ----

const groups = ["A", "B", "C"].map((letter, i) => ({
  id: `g${letter}`,
  name: `Group ${letter}`,
  sortOrder: i + 1,
  categoryId: "c-football",
  sportSlug: "football",
}));

const teams = groups.flatMap((g) =>
  [1, 2, 3].map((n) => ({
    id: `${g.id}${n}`,
    name: `${g.name} team ${n}`,
    groupId: g.id,
    sportSlug: "football",
  })),
);

/** A three-team group in which team 1 beats both, team 2 beats 3 by `margin`. */
function group(id: string, margin: number): Fixture[] {
  const t = (n: number): [string, string] => [`${id}${n}`, `${id} team ${n}`];
  return [
    played(t(1), t(2), 2, 0, { groupId: id }),
    played(t(1), t(3), 1, 0, { groupId: id }),
    played(t(2), t(3), margin + 1, 1, { groupId: id }),
  ];
}

test("third-placed teams are ranked against each other, and the best go through", () => {
  // Thirds lose by 1+1, 1+3 and 1+2: Group A's third is best, Group B's worst.
  const games = [
    ...group("gA", 1),
    ...group("gB", 3),
    ...group("gC", 2),
    slot("round_of_16", "12:00", "Pitch A", "Group A winner", "Best 3rd (2)"),
  ];
  const thirds = thirdPlaceTable(computeStandings(games, groups, teams, "football"));
  assert.ok(thirds);
  assert.deepEqual(
    thirds.rows.map((r) => [r.teamId, r.group, r.qualifying]),
    [
      ["gA3", "Group A", true],
      ["gC3", "Group C", true],
      ["gB3", "Group B", false],
    ],
  );
});

test("a best-third slot waits for every group, then names the team", () => {
  const r16 = slot("round_of_16", "12:00", "Pitch A", "Group A winner", "Best 3rd (2)");
  const done = [...group("gA", 1), ...group("gB", 3), ...group("gC", 2), r16];
  assert.deepEqual(resolveSlot("Best 3rd (2)", r16, done, groups, teams), {
    id: "gC3",
    name: "Group C team 3",
  });

  // A rehearsal fills slots in kick-off order, so the first one is read
  // before any other game naming a third exists.
  const groupsOnly = done.filter((f) => f.stage === "group");
  assert.deepEqual(resolveSlot("Best 3rd (1)", r16, groupsOnly, groups, teams), {
    id: "gA3",
    name: "Group A team 3",
  });

  const unfinished = [
    ...group("gA", 1),
    ...group("gB", 3),
    ...group("gC", 2).slice(0, 2),
    fixture({ groupId: "gC", teamAId: "gC2", teamBId: "gC3" }),
    r16,
  ];
  assert.equal(resolveSlot("Best 3rd (2)", r16, unfinished, groups, teams), null);
});

test("where everyone goes through, every team is marked through from the start", () => {
  // 2nd plays 3rd for the other place in the final.
  const seeded = [
    slot("semifinal", "12:15", "Court 2", "Group A 2nd", "Group A 3rd"),
    slot("final", "13:00", "Court 2", "Group A 1st", "Winner SF1"),
  ];
  const [table] = computeStandings(seeded, [groups[0]], teams, "football");
  assert.equal(table.places, 3);
  assert.deepEqual(table.rows.map((r) => r.qualifying), [true, true, true]);
});
