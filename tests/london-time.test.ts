import assert from "node:assert/strict";
import { test } from "node:test";

import { londonDate, londonToIso } from "../src/lib/london-time.ts";

test("a time typed in Manchester becomes the right moment, summer or winter", () => {
  // 24 October 2026 is still British Summer Time: 08:45 there is 07:45 UTC.
  assert.equal(londonToIso("2026-10-24", "08:45"), "2026-10-24T07:45:00.000Z");
  // After the clocks go back, Manchester is on UTC.
  assert.equal(londonToIso("2026-12-05", "08:45"), "2026-12-05T08:45:00.000Z");
});

test("times that are not times are refused", () => {
  assert.equal(londonToIso("2026-10-24", "25:00"), null);
  assert.equal(londonToIso("2026-10-24", "8.45"), null);
  assert.equal(londonToIso("24/10/2026", "08:45"), null);
});

test("a game's day is the day in Manchester, not in UTC", () => {
  // 23:30 UTC on the 23rd is already 00:30 on the 24th in Manchester.
  assert.equal(londonDate("2026-10-23T23:30:00Z"), "2026-10-24");
  assert.equal(londonDate("2026-10-24T07:30:00+00:00"), "2026-10-24");
});
