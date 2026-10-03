import Link from "next/link";

import { StarIcon } from "@/components/icons";
import { Score } from "@/components/score";
import { SportBadge } from "@/components/sport-badge";
import type { Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { winningSide } from "@/lib/matchday";
import type { FixtureStage } from "@/lib/supabase/types";

import styles from "./match-row.module.css";

/** The abbreviations score apps use, so a knockout reads at a glance. */
const STAGE_TAG: Partial<Record<FixtureStage, string>> = {
  playoff: "PO",
  round_of_16: "R16",
  quarterfinal: "QF",
  semifinal: "SF",
  third_place: "3RD",
  final: "FINAL",
};

type MatchRowProps = {
  fixture: Fixture;
  /** Team ids the visitor follows — their names are marked in the row. */
  followed?: readonly string[];
  /** Hide the sport glyph, for lists that are already one sport. */
  hideSport?: boolean;
};

/**
 * One game, as one row: when, which sport, who, the score, and where.
 *
 * The unit the whole site is built from. Dense on purpose — the first version
 * gave each game a card three times this height, so a phone showed three
 * games at a time; this shows eight, which is what a player scanning for
 * their own game, or a spectator deciding where to walk, actually needs.
 */
export function MatchRow({ fixture, followed = [], hideSport = false }: MatchRowProps) {
  const winner = winningSide(fixture);
  const tag = STAGE_TAG[fixture.stage];
  const showScores = fixture.status !== "upcoming";

  return (
    <Link
      href={`/match/${fixture.id}`}
      className={styles.row}
      data-status={fixture.status}
      data-nosport={hideSport ? "" : undefined}
    >
      <span className={styles.when}>
        {fixture.status === "live" ? (
          <span className={styles.live}>
            <span className={styles.liveDot} aria-hidden="true" />
            Live
          </span>
        ) : fixture.status === "finished" ? (
          <span className={styles.ft}>FT</span>
        ) : (
          <span className={styles.time}>{formatTime(fixture.scheduledTime)}</span>
        )}
        {tag ? <span className={styles.tag}>{tag}</span> : null}
      </span>

      {hideSport ? null : (
        <span className={styles.sport}>
          <SportBadge
            code={fixture.sportCode}
            color={fixture.sportColor}
            slug={fixture.sportSlug}
            name={`${fixture.sportName} · ${fixture.stageLabel}`}
            size={26}
          />
        </span>
      )}

      <span className={styles.sides}>
        <Side
          name={fixture.teamA}
          placeholder={fixture.teamAId === null}
          followed={fixture.teamAId !== null && followed.includes(fixture.teamAId)}
          state={winner === null ? null : winner === "a" ? "won" : "lost"}
        />
        <Side
          name={fixture.teamB}
          placeholder={fixture.teamBId === null}
          followed={fixture.teamBId !== null && followed.includes(fixture.teamBId)}
          state={winner === null ? null : winner === "b" ? "won" : "lost"}
        />
      </span>

      {showScores ? (
        <span className={styles.scores} aria-label={`Score ${fixture.scoreA ?? 0} to ${fixture.scoreB ?? 0}`}>
          <Score
            value={fixture.scoreA}
            className={`${styles.score} ${winner === "b" ? styles.lost : ""}`}
          />
          <Score
            value={fixture.scoreB}
            className={`${styles.score} ${winner === "a" ? styles.lost : ""}`}
          />
        </span>
      ) : (
        <span className={styles.scores} aria-hidden="true" />
      )}

      <span className={styles.where}>
        <span className={styles.venue}>{fixture.venueShortName}</span>
        <span className={styles.court}>{fixture.courtName}</span>
      </span>
    </Link>
  );
}

function Side({
  name,
  placeholder,
  followed,
  state,
}: {
  name: string;
  placeholder: boolean;
  followed: boolean;
  state: "won" | "lost" | null;
}) {
  const classes = [
    styles.side,
    placeholder ? styles.placeholder : "",
    state === "won" ? styles.won : "",
    state === "lost" ? styles.lost : "",
    followed ? styles.followed : "",
  ].join(" ");

  return (
    <span className={classes}>
      {followed ? <StarIcon size={12} filled className={styles.star} /> : null}
      <span className={styles.name}>{name}</span>
    </span>
  );
}

/**
 * A run of match rows on one card, separated by hairlines — the inset
 * grouped list. A heading, if any, belongs to the caller.
 */
export function MatchList({ children }: { children: React.ReactNode }) {
  return <div className={styles.list}>{children}</div>;
}
