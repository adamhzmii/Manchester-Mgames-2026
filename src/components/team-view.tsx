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
import { nextGames } from "@/lib/progression";
import type { PickerTeam, Venue } from "@/lib/queries";
import {
  computeStandings,
  thirdPlaceTable,
  type GroupMeta,
  type StandingsGroup,
  type TeamMeta,
} from "@/lib/standings";
import { firstKnockoutRound, throughLine } from "@/lib/tournament-format";
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
  const categoryGroups = groups.filter((g) => g.categoryId === team.categoryId);
  const sportTeams = standingTeams.filter((t) => t.sportSlug === team.sportSlug);
  const table = group
    ? computeStandings(fixtures, [group], sportTeams, team.sportSlug)[0]
    : undefined;
  // Only where the format sends some third-placed teams through.
  const thirds =
    table && table.bestThirds > 0
      ? thirdPlaceTable(computeStandings(fixtures, categoryGroups, sportTeams, team.sportSlug))
      : null;
  const groupsDone = fixtures
    .filter((f) => f.categoryId === team.categoryId && f.stage === "group")
    .every((f) => f.status === "finished");

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

          <p className={styles.status}>
            {statusLine(team, games, fixtures, table, thirds, groupsDone)}
          </p>

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
              {throughLine(table, {
                groups: categoryGroups.length,
                groupSize: table.rows.length,
                round: firstKnockoutRound(team.categoryId, fixtures),
                group: table.groupName,
              })}{" "}
              Level on points is split by score difference, then by score.
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
  fixtures: Fixture[],
  table: StandingsGroup | undefined,
  thirds: StandingsGroup | null,
  groupsDone: boolean,
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
  if (knockout?.stage === "third_place") return "Playing for 3rd place";
  if (knockout) return `Through to the ${knockout.stageLabel.toLowerCase()}`;

  // The latest knockout result outranks the group table: a team that went
  // through and then lost is out, not "2nd in Group A · through".
  const lastKnockout = [...games]
    .reverse()
    .find((f) => f.stage !== "group" && f.status === "finished");
  if (lastKnockout) {
    if (!won(lastKnockout)) return `Out in the ${lastKnockout.stageLabel.toLowerCase()}`;
    // Won, and the next slot not filled in yet.
    const next = nextGames(lastKnockout, fixtures).winner;
    return next ? `Through to the ${next.stageLabel.toLowerCase()}` : "Through";
  }

  if (table) {
    const row = table.rows.find((r) => r.teamId === team.id);
    const groupDone = games
      .filter((f) => f.stage === "group")
      .every((f) => f.status === "finished");
    if (row) {
      const place = `${ordinal(row.position)} in ${table.groupName}`;
      if (groupDone && row.played > 0) {
        if (row.position <= table.places) return `${place} · through`;
        // Third can still go through as one of the best thirds, which no
        // single group decides.
        if (thirds && row.position === 3) {
          if (!groupsDone) return `${place} · waiting on the other groups`;
          const third = thirds.rows.find((r) => r.teamId === team.id);
          if (third?.qualifying) return `${place} · through as a best third`;
          // Inside the cut but dead level with the first team outside it.
          if (third && third.position <= thirds.places) {
            return `${place} · level for a best-third place`;
          }
          return `${place} · out`;
        }
        return `${place} · out`;
      }
      if (row.played > 0) return `${place} so far`;
    }
  }

  return games.length > 0 ? `${games.length} ${games.length === 1 ? "game" : "games"} on Saturday` : "No games scheduled yet";
}
