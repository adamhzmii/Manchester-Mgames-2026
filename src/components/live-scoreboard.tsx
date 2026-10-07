import Link from "next/link";

import { KickoffTime, LateNote } from "@/components/delays";
import { Score } from "@/components/score";
import { SportBadge } from "@/components/sport-badge";
import { categoryCode, type Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";

import styles from "./live-scoreboard.module.css";

/**
 * A live game as a scoreboard: night panel, team names large, the score in
 * gold. Used where the live games are the headline — the matchday band on the
 * home page — rather than the compact match row. Also shows the next game to
 * start during a lull, with its kick-off where the score would be.
 */
export function LiveScoreboard({ fixture }: { fixture: Fixture }) {
  const upcoming = fixture.status === "upcoming";
  return (
    <Link href={`/match/${fixture.id}`} className={styles.board}>
      <span className={styles.top}>
        <span className={styles.sport}>
          <SportBadge
            code={fixture.sportCode}
            color={fixture.sportColor}
            slug={fixture.sportSlug}
            size={22}
          />
          {fixture.sportName}
          {categoryCode(fixture) ? ` ${categoryCode(fixture)}` : ""} · {fixture.stageLabel}
        </span>
        {upcoming ? (
          <span className={styles.next}>
            Starts <KickoffTime fixture={fixture} className={styles.nextTime} />
          </span>
        ) : (
          <span className={styles.live}>
            <span className={styles.dot} aria-hidden="true" />
            Live
          </span>
        )}
      </span>

      <span className={styles.line}>
        <span className={styles.team}>{fixture.teamA}</span>
        {upcoming ? null : <Score value={fixture.scoreA} className={styles.score} />}
      </span>
      <span className={styles.line}>
        <span className={styles.team}>{fixture.teamB}</span>
        {upcoming ? null : <Score value={fixture.scoreB} className={styles.score} />}
      </span>

      <span className={styles.foot}>
        <span>
          {fixture.venueShortName} · {fixture.courtName}
        </span>
        <span>
          {upcoming
            ? fixture.stageLabel
            : `From ${formatTime(fixture.startedAt ?? fixture.scheduledTime)}`}
        </span>
      </span>
      {upcoming ? <LateNote fixture={fixture} onNight className={styles.late} /> : null}
    </Link>
  );
}
