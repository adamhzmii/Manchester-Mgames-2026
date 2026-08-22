import assert from "node:assert/strict";
import { test } from "node:test";

import { formatDay, formatFeedTime, formatPrice, formatTime } from "../src/lib/format.ts";

test("times render in Manchester local time, not the machine's zone", () => {
  // 12:15 UTC on event day is 13:15 BST — the time printed on the wall.
  assert.equal(formatTime("2026-10-24T12:15:00Z"), "13:15");
});

test("the day after the clocks go back is GMT again", () => {
  // BST ends 25 October 2026, so the same UTC instant reads an hour earlier.
  assert.equal(formatTime("2026-10-26T12:15:00Z"), "12:15");
});

test("dates render as a short British day", () => {
  assert.equal(formatDay("2026-10-24T12:15:00Z"), "Sat 24 Oct");
});

test("prices render from integer pence", () => {
  assert.equal(formatPrice(650), "£6.50");
  assert.equal(formatPrice(700), "£7.00");
  assert.equal(formatPrice(0), "£0.00");
});

test("the feed shows a bare time for today and adds the date otherwise", () => {
  const now = new Date("2026-10-24T13:00:00Z");
  assert.equal(formatFeedTime("2026-10-24T12:15:00Z", now), "13:15");
  assert.equal(formatFeedTime("2026-10-23T12:15:00Z", now), "Fri 23 Oct · 13:15");
});
