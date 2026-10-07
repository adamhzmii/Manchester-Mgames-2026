"use client";

import Link from "next/link";

import { PinIcon } from "@/components/icons";
import { KickoffCountdown, KickoffTime, LateNote } from "@/components/delays";
import { Score } from "@/components/score";
import { SportBadge } from "@/components/sport-badge";
import { categoryCode, type Fixture } from "@/lib/fixtures";
import { formatDay } from "@/lib/format";

import styles from "./next-game.module.css";

/**
 * A followed team's next game, large: who, when, which court, and a way to
 * get there. The answer to the question a player asks all day.
 */
export function NextGame({
  fixture,
  followed,
  venue,
}: {
  fixture: Fixture;
  followed: readonly string[];
  venue?: { latitude: number | null; longitude: number | null };
}) {
  const live = fixture.status === "live";
  const directions =
    venue?.latitude != null && venue?.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`
      : null;

  const isMine = (id: string | null) => id !== null && followed.includes(id);

  return (
    <div className={styles.next} data-live={live ? "" : undefined}>
      <Link href={`/match/${fixture.id}`} className={styles.nextLink}>
        <span className={styles.nextLabel}>
          {live ? (
            <>
              <span className={styles.liveDot} aria-hidden="true" />
              Playing now
            </>
          ) : (
            <>
              Next game
              <KickoffCountdown fixture={fixture} className={styles.nextIn} />
            </>
          )}
        </span>

        <span className={styles.nextSport}>
          <SportBadge
            code={fixture.sportCode}
            color={fixture.sportColor}
            slug={fixture.sportSlug}
            size={20}
          />
          {fixture.sportName}
          {categoryCode(fixture) ? ` ${categoryCode(fixture)}` : ""} · {fixture.stageLabel}
        </span>

        <span className={styles.versus}>
          <span className={`${styles.vsTeam} ${isMine(fixture.teamAId) ? styles.mine : ""}`}>
            {fixture.teamA}
          </span>
          {live ? (
            <span className={styles.liveScore}>
              <Score value={fixture.scoreA} />
              <span aria-hidden="true">–</span>
              <Score value={fixture.scoreB} />
            </span>
          ) : (
            <span className={styles.vs}>vs</span>
          )}
          <span
            className={`${styles.vsTeam} ${styles.vsRight} ${isMine(fixture.teamBId) ? styles.mine : ""}`}
          >
            {fixture.teamB}
          </span>
        </span>

        <span className={styles.when}>
          <KickoffTime fixture={fixture} className={styles.kickoff} />
          <span className={styles.whenDay}>{formatDay(fixture.scheduledTime)}</span>
        </span>
        <LateNote fixture={fixture} className={styles.late} />
      </Link>

      <div className={styles.where}>
        <span className={styles.court}>
          <PinIcon size={16} />
          {fixture.venueShortName} · {fixture.courtName}
        </span>
        {directions ? (
          <a href={directions} target="_blank" rel="noreferrer" className={styles.directions}>
            Directions
          </a>
        ) : null}
      </div>
    </div>
  );
}
