"use client";

import { ClockIcon, PinIcon, StarIcon } from "@/components/icons";
import { SportBadge } from "@/components/sport-badge";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";

import styles from "./fixture-card.module.css";

/**
 * Which side is greyed out. Only a finished fixture has a loser — a live
 * fixture that happens to be 1-0 is still anybody's.
 */
function outcome(fixture: Fixture): { aBeaten: boolean; bBeaten: boolean } {
  if (fixture.status !== "finished" || fixture.scoreA === null || fixture.scoreB === null) {
    return { aBeaten: false, bBeaten: false };
  }
  return {
    aBeaten: fixture.scoreB > fixture.scoreA,
    bBeaten: fixture.scoreA > fixture.scoreB,
  };
}

/** Upcoming fixtures show their kick-off time in place of a status word. */
function statusLabel(fixture: Fixture): string {
  if (fixture.status === "live") return "LIVE";
  if (fixture.status === "finished") return "FT";
  return formatTime(fixture.scheduledTime);
}

function scoreText(fixture: Fixture, side: "a" | "b"): string {
  if (fixture.status === "upcoming") return "";
  const value = side === "a" ? fixture.scoreA : fixture.scoreB;
  return value === null ? "–" : String(value);
}

type FixtureCardProps = {
  fixture: Fixture;
  /** Whether either side is in the visitor's saved teams. */
  favourite?: boolean;
  onToggleFavourite?: (fixture: Fixture) => void;
  /** Rendered only for a signed-in coordinator. */
  onEdit?: (fixture: Fixture) => void;
};

export function FixtureCard({
  fixture,
  favourite = false,
  onToggleFavourite,
  onEdit,
}: FixtureCardProps) {
  const { aBeaten, bBeaten } = outcome(fixture);
  const isLive = fixture.status === "live";

  return (
    <article className={`${styles.card} ${styles[fixture.status]}`}>
      <div className={styles.head}>
        <span className={styles.sport}>
          <SportBadge code={fixture.sportCode} color={fixture.sportColor} name={fixture.sportName} />
          <span className={styles.sportText}>
            {fixture.sportName} · {fixture.stageLabel}
          </span>
        </span>
        <span className={`${styles.status} ${styles[`status${capitalise(fixture.status)}`]}`}>
          {isLive ? <span className={styles.pulse} /> : null}
          {statusLabel(fixture)}
        </span>
      </div>

      <div className={styles.teams}>
        <span className={`${styles.team} ${aBeaten ? styles.teamBeaten : ""}`}>
          {fixture.teamA}
        </span>
        <span className={`${styles.score} ${aBeaten ? styles.teamBeaten : ""}`}>
          {scoreText(fixture, "a")}
        </span>
        <span className={`${styles.team} ${bBeaten ? styles.teamBeaten : ""}`}>
          {fixture.teamB}
        </span>
        <span className={`${styles.score} ${bBeaten ? styles.teamBeaten : ""}`}>
          {scoreText(fixture, "b")}
        </span>
      </div>

      <div className={styles.foot}>
        <span className={styles.meta}>
          <span className={styles.metaItem}>
            <ClockIcon size={12} />
            {formatTime(fixture.scheduledTime)}
          </span>
          <span className={styles.metaItem}>
            <PinIcon size={12} />
            {fixture.venueShortName} · {fixture.courtName}
          </span>
        </span>

        <span className={styles.actions}>
          {onEdit ? (
            <button type="button" className={styles.editButton} onClick={() => onEdit(fixture)}>
              Edit score
            </button>
          ) : null}
          {onToggleFavourite ? (
            <button
              type="button"
              className={`${styles.star} ${favourite ? styles.starOn : ""}`}
              onClick={() => onToggleFavourite(fixture)}
              aria-pressed={favourite}
              aria-label={
                favourite
                  ? `Stop following ${fixture.teamA} and ${fixture.teamB}`
                  : `Follow ${fixture.teamA} and ${fixture.teamB}`
              }
            >
              <StarIcon size={20} filled={favourite} />
            </button>
          ) : null}
        </span>
      </div>
    </article>
  );
}

/**
 * Compact variant for the "Happening now" rail on the home page: a scoreboard
 * column separated by a rule from its neighbours, not a boxed card with its
 * own border and shadow — every card on this page already has that
 * treatment, and this rail is meant to read as one board, not a repeat of
 * the same component five times.
 */
export function LiveFixtureCard({ fixture }: { fixture: Fixture }) {
  return (
    <article className={styles.compact}>
      <div className={styles.compactHead}>
        <span className={styles.compactSport}>
          <span
            className={styles.compactDot}
            style={{ background: fixture.sportColor }}
            aria-hidden="true"
          />
          {fixture.sportName}
        </span>
        <span className={styles.compactPulse} aria-label="Live" />
      </div>

      <div className={styles.compactRow}>
        <span className={styles.compactTeam}>{fixture.teamA}</span>
        <span className={styles.compactScore}>{scoreText(fixture, "a")}</span>
      </div>
      <div className={styles.compactRow}>
        <span className={styles.compactTeam}>{fixture.teamB}</span>
        <span className={styles.compactScore}>{scoreText(fixture, "b")}</span>
      </div>

      <p className={styles.compactFoot}>
        {fixture.venueShortName} · {fixture.courtName}
      </p>
    </article>
  );
}

function capitalise(value: string): "Live" | "Finished" | "Upcoming" {
  return (value.charAt(0).toUpperCase() + value.slice(1)) as "Live" | "Finished" | "Upcoming";
}
