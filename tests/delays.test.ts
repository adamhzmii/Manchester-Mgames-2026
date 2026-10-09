import assert from "node:assert/strict";
import { test } from "node:test";

import { courtStates, expectedStarts, lateCourts, roundLate } from "../src/lib/delays.ts";
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

test("a coordinator's start time moves that game, and the court after it", () => {
  const day = [
    game("08:30", { plannedStart: at("08:40") }),
    game("08:45"),
    game("09:00", { courtName: "Pitch B" }),
  ];
  assert.deepEqual(late(day, "08:00"), [10, 10, 0]);
});

test("a coordinator's start time stands even when the site would have guessed later", () => {
  // The 08:30 game is overrunning; the coordinator knows the next one goes at 09:00.
  const day = [
    game("08:30", { status: "live", startedAt: at("08:30") }),
    game("08:45", { plannedStart: at("09:00") }),
    game("09:00"),
  ];
  assert.deepEqual(late(day, "08:58"), [null, 15, 15]);
  const expected = expectedStarts(day, clock("08:58")).get(day[1].id)!;
  assert.equal(expected.planned, true);
  assert.equal(expected.overdue, false);
});

test("a start time that comes and goes without a kick-off keeps sliding", () => {
  const day = [game("08:30", { plannedStart: at("08:40") }), game("08:45")];
  assert.deepEqual(late(day, "08:52"), [20, 20]);
  assert.equal(expectedStarts(day, clock("08:52")).get(day[0].id)!.overdue, true);
});

test("a game left live by mistake stops holding up the court once the next one starts", () => {
  const day = [
    game("08:30", { status: "live", startedAt: at("08:30") }), // Finish never tapped
    game("08:45", { status: "live", startedAt: at("08:47") }),
    game("09:00"),
  ];
  // Without the fix the first game would run to "now" and push 09:00 to 10:00.
  assert.deepEqual(late(day, "09:05"), [null, null, 5]);
});

test("each game knows how many games are still to finish before it on its court", () => {
  const day = [
    game("08:30", { status: "finished", startedAt: at("08:30"), finishedAt: at("08:44"), scoreA: 1, scoreB: 0 }),
    game("08:45", { status: "live", startedAt: at("08:46") }),
    game("09:00"),
    game("09:15"),
    game("09:00", { courtName: "Pitch B" }),
  ];
  const expected = expectedStarts(day, clock("08:50"));
  assert.deepEqual(
    day.slice(2).map((f) => expected.get(f.id)!.ahead),
    [1, 2, 0],
  );
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

test("a court flags a game live for far too long, and one that is due but not started", () => {
  const pitchB = { courtName: "Pitch B" };
  const day = [
    game("08:30", { status: "live", startedAt: at("08:30") }),
    game("08:45"),
    game("08:30", { ...pitchB, status: "finished", startedAt: at("08:30"), finishedAt: at("08:44"), scoreA: 1, scoreB: 1 }),
    game("08:45", pitchB),
  ];
  const now = clock("09:10");
  const states = courtStates(day, expectedStarts(day, now), now);
  const [a, b] = states;
  assert.equal(a.courtName, "Pitch A");
  assert.deepEqual(a.alerts, [{ kind: "long-live", minutes: 40, fixtureId: day[0].id }]);
  assert.equal(a.live?.id, day[0].id);
  assert.equal(b.courtName, "Pitch B");
  assert.deepEqual(b.alerts, [{ kind: "not-started", minutes: 25, fixtureId: day[3].id }]);
  assert.equal(b.lastTap, Date.parse(at("08:44")));
});

test("a court with a game left live behind a later one says so", () => {
  const day = [
    game("08:30", { status: "live", startedAt: at("08:30") }),
    game("08:45", { status: "live", startedAt: at("08:47") }),
  ];
  const now = clock("08:50");
  const [court] = courtStates(day, expectedStarts(day, now), now);
  assert.deepEqual(court.alerts, [{ kind: "left-live", fixtureId: day[0].id }]);
  assert.equal(court.live?.id, day[1].id);
});
