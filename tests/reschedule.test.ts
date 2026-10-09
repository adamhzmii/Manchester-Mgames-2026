import assert from "node:assert/strict";
import { test } from "node:test";

import type { Fixture } from "../src/lib/fixtures.ts";
import { keepsKnockoutOrder, laterTime, nextOnCourt, walkoverScore } from "../src/lib/reschedule.ts";
import { fixture } from "./helpers.ts";

const at = (time: string) => `2026-10-24T${time}:00+01:00`;

function game(time: string, overrides: Partial<Fixture> = {}): Fixture {
  return fixture({
    scheduledTime: at(time),
    sportSlug: "badminton",
    venueSlug: "sugden",
    courtName: "Court C1",
    ...overrides,
  });
}

test("walkovers score the sport's usual winning margin", () => {
  assert.equal(walkoverScore("football", "group"), 3);
  assert.equal(walkoverScore("badminton", "group"), 21);
  assert.equal(walkoverScore("badminton", "semifinal"), 30);
  assert.equal(walkoverScore("pickleball", "final"), 2);
  assert.equal(walkoverScore("volleyball", "group"), 31);
});

test("the next game on a court is the next of the same sport there", () => {
  const a = game("10:50");
  const b = game("11:05", { courtName: "Court C2" });
  const c = game("11:05", { sportSlug: "pickleball" });
  const d = game("11:25");
  assert.equal(nextOnCourt(a, [a, b, c, d])?.id, d.id);
  assert.equal(nextOnCourt(d, [a, b, c, d]), null);
});

test("played later goes one slot after the last game of its round on the court", () => {
  const day = [game("10:50"), game("11:05"), game("11:20"), game("13:00", { stage: "semifinal" })];
  // After the group games, not after the semi-final.
  assert.equal(laterTime(day[0], day), new Date(Date.parse(at("11:35"))).toISOString());
});

test("a move that would renumber a knockout round is caught", () => {
  const qf1 = game("14:30", { stage: "quarterfinal", courtName: "Court C1" });
  const qf2 = game("14:30", { stage: "quarterfinal", courtName: "Court C2" });
  const all = [qf1, qf2];
  // Swapping courts makes QF2 the first by court order.
  assert.equal(
    keepsKnockoutOrder(all, new Map([[qf2.id, { courtName: "Court C0" }]])),
    false,
  );
  // Moving QF2 later keeps it second.
  assert.equal(keepsKnockoutOrder(all, new Map([[qf2.id, { scheduledTime: at("14:45") }]])), true);
  // Group games can go anywhere.
  const g1 = game("10:50");
  const g2 = game("11:05");
  assert.equal(
    keepsKnockoutOrder([g1, g2], new Map([[g1.id, { scheduledTime: at("11:05") }], [g2.id, { scheduledTime: at("10:50") }]])),
    true,
  );
});
