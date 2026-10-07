import assert from "node:assert/strict";
import { test } from "node:test";

import {
  daysUntil,
  latestResults,
  phaseOf,
  relative,
  upNext,
  winningSide,
} from "../src/lib/matchday.ts";
import { fixture, played } from "./helpers.ts";

const KICKOFF = Date.parse("2026-10-24T09:00:00+01:00");

test("nothing played and weeks to go is 'before'", () => {
  const list = [fixture()];
  assert.equal(phaseOf(list, Date.parse("2026-10-02T12:00:00+01:00")), "before");
});

test("the event morning is matchday even before the first game starts", () => {
  const list = [fixture()];
  assert.equal(phaseOf(list, KICKOFF - 60 * 60 * 1000), "matchday");
  assert.equal(phaseOf(list, KICKOFF - 4 * 60 * 60 * 1000), "before");
});

test("a dry run marking one game live flips to matchday whatever the date", () => {
  const list = [fixture({ status: "live", scoreA: 0, scoreB: 0 }), fixture()];
  assert.equal(phaseOf(list, Date.parse("2026-10-02T12:00:00+01:00")), "matchday");
});

test("every game finished is 'after'", () => {
  const list = [played(["a", "A"], ["b", "B"], 1, 0), played(["c", "C"], ["d", "D"], 2, 2)];
  assert.equal(phaseOf(list, KICKOFF), "after");
});

test("no fixtures at all is treated as before, not after", () => {
  assert.equal(phaseOf([], KICKOFF), "before");
});

test("days are counted as Manchester calendar days", () => {
  // 23:30 on the 23rd is still 'tomorrow', not 'today'.
  assert.equal(daysUntil(Date.parse("2026-10-23T23:30:00+01:00"), KICKOFF), 1);
  assert.equal(daysUntil(Date.parse("2026-10-24T00:10:00+01:00"), KICKOFF), 0);
  assert.equal(daysUntil(Date.parse("2026-10-02T09:00:00+01:00"), KICKOFF), 22);
});

test("relative times read the way they are said", () => {
  const now = KICKOFF;
  assert.equal(relative(now + 12 * 60_000, now), "in 12 min");
  assert.equal(relative(now + 65 * 60_000, now), "in 1 hr 5 min");
  assert.equal(relative(now + 120 * 60_000, now), "in 2 hr");
  assert.equal(relative(now - 8 * 60_000, now), "8 min ago");
  assert.equal(relative(now + 20_000, now), "now");
  assert.equal(relative(now + (30 * 60 + 5) * 60_000, now), "in 1 day");
  assert.equal(relative(now + (493 * 60 + 25) * 60_000, now), "in 21 days");
  assert.equal(relative(now - 3 * 24 * 60 * 60_000, now), "3 days ago");
});

test("up next counts a game still waiting to start, even past its slot", () => {
  const late = fixture({ scheduledTime: "2026-10-24T09:00:00+01:00", id: "late" });
  const later = fixture({ scheduledTime: "2026-10-24T09:30:00+01:00", id: "later" });
  const live = fixture({ scheduledTime: "2026-10-24T08:45:00+01:00", status: "live", id: "live" });
  assert.deepEqual(
    upNext([later, live, late], 5).map((f) => f.id),
    ["late", "later"],
  );
});

test("latest results are newest first", () => {
  const early = played(["a", "A"], ["b", "B"], 1, 0, { id: "early", scheduledTime: "2026-10-24T09:00:00+01:00" });
  const late = played(["a", "A"], ["b", "B"], 1, 0, { id: "late", scheduledTime: "2026-10-24T11:00:00+01:00" });
  assert.deepEqual(latestResults([early, late], 5).map((f) => f.id), ["late", "early"]);
});

test("a winner only exists for a finished, decided game", () => {
  assert.equal(winningSide(played(["a", "A"], ["b", "B"], 3, 1)), "a");
  assert.equal(winningSide(played(["a", "A"], ["b", "B"], 1, 3)), "b");
  assert.equal(winningSide(played(["a", "A"], ["b", "B"], 2, 2)), null);
  assert.equal(winningSide(fixture({ status: "live", scoreA: 5, scoreB: 0 })), null);
});
