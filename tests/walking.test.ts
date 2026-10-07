import assert from "node:assert/strict";
import { test } from "node:test";

import { walkMinutes, walkingDirections } from "../src/lib/walking.ts";

const trinity = { latitude: 53.464754, longitude: -2.239163 };
const sugden = { latitude: 53.471186, longitude: -2.235999 };
const denmarkRoad = { latitude: 53.460865, longitude: -2.234874 };

test("walking times between the venues", () => {
  // The committee timed Trinity to Sugden at 12 minutes; the estimate agrees.
  assert.equal(walkMinutes(trinity, sugden), 12);
  assert.equal(walkMinutes(trinity, denmarkRoad), 8);
  assert.equal(walkMinutes(sugden, denmarkRoad), 18);
});

test("a venue with no coordinates has no walking time or route", () => {
  const nowhere = { latitude: null, longitude: null };
  assert.equal(walkMinutes(trinity, nowhere), null);
  assert.equal(walkingDirections(nowhere, trinity), null);
  assert.match(walkingDirections(trinity, sugden) ?? "", /travelmode=walking/);
});
