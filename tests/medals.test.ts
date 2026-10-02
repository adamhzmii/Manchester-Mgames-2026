import assert from "node:assert/strict";
import { test } from "node:test";

import { medalTable, podiums } from "../src/lib/medals.ts";
import { fixture, played } from "./helpers.ts";

const football = { categoryId: "c-fb", sportSlug: "football", sportName: "Football", sportOrder: 1 };
const netball = { categoryId: "c-nb", sportSlug: "netball", sportName: "Netball", sportOrder: 3 };

test("gold and silver come from the final", () => {
  const final = played(["t1", "Melaka"], ["t2", "Kedah"], 2, 0, { ...football, stage: "final" });
  const [podium] = podiums([final]);
  assert.equal(podium.gold.name, "Melaka");
  assert.equal(podium.silver.name, "Kedah");
  assert.equal(podium.bronze, null);
});

test("bronze only exists where a third-place game was played", () => {
  const final = played(["t1", "Melaka"], ["t2", "Kedah"], 2, 0, { ...football, stage: "final" });
  const third = played(["t3", "Penang"], ["t4", "Johor"], 1, 3, { ...football, stage: "third_place" });
  const [podium] = podiums([final, third]);
  assert.equal(podium.bronze?.name, "Johor");
});

test("an unplayed or level final awards nothing", () => {
  const upcoming = fixture({ ...football, stage: "final" });
  const level = played(["t1", "A"], ["t2", "B"], 1, 1, { ...netball, stage: "final" });
  assert.deepEqual(podiums([upcoming, level]), []);
});

test("a split sport names its category", () => {
  const final = played(["t1", "A"], ["t2", "B"], 11, 4, {
    categoryId: "c-wd",
    sportSlug: "pickleball",
    sportName: "Pickleball",
    categoryName: "Women's Doubles",
    stage: "final",
  });
  assert.equal(podiums([final])[0].title, "Pickleball · Women's Doubles");
});

test("the medal table counts by university and ranks golds first", () => {
  const list = podiums([
    played(["t1", "Melaka"], ["t2", "Kedah"], 2, 0, { ...football, stage: "final" }),
    played(["t3", "Selangor"], ["t4", "Sarawak"], 30, 20, { ...netball, stage: "final" }),
  ]);
  const uni: Record<string, string> = {
    t1: "MMU",
    t2: "Manchester",
    t3: "Salford",
    t4: "MMU",
  };
  const rows = medalTable(list, (id) => uni[id] ?? null);
  // MMU: 1 gold + 1 silver; Salford: 1 gold; Manchester: 1 silver.
  assert.deepEqual(
    rows.map((r) => [r.name, r.gold, r.silver, r.bronze, r.total]),
    [
      ["MMU", 1, 1, 0, 2],
      ["Salford", 1, 0, 0, 1],
      ["Manchester", 0, 1, 0, 1],
    ],
  );
});

test("a team with no university is counted under its own name", () => {
  const list = podiums([played(["t1", "Melaka"], ["t2", "Kedah"], 2, 0, { ...football, stage: "final" })]);
  const rows = medalTable(list, () => null);
  assert.deepEqual(rows.map((r) => r.name), ["Melaka", "Kedah"]);
});
