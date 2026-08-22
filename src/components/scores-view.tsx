"use client";

import { useMemo, useState } from "react";

import { FilterChips, type ChipOption } from "@/components/filter-chips";
import { stageLabel, type Fixture } from "@/lib/fixtures";
import { formatTime } from "@/lib/format";
import type { Sport } from "@/lib/queries";
import { computeStandings, type GroupMeta, type TeamMeta } from "@/lib/standings";
import { useLiveFixtures } from "@/lib/use-live-fixtures";
import type { FixtureStage } from "@/lib/supabase/types";

import styles from "./scores-view.module.css";

/** Knockout rounds in the order a bracket reads. */
const BRACKET_ORDER: readonly FixtureStage[] = [
  "playoff",
  "quarterfinal",
  "semifinal",
  "third_place",
  "final",
];

type ScoresViewProps = {
  fixtures: Fixture[];
  sports: Sport[];
  groups: (GroupMeta & { sportSlug: string })[];
  teams: (TeamMeta & { sportSlug: string })[];
};

export function ScoresView({ fixtures: initial, sports, groups, teams }: ScoresViewProps) {
  const fixtures = useLiveFixtures(initial);
  const [tab, setTab] = useState<"standings" | "bracket">("standings");
  const [sportSlug, setSportSlug] = useState(sports[0]?.slug ?? "");

  const sportOptions: ChipOption[] = useMemo(
    () => sports.map((s) => ({ value: s.slug, label: s.name })),
    [sports],
  );

  const sportFixtures = useMemo(
    () => fixtures.filter((f) => f.sportSlug === sportSlug),
    [fixtures, sportSlug],
  );

  const standings = useMemo(
    () =>
      computeStandings(
        sportFixtures,
        groups.filter((g) => g.sportSlug === sportSlug),
        teams.filter((t) => t.sportSlug === sportSlug),
        sportSlug,
      ),
    [sportFixtures, groups, teams, sportSlug],
  );

  const rounds = useMemo(() => {
    return BRACKET_ORDER.map((stage) => ({
      stage,
      name: stageLabel(stage),
      matches: sportFixtures
        .filter((f) => f.stage === stage)
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    })).filter((round) => round.matches.length > 0);
  }, [sportFixtures]);

  const sportName = sports.find((s) => s.slug === sportSlug)?.name ?? "This sport";

  return (
    <div className="mg-page mg-container-wide" style={{ padding: 0 }}>
      <div className={styles.head}>
        <h1 className="mg-page-title">Scores &amp; Standings</h1>
      </div>

      <div className={styles.tabs} role="tablist" aria-label="Scores view">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "standings"}
          className={`${styles.tab} ${tab === "standings" ? styles.tabOn : ""}`}
          onClick={() => setTab("standings")}
        >
          Group Tables
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "bracket"}
          className={`${styles.tab} ${tab === "bracket" ? styles.tabOn : ""}`}
          onClick={() => setTab("bracket")}
        >
          Knockout
        </button>
      </div>

      <FilterChips
        label="Choose a sport"
        options={sportOptions}
        value={sportSlug}
        onChange={setSportSlug}
      />

      {tab === "standings" ? (
        <div className={styles.panel}>
          {standings.map((group) => (
            <table key={group.groupId} className={styles.table}>
              <caption className={styles.caption}>{group.groupName}</caption>
              <thead>
                <tr>
                  <th scope="col">
                    <span className="mg-sr-only">Position</span>
                  </th>
                  <th scope="col">Team</th>
                  <th scope="col" title="Played">
                    P
                  </th>
                  <th scope="col" title="Won">
                    W
                  </th>
                  <th scope="col" title="Drawn">
                    D
                  </th>
                  <th scope="col" title="Lost">
                    L
                  </th>
                  <th scope="col" title="Points">
                    PTS
                  </th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row) => (
                  <tr key={row.teamId} className={row.qualifying ? styles.rowQualifying : ""}>
                    <td
                      className={`${styles.position} ${row.qualifying ? styles.positionQualifying : ""}`}
                    >
                      {row.position}
                    </td>
                    <th scope="row" className={styles.team}>
                      {row.teamName}
                      {row.qualifying ? (
                        <span className={styles.qualTag} title="Qualified for the knockouts">
                          Q
                        </span>
                      ) : null}
                    </th>
                    <td>{row.played}</td>
                    <td>{row.won}</td>
                    <td>{row.drawn}</td>
                    <td>{row.lost}</td>
                    <td className={styles.points}>{row.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}

          {standings.length === 0 ? (
            <div className={styles.notice}>
              <p className={styles.noticeTitle}>No group tables</p>
              <p>
                {sportName} runs as a straight knockout — see the Knockout tab for the bracket.
              </p>
            </div>
          ) : (
            <p className={styles.legend}>
              <span className={styles.legendSwatch} />
              Top two of each group advance to the knockouts
            </p>
          )}
        </div>
      ) : (
        <div className={styles.panel}>
          {rounds.map((round) => (
            <section key={round.stage}>
              <div className={styles.round}>
                <h2 className={styles.roundName}>{round.name}</h2>
                <span className={styles.roundRule} />
              </div>
              <div className={styles.matches}>
                {round.matches.map((match) => (
                  <BracketMatch key={match.id} fixture={match} />
                ))}
              </div>
            </section>
          ))}

          {rounds.length === 0 ? (
            <div className={styles.notice}>
              <p className={styles.noticeTitle}>Bracket coming soon</p>
              <p>
                {sportName} has no knockout fixtures yet — they are drawn once the group stage
                finishes.
              </p>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function BracketMatch({ fixture }: { fixture: Fixture }) {
  const decided =
    fixture.status === "finished" && fixture.scoreA !== null && fixture.scoreB !== null;
  const aBeaten = decided && fixture.scoreB! > fixture.scoreA!;
  const bBeaten = decided && fixture.scoreA! > fixture.scoreB!;
  const score = (value: number | null) =>
    fixture.status === "upcoming" || value === null ? "–" : String(value);

  return (
    <article className={styles.match}>
      {fixture.status === "live" ? (
        <span className={styles.matchLive}>
          <span className={styles.matchLiveDot} />
          LIVE
        </span>
      ) : null}

      <div className={styles.matchRow}>
        <span className={`${styles.matchTeam} ${aBeaten ? styles.matchTeamBeaten : ""}`}>
          {fixture.teamA}
        </span>
        <span className={`${styles.matchScore} ${aBeaten ? styles.matchTeamBeaten : ""}`}>
          {score(fixture.scoreA)}
        </span>
      </div>
      <div className={styles.matchRow}>
        <span className={`${styles.matchTeam} ${bBeaten ? styles.matchTeamBeaten : ""}`}>
          {fixture.teamB}
        </span>
        <span className={`${styles.matchScore} ${bBeaten ? styles.matchTeamBeaten : ""}`}>
          {score(fixture.scoreB)}
        </span>
      </div>

      <p className={styles.matchMeta}>
        {formatTime(fixture.scheduledTime)} · {fixture.venueShortName} {fixture.courtName}
      </p>
    </article>
  );
}
