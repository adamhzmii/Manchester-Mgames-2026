import assert from "node:assert/strict";
import { test } from "node:test";

import { expectedStarts, lateCourts, roundLate } from "../src/lib/delays.ts";
import type { Fixture } from "../src/lib/fixtures.ts";
import { fixture } from "./helpers.ts";

/** 24 October, Manchester time. */
const at = (time: string) => `2026-10-24T${time}:00+01:00`;
const clock = (time: string) => Date.parse(at(time));

/** A game on Pitch A at Trinity unless told otherwise. */
function game(time: string, overrides: Partial<Fixture> = {}): Fixture {
  return fixture({
    scheduledTime: at(time),
    venueSlug: "trinity",
    venueShortName: "Trinity",
    courtName: "Pitch A",
    ...overrides,
  });
}

const late = (fixtures: Fixture[], now: string) => {
  const expected = expectedStarts(fixtures, clock(now));
  return fixtures.map((f) => expected.get(f.id)?.lateMin ?? null);
};

test("nothing is late before the day has started", () => {
  const day = [game("08:30"), game("08:45"), game("09:00")];
  assert.deepEqual(late(day, "07:00"), [0, 0, 0]);
});

test("a late kick-off slides every game after it on the court, until a break absorbs it", () => {
  const day = [
    game("08:30", { status: "live", startedAt: at("08:45"), scoreA: 0, scoreB: 0 }),
    game("08:45"),
    game("09:00"),
    game("10:00"), // an hour's gap: plenty of slack
  ];
  assert.deepEqual(late(day, "08:50"), [null, 15, 15, 0]);
});

test("other courts are not affected", () => {
  const day = [
    game("08:30", { status: "live", startedAt: at("08:45") }),
    game("08:45"),
    game("09:00", { courtName: "Pitch B" }),
  ];
  assert.deepEqual(late(day, "08:50"), [null, 15, 0]);
});

test("a game running past its slot pushes the next one back as it goes", () => {
  const day = [game("08:30", { status: "live", startedAt: at("08:30") }), game("08:45"), game("09:00")];
  assert.deepEqual(late(day, "08:46"), [null, 0, 0]);
  assert.deepEqual(late(day, "08:56"), [null, 10, 10]);
});

test("a game whose time has passed without starting is as late as the clock says", () => {
  const day = [game("08:30"), game("08:45")];
  assert.deepEqual(late(day, "08:41"), [10, 10]);
});

test("finished games hand the court on at their real final whistle", () => {
  const day = [
    game("08:30", {
      status: "finished",
      startedAt: at("08:40"),
      finishedAt: at("09:02"),
      scoreA: 1,
      scoreB: 0,
    }),
    game("08:45"),
    game("09:00"),
  ];
  // 08:45 can start once the court is free at 09:02; 09:00 follows a slot later.
  assert.deepEqual(late(day, "09:02"), [null, 15, 15]);
});

test("a coordinator's starting-late moves that game, and the court after it", () => {
  const day = [game("08:30", { delayMinutes: 10 }), game("08:45"), game("09:00", { courtName: "Pitch B" })];
  assert.deepEqual(late(day, "08:00"), [10, 10, 0]);
});

test("a knockout waits for the game whose winner it needs, even on another court", () => {
  const semi = game("14:30", {
    stage: "semifinal",
    courtName: "Pitch B",
    status: "live",
    startedAt: at("14:30"),
  });
  const final = game("14:45", {
    stage: "final",
    teamAId: null,
    teamBId: null,
    slotA: "Winner SF1",
    slotB: "Winner SF2",
  });
  // The semi's slot is the court's fallback, 20 minutes: it ends no sooner than 14:50.
  assert.deepEqual(late([semi, final], "14:40"), [null, 5]);
});

test("slips are rounded to five, and small ones are not shown", () => {
  assert.equal(roundLate(3), 0);
  assert.equal(roundLate(5), 5);
  assert.equal(roundLate(8), 10);
  assert.equal(roundLate(14), 15);
});

test("the courts running behind are listed worst first", () => {
  const sugden = { courtName: "Court 2", venueShortName: "Sugden", venueSlug: "sugden" };
  const day = [
    game("08:30", { status: "live", startedAt: at("08:45") }),
    game("08:45"),
    game("08:30", { ...sugden, status: "live", startedAt: at("08:55") }),
    game("08:45", sugden),
    game("09:15", { courtName: "Pitch B" }),
  ];
  const expected = expectedStarts(day, clock("09:00"));
  assert.deepEqual(lateCourts(day, expected), [
    { venueShortName: "Sugden", courtName: "Court 2", lateMin: 25 },
    { venueShortName: "Trinity", courtName: "Pitch A", lateMin: 15 },
  ]);
});
