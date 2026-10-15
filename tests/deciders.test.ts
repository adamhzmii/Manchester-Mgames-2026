import assert from "node:assert/strict";
import { test } from "node:test";

import { deciderKind, deciderNote, scoreline, settledBy } from "../src/lib/deciders.ts";
import { winningSide } from "../src/lib/matchday.ts";
import { podiums } from "../src/lib/medals.ts";
import { winnerOf } from "../src/lib/progression.ts";
import { teamForm } from "../src/lib/standings.ts";
import { fixture } from "./helpers.ts";

const shootout = (overrides = {}) =>
  fixture({
    stage: "semifinal",
    status: "finished",
    scoreA: 1,
    scoreB: 1,
    deciderA: 3,
    deciderB: 4,
    ...overrides,
  });

test("only football and basketball knockouts have a decider", () => {
  assert.equal(deciderKind("football", "quarterfinal"), "penalties");
  assert.equal(deciderKind("basketball", "final"), "overtime");
  assert.equal(deciderKind("football", "group"), null);
  assert.equal(deciderKind("netball", "semifinal"), null);
  assert.equal(deciderKind("volleyball", "final"), null);
});

test("a level knockout is won on penalties, and the score stays level", () => {
  const f = shootout();
  assert.equal(winningSide(f), "b");
  assert.deepEqual(winnerOf(f), { id: "b", name: "Team B" });
  assert.equal(scoreline(f), "1–1 (3–4 pens)");
  assert.equal(deciderNote(f), "3–4 pens");
});

test("basketball overtime reads as OT", () => {
  const f = shootout({ sportSlug: "basketball", scoreA: 40, scoreB: 40, deciderA: 5, deciderB: 2 });
  assert.equal(winningSide(f), "a");
  assert.equal(scoreline(f), "40–40 (5–2 OT)");
});

test("a decider settles nothing unless the game is a finished, level knockout", () => {
  // Left over on a game whose score was corrected off level.
  assert.equal(settledBy(shootout({ scoreA: 2 })), null);
  assert.equal(winningSide(shootout({ scoreA: 2 })), "a");
  // Not finished yet.
  assert.equal(settledBy(shootout({ status: "live" })), null);
  // Group games have no penalties: level is a draw.
  assert.equal(winningSide(shootout({ stage: "group" })), null);
  // Level penalties decide nothing.
  assert.equal(winningSide(shootout({ deciderA: 4, deciderB: 4 })), null);
  // A sport without one ignores a stray pair.
  assert.equal(winningSide(shootout({ sportSlug: "netball" })), null);
});

test("penalty winners take the medals and show as a win in the form guide", () => {
  const final = shootout({ stage: "final" });
  const [podium] = podiums([final]);
  assert.equal(podium.gold.name, "Team B");
  assert.equal(podium.silver.name, "Team A");
  assert.deepEqual(teamForm([final], "a"), ["L"]);
  assert.deepEqual(teamForm([final], "b"), ["W"]);
});
