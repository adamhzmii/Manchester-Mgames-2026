"use client";

import { LiveFixtureCard } from "@/components/fixture-card";
import type { Fixture } from "@/lib/fixtures";
import { useLiveFixtures } from "@/lib/use-live-fixtures";

import styles from "./live-rail.module.css";

/**
 * "Happening now" on the home page. Subscribed so a score changes under the
 * reader's eyes without a reload — the single most-watched thing on the day.
 */
export function LiveRail({ fixtures: initial }: { fixtures: Fixture[] }) {
  const fixtures = useLiveFixtures(initial).filter((f) => f.status === "live");

  if (fixtures.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing is live at the moment. The next fixtures are on the schedule.
      </p>
    );
  }

  return (
    <div className={`mg-rail ${styles.rail}`}>
      {fixtures.map((fixture) => (
        <LiveFixtureCard key={fixture.id} fixture={fixture} />
      ))}
    </div>
  );
}
