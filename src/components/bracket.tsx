import Link from "next/link";

import { TrophyIcon } from "@/components/icons";
import { Score } from "@/components/score";
import { byKickoff, type Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import { winningSide } from "@/lib/matchday";
import { bracketOrder } from "@/lib/progression";
import type { FixtureStage } from "@/lib/supabase/types";

import styles from "./bracket.module.css";

/**
 * Knockout rounds in the order a bracket reads.
 *
 * `third_place` is deliberately absent: it is not a round on the way to the
 * final, and drawn as a column it gets a connector running from the semis
 * through it into the final — which reads as "its winner plays the final".
 * It is shown as its own card under the bracket instead.
 */
const ROUNDS: readonly FixtureStage[] = ["playoff", "round_of_16", "quarterfinal", "semifinal", "final"];

const ROUND_NAME: Partial<Record<FixtureStage, string>> = {
  playoff: "Play-off",
  round_of_16: "Round of 16",
  quarterfinal: "Quarter-finals",
  semifinal: "Semi-finals",
  final: "Final",
};

export function Bracket({ fixtures }: { fixtures: readonly Fixture[] }) {
  const rounds = bracketOrder(
    ROUNDS.map((stage) => ({
      stage,
      matches: fixtures
        .filter((f) => f.stage === stage)
        .sort(byKickoff),
    })).filter((round) => round.matches.length > 0),
    fixtures,
  );

  const third = fixtures.filter((f) => f.stage === "third_place");
  const final = fixtures.find((f) => f.stage === "final");
  const side = final ? winningSide(final) : null;
  const champion = final && side ? (side === "a" ? final.teamA : final.teamB) : null;

  if (rounds.length === 0) {
    return (
      <p className={styles.empty}>
        No knockout games for this sport yet — they are drawn once the group stage finishes.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.scroller}>
        <div className={styles.bracket}>
          {rounds.map((round) => (
            <section key={round.stage} className={styles.round}>
              <h3 className={styles.roundName}>{ROUND_NAME[round.stage]}</h3>
              <div className={styles.slots}>
                {round.matches.map((match) => (
                  <div key={match.id} className={styles.slot}>
                    <div className={styles.slotInner}>
                      <BracketMatch fixture={match} />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}

          {champion ? (
            <section className={`${styles.round} ${styles.championRound}`}>
              <h3 className={styles.roundName}>Champion</h3>
              <div className={styles.slots}>
                <div className={styles.slot}>
                  <div className={styles.slotInner}>
                    <p className={styles.champion}>
                      <TrophyIcon size={20} />
                      {champion}
                    </p>
                  </div>
                </div>
              </div>
            </section>
          ) : null}
        </div>
      </div>

      {third.length > 0 ? (
        <section className={styles.third}>
          <h3 className={styles.roundName}>Third place</h3>
          {third.map((match) => (
            <BracketMatch key={match.id} fixture={match} />
          ))}
        </section>
      ) : null}
    </div>
  );
}

function BracketMatch({ fixture }: { fixture: Fixture }) {
  const side = winningSide(fixture);
  const shown = fixture.status !== "upcoming";

  return (
    <Link href={`/match/${fixture.id}`} className={styles.match} data-status={fixture.status}>
      <span className={`${styles.line} ${side === "b" ? styles.lost : ""} ${side === "a" ? styles.won : ""} ${fixture.teamAId === null ? styles.tbc : ""}`}>
        <span className={styles.team}>{fixture.teamA}</span>
        {shown ? <Score value={fixture.scoreA} className={styles.score} /> : null}
      </span>
      <span className={`${styles.line} ${side === "a" ? styles.lost : ""} ${side === "b" ? styles.won : ""} ${fixture.teamBId === null ? styles.tbc : ""}`}>
        <span className={styles.team}>{fixture.teamB}</span>
        {shown ? <Score value={fixture.scoreB} className={styles.score} /> : null}
      </span>
      <span className={styles.meta}>
        {fixture.status === "live" ? (
          <span className={styles.live}>
            <span className={styles.liveDot} aria-hidden="true" />
            Live
          </span>
        ) : fixture.status === "finished" ? (
          "Full time"
        ) : (
          formatTime(fixture.scheduledTime)
        )}
        {" · "}
        {fixture.venueShortName} {fixture.courtName}
      </span>
    </Link>
  );
}
