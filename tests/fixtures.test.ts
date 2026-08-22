import assert from "node:assert/strict";
import { test } from "node:test";

import {
  byRelevance,
  filterFixtures,
  isStageFilter,
  stageLabel,
  toFixture,
  type Fixture,
  type FixtureRow,
} from "../src/lib/fixtures.ts";

function row(overrides: Partial<FixtureRow> = {}): FixtureRow {
  return {
    id: "f1",
    stage: "group",
    status: "finished",
    score_a: 3,
    score_b: 1,
    scheduled_time: "2026-10-24T08:30:00Z",
    placeholder_a: null,
    placeholder_b: null,
    group_id: "g1",
    team_a: { id: "t1", name: "KL Tigers" },
    team_b: { id: "t2", name: "Melaka Mariners" },
    category: {
      id: "c1",
      name: "Open",
      slug: "open",
      sport: {
        id: "s1",
        slug: "football",
        name: "Football",
        code: "FB",
        color: "#3C2A6E",
        sort_order: 1,
      },
    },
    court: {
      id: "ct1",
      name: "Court 1",
      venue: { id: "v1", slug: "sugden", name: "Sugden Sports Centre", short_name: "Sugden" },
    },
    ...overrides,
  };
}

test("toFixture flattens the joined row", () => {
  const fixture = toFixture(row());
  assert.equal(fixture.teamA, "KL Tigers");
  assert.equal(fixture.teamB, "Melaka Mariners");
  assert.equal(fixture.sportCode, "FB");
  assert.equal(fixture.venueShortName, "Sugden");
  assert.equal(fixture.courtName, "Court 1");
  assert.equal(fixture.stageLabel, "Group");
});

test("an undecided knockout slot falls back to its placeholder label", () => {
  const fixture = toFixture(
    row({
      stage: "semifinal",
      status: "upcoming",
      score_a: null,
      score_b: null,
      team_a: null,
      team_b: null,
      placeholder_a: "Winner QF1",
      placeholder_b: "Winner QF2",
    }),
  );
  assert.equal(fixture.teamA, "Winner QF1");
  assert.equal(fixture.teamB, "Winner QF2");
  assert.equal(fixture.teamAId, null);
  assert.equal(fixture.stageLabel, "Semi-final");
});

test("a slot with neither team nor placeholder still shows two sides", () => {
  const fixture = toFixture(row({ team_a: null, team_b: null }));
  assert.equal(fixture.teamA, "TBC");
  assert.equal(fixture.teamB, "TBC");
});

test("byRelevance puts live first, then upcoming, then finished", () => {
  const make = (id: string, status: Fixture["status"], time: string): Fixture =>
    toFixture(row({ id, status, scheduled_time: time }));

  const sorted = [
    make("done", "finished", "2026-10-24T08:30:00Z"),
    make("later", "upcoming", "2026-10-24T15:00:00Z"),
    make("soon", "upcoming", "2026-10-24T14:00:00Z"),
    make("now", "live", "2026-10-24T12:15:00Z"),
  ].sort(byRelevance);

  assert.deepEqual(
    sorted.map((f) => f.id),
    ["now", "soon", "later", "done"],
  );
});

test("filters combine across sport, venue and stage", () => {
  const all: Fixture[] = [
    toFixture(row({ id: "a" })),
    toFixture(
      row({
        id: "b",
        court: {
          id: "ct2",
          name: "Court 2",
          venue: { id: "v2", slug: "trinity", name: "Trinity", short_name: "Trinity" },
        },
      }),
    ),
    toFixture(row({ id: "c", stage: "final" })),
  ];

  assert.deepEqual(
    filterFixtures(all, { sport: "all", venue: "sugden", stage: "all" }).map((f) => f.id),
    ["a", "c"],
  );
  assert.deepEqual(
    filterFixtures(all, { sport: "all", venue: "all", stage: "finals" }).map((f) => f.id),
    ["c"],
  );
  assert.deepEqual(
    filterFixtures(all, { sport: "netball", venue: "all", stage: "all" }).map((f) => f.id),
    [],
  );
});

test("My Games keeps a fixture when either side is followed", () => {
  const mine = toFixture(row({ id: "mine" }));
  const other = toFixture(
    row({
      id: "other",
      team_a: { id: "t9", name: "Perak Bison" },
      team_b: { id: "t8", name: "Kedah Eagles" },
    }),
  );

  const kept = filterFixtures([mine, other], {
    sport: "all",
    venue: "all",
    stage: "all",
    favouriteTeamIds: ["t2"],
  });
  assert.deepEqual(kept.map((f) => f.id), ["mine"]);
});

test("an empty favourites list does not filter everything away", () => {
  // The toggle being on with nothing followed must not read as "no games" by
  // accident — the caller passes undefined when the toggle is off, and an
  // empty array only when the visitor genuinely follows nobody.
  const all = [toFixture(row())];
  assert.equal(
    filterFixtures(all, { sport: "all", venue: "all", stage: "all", favouriteTeamIds: [] }).length,
    1,
  );
});

test("stage filter values are recognised, anything else is not", () => {
  assert.equal(isStageFilter("semis"), true);
  assert.equal(isStageFilter("quarters"), true);
  assert.equal(isStageFilter("nonsense"), false);
});

test("every stage has a readable label", () => {
  assert.equal(stageLabel("third_place"), "3rd place");
  assert.equal(stageLabel("quarterfinal"), "Quarter-final");
});
