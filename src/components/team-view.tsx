"use client";

import Link from "next/link";

import { BracketIcon, StarIcon } from "@/components/icons";
import { MatchList, MatchRow } from "@/components/match-row";
import { NextGame } from "@/components/next-game";
import { NotifyToggle } from "@/components/notify-toggle";
import { SportBadge } from "@/components/sport-badge";
import { StandingsTable } from "@/components/standings-table";
import type { Fixture } from "@/lib/fixtures";
import { useLiveFixtures } from "@/lib/live-feed";
import { winningSide } from "@/lib/matchday";
import type { PickerTeam, Venue } from "@/lib/queries";
import {
  computeStandings,
  QUALIFYING,
  type GroupMeta,
  type StandingsGroup,
  type TeamMeta,
} from "@/lib/standings";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./team-view.module.css";

type TeamViewProps = {
  team: PickerTeam;
  groupId: string | null;
  fixtures: Fixture[];
  groups: (GroupMeta & { sportSlug: string })[];
  standingTeams: (TeamMeta & { sportSlug: string })[];
  venues: Venue[];
};

/**
 * One team's day: where it stands, its next game, and every result so far.
 * The page a player bookmarks, and the one a friend in the crowd follows.
 */
export function TeamView({
  team,
  groupId,
  fixtures: initial,
  groups,
  standingTeams,
  venues,
}: TeamViewProps) {
  const fixtures = useLiveFixtures(initial);
  const favourites = useFavouriteTeams();
  const following = favourites.has(team.id);

  const games = fixtures
    .filter((f) => f.teamAId === team.id || f.teamBId === team.id)
    .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime));

  const next = games.find((f) => f.status === "live") ?? games.find((f) => f.status === "upcoming");

  const group = groups.find((g) => g.id === groupId);
  const table = group
    ? computeStandings(
        fixtures,
        [group],
        standingTeams.filter((t) => t.sportSlug === team.sportSlug),
        team.sportSlug,
      )[0]
    : undefined;

  const record = games.reduce(
    (acc, f) => {
      const side = winningSide(f);
      if (f.status !== "finished") return acc;
      acc.played += 1;
      const mine = f.teamAId === team.id ? "a" : "b";
      if (side === null) acc.drawn += 1;
      else if (side === mine) acc.won += 1;
      else acc.lost += 1;
      return acc;
    },
    { played: 0, won: 0, drawn: 0, lost: 0 },
  );

  const hasKnockout = fixtures.some(
    (f) => f.categoryId === team.categoryId && f.stage !== "group",
  );

  return (
    <article className={styles.page}>
      <header className={styles.band}>
        <div className={`mg-wrap ${styles.bandInner}`}>
          <p className={styles.sport}>
            <SportBadge
              code={team.sportCode}
              color={team.sportColor}
              slug={team.sportSlug}
              size={22}
            />
            {team.sportName}
            {team.categoryName && team.categoryName !== "Open" ? ` · ${team.categoryName}` : ""}
          </p>
          <h1 className={styles.name}>{team.name}</h1>

          <p className={styles.status}>{statusLine(team, games, table)}</p>

          <dl className={styles.record}>
            {(
              [
                ["Played", record.played],
                ["Won", record.won],
                ["Drawn", record.drawn],
                ["Lost", record.lost],
              ] as const
            ).map(([label, value]) => (
              <div key={label} className={styles.recordItem}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>

          <div className={styles.follow}>
            <button
              type="button"
              className={`mg-btn ${following ? "mg-btn-gold" : styles.followOff}`}
              onClick={() => favourites.toggle([team.id])}
              aria-pressed={following}
            >
              <StarIcon size={17} filled={following} />
              {following ? "Following" : "Follow this team"}
            </button>
          </div>
        </div>
      </header>

      <div className={`mg-wrap ${styles.body}`}>
        {following ? (
          <div className={styles.notify}>
            <NotifyToggle />
          </div>
        ) : null}

        {next ? (
          <section className={styles.section}>
            <h2 className={styles.title}>{next.status === "live" ? "Playing now" : "Next game"}</h2>
            <NextGame
              fixture={next}
              followed={[team.id]}
              venue={venues.find((v) => v.slug === next.venueSlug)}
            />
          </section>
        ) : null}

        {table ? (
          <section className={styles.section}>
            <h2 className={styles.title}>{table.groupName}</h2>
            <StandingsTable group={table} fixtures={fixtures} highlight={[team.id]} captionHidden />
            <p className={styles.note}>
              Top {QUALIFYING} go through. Level on points is split by score difference, then by
              score.
            </p>
          </section>
        ) : null}

        <section className={styles.section}>
          <h2 className={styles.title}>All games</h2>
          <MatchList>
            {games.map((f) => (
              <MatchRow key={f.id} fixture={f} followed={[team.id]} hideSport />
            ))}
          </MatchList>
        </section>

        {hasKnockout ? (
          <Link
            href={`/standings?sport=${team.sportSlug}&view=bracket`}
            className={styles.bracketLink}
          >
            <BracketIcon size={20} />
            {team.sportName} knockout bracket
          </Link>
        ) : null}
      </div>
    </article>
  );
}

function ordinal(n: number): string {
  const suffix = n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th";
  return `${n}${suffix}`;
}

/**
 * Where the team's day stands, in a sentence: champions, into the final,
 * through, out. Read from results only, so it never claims more than the
 * scores say.
 */
function statusLine(
  team: PickerTeam,
  games: Fixture[],
  table: StandingsGroup | undefined,
): string {
  const mine = (f: Fixture) => (f.teamAId === team.id ? "a" : "b");
  const won = (f: Fixture) => winningSide(f) === mine(f);

  const final = games.find((f) => f.stage === "final");
  if (final?.status === "finished") return won(final) ? "MGames 2026 champions" : "Runners-up";

  const third = games.find((f) => f.stage === "third_place");
  if (third?.status === "finished") return won(third) ? "Bronze medallists" : "Finished fourth";

  const live = games.find((f) => f.status === "live");
  if (live) return `Playing now · ${live.stageLabel}`;

  const knockout = games.find((f) => f.stage !== "group" && f.status === "upcoming");
  if (knockout) return `Through to the ${knockout.stageLabel.toLowerCase()}`;

  if (table) {
    const row = table.rows.find((r) => r.teamId === team.id);
    const groupDone = games
      .filter((f) => f.stage === "group")
      .every((f) => f.status === "finished");
    if (row) {
      if (groupDone && row.played > 0) {
        return row.position <= QUALIFYING
          ? `${ordinal(row.position)} in ${table.groupName} · through`
          : `${ordinal(row.position)} in ${table.groupName} · out`;
      }
      if (row.played > 0) return `${ordinal(row.position)} in ${table.groupName} so far`;
    }
  }

  const lostKnockout = games.find((f) => f.stage !== "group" && f.status === "finished" && !won(f));
  if (lostKnockout) return `Out in the ${lostKnockout.stageLabel.toLowerCase()}`;

  return games.length > 0 ? `${games.length} ${games.length === 1 ? "game" : "games"} on Saturday` : "No games scheduled yet";
}
