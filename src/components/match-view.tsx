"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  CalendarPlusIcon,
  ChevronLeftIcon,
  ClockIcon,
  PinIcon,
  ShareIcon,
  StarIcon,
  TrophyIcon,
} from "@/components/icons";
import { MatchList, MatchRow } from "@/components/match-row";
import { KickoffCountdown, KickoffTime, LateNote, useKickoff } from "@/components/delays";
import { Score } from "@/components/score";
import { ScoreConsole } from "@/components/score-console";
import { ShareButton } from "@/components/share-button";
import { SportBadge } from "@/components/sport-badge";
import { StandingsTable } from "@/components/standings-table";
import { byKickoff, type Fixture } from "@/lib/fixtures";
import { formatDay, formatTime } from "@/lib/format";
import { useLiveFixtures } from "@/lib/live-feed";
import { winningSide } from "@/lib/matchday";
import { nextGames } from "@/lib/progression";
import { roundGames } from "@/lib/slots";
import type { Court, PickerTeam, Venue } from "@/lib/queries";
import {
  computeStandings,
  type GroupMeta,
  type StandingsGroup,
  type TeamMeta,
} from "@/lib/standings";
import { firstKnockoutRound, throughLine } from "@/lib/tournament-format";
import { canGoBackInSite } from "@/lib/navigation";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./match-view.module.css";

type MatchViewProps = {
  id: string;
  fixtures: Fixture[];
  teams: PickerTeam[];
  groups: (GroupMeta & { sportSlug: string })[];
  standingTeams: (TeamMeta & { sportSlug: string })[];
  venues: Venue[];
  /** Every court, for moving a game — only fetched for coordinators. */
  courts: Court[];
  canEdit: boolean;
};

/**
 * One game: the score, when and where, how to get there, and what it means —
 * the group table it decides, or the round the winner goes on to.
 *
 * This is the page a notification opens and the link a team drops in its
 * group chat, so everything a player needs before walking over is above the
 * fold: time, building, court, directions.
 */
export function MatchView({
  id,
  fixtures: initial,
  teams,
  groups,
  standingTeams,
  venues,
  courts,
  canEdit,
}: MatchViewProps) {
  const fixtures = useLiveFixtures(initial);
  const favourites = useFavouriteTeams();
  const fixture = fixtures.find((f) => f.id === id);

  // The server checked it exists; it can only vanish if deleted mid-visit.
  if (!fixture) {
    return (
      <div className="mg-wrap mg-page">
        <p>This game is no longer on the schedule.</p>
      </div>
    );
  }

  const venue = venues.find((v) => v.slug === fixture.venueSlug);
  const directions =
    venue?.latitude != null && venue?.longitude != null
      ? `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`
      : null;
  const group = groups.find((g) => g.id === fixture.groupId);
  const winner = winningSide(fixture);

  const table =
    fixture.stage === "group" && group
      ? computeStandings(
          fixtures,
          [group],
          standingTeams.filter((t) => t.sportSlug === fixture.sportSlug),
          fixture.sportSlug,
        )[0]
      : undefined;

  const gamesFor = (teamId: string | null) =>
    teamId === null
      ? []
      : fixtures
          .filter((f) => f.id !== fixture.id && (f.teamAId === teamId || f.teamBId === teamId))
          .sort(byKickoff);

  return (
    <article className={styles.page}>
      <header className={styles.band} data-status={fixture.status}>
        <div className={`mg-wrap ${styles.bandInner}`}>
          <div className={styles.topRow}>
            <BackLink />
            <ShareButton
              title={`${fixture.teamA} v ${fixture.teamB}`}
              text={`${fixture.teamA} v ${fixture.teamB} · ${fixture.sportName} ${fixture.stageLabel}, ${formatTime(fixture.scheduledTime)} at ${fixture.venueShortName} ${fixture.courtName} · MGames 2026`}
              className={styles.iconButton}
            >
              <ShareIcon size={19} />
              <span className="mg-sr-only">Share this game</span>
            </ShareButton>
          </div>

          <p className={styles.competition}>
            <SportBadge
              code={fixture.sportCode}
              color={fixture.sportColor}
              slug={fixture.sportSlug}
              size={22}
            />
            {fixture.sportName}
            {fixture.categoryName && fixture.categoryName !== "Open" ? ` · ${fixture.categoryName}` : ""}
            {" · "}
            {group ? group.name : fixture.stageLabel}
          </p>

          <div className={styles.board}>
            <TeamSide
              name={fixture.teamA}
              teamId={fixture.teamAId}
              state={winner === null ? null : winner === "a" ? "won" : "lost"}
              followed={fixture.teamAId !== null && favourites.has(fixture.teamAId)}
              onFollow={() => fixture.teamAId && favourites.toggle([fixture.teamAId])}
            />

            <div className={styles.centre}>
              {fixture.status === "upcoming" ? (
                <>
                  <KickoffTime fixture={fixture} className={styles.kickoff} />
                  <KickoffCountdown fixture={fixture} className={styles.until} />
                </>
              ) : (
                <>
                  <span className={styles.score}>
                    <Score value={fixture.scoreA} />
                    <span className={styles.dash}>–</span>
                    <Score value={fixture.scoreB} />
                  </span>
                  {fixture.status === "live" ? (
                    <span className={styles.livePill}>
                      <span className={styles.liveDot} aria-hidden="true" />
                      Live
                    </span>
                  ) : (
                    <span className={styles.ft}>Full time</span>
                  )}
                </>
              )}
            </div>

            <TeamSide
              name={fixture.teamB}
              teamId={fixture.teamBId}
              state={winner === null ? null : winner === "b" ? "won" : "lost"}
              followed={fixture.teamBId !== null && favourites.has(fixture.teamBId)}
              onFollow={() => fixture.teamBId && favourites.toggle([fixture.teamBId])}
              right
            />
          </div>
          {fixture.status === "upcoming" ? (
            <p className={styles.lateLine}>
              <LateNote fixture={fixture} onNight />
            </p>
          ) : null}
        </div>
      </header>

      <div className={`mg-wrap ${styles.body}`}>
        <div className={styles.facts}>
          <div className={styles.fact}>
            <ClockIcon size={20} className={styles.factIcon} />
            <WhenFact fixture={fixture} />
          </div>

          <div className={styles.fact}>
            <PinIcon size={20} className={styles.factIcon} />
            <div className={styles.factGrow}>
              <p className={styles.factMain}>
                {venue?.name ?? fixture.venueShortName} · {fixture.courtName}
              </p>
              {venue?.address ? <p className={styles.factSub}>{venue.address}</p> : null}
              <p className={styles.factLinks}>
                {directions ? (
                  <a href={directions} target="_blank" rel="noreferrer">
                    Directions
                  </a>
                ) : null}
                <Link href={`/venues?v=${fixture.venueSlug}`}>Venue guide</Link>
              </p>
            </div>
          </div>

          <NextRound
            fixture={fixture}
            fixtures={fixtures}
            table={table}
            groupCount={groups.filter((g) => g.categoryId === fixture.categoryId).length}
          />
        </div>

        <div className={styles.actions}>
          <a href={`/match/${fixture.id}/calendar.ics`} className={`mg-btn ${styles.action}`}>
            <CalendarPlusIcon size={18} />
            Add to calendar
          </a>
          <ShareButton
            title={`${fixture.teamA} v ${fixture.teamB}`}
            text={`${fixture.teamA} v ${fixture.teamB} · ${fixture.sportName} ${fixture.stageLabel}, ${formatTime(fixture.scheduledTime)} at ${fixture.venueShortName} ${fixture.courtName} · MGames 2026`}
            className={`mg-btn ${styles.action}`}
          >
            <ShareIcon size={18} />
            Share
          </ShareButton>
        </div>

        {canEdit ? (
          <ScoreConsole
            fixture={fixture}
            fixtures={fixtures}
            teams={teams}
            groups={groups}
            standingTeams={standingTeams}
            courts={courts}
            venues={venues}
          />
        ) : null}

        {table ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{table.groupName} table</h2>
            <StandingsTable
              group={table}
              fixtures={fixtures}
              highlight={[fixture.teamAId, fixture.teamBId].filter((x): x is string => x !== null)}
              captionHidden
            />
          </section>
        ) : null}

        {[
          { id: fixture.teamAId, name: fixture.teamA },
          { id: fixture.teamBId, name: fixture.teamB },
        ].map((side) => {
          const games = gamesFor(side.id);
          if (side.id === null || games.length === 0) return null;
          return (
            <section key={side.id} className={styles.section}>
              <h2 className={styles.sectionTitle}>
                <Link href={`/team/${side.id}`}>{possessive(side.name)} day</Link>
              </h2>
              <MatchList>
                {games.map((f) => (
                  <MatchRow key={f.id} fixture={f} followed={favourites.teamIds} hideSport />
                ))}
              </MatchList>
            </section>
          );
        })}
      </div>
    </article>
  );
}

function TeamSide({
  name,
  teamId,
  state,
  followed,
  onFollow,
  right = false,
}: {
  name: string;
  teamId: string | null;
  state: "won" | "lost" | null;
  followed: boolean;
  onFollow: () => void;
  right?: boolean;
}) {
  const classes = [
    styles.side,
    right ? styles.sideRight : "",
    state === "won" ? styles.won : "",
    state === "lost" ? styles.lost : "",
    teamId === null ? styles.tbc : "",
  ].join(" ");

  return (
    <div className={classes}>
      {teamId ? (
        <Link href={`/team/${teamId}`} className={styles.sideName}>
          {name}
        </Link>
      ) : (
        <span className={styles.sideName}>{name}</span>
      )}
      {teamId ? (
        <button
          type="button"
          className={`${styles.follow} ${followed ? styles.following : ""}`}
          onClick={onFollow}
          aria-pressed={followed}
        >
          <StarIcon size={13} filled={followed} />
          {followed ? "Following" : "Follow"}
        </button>
      ) : null}
    </div>
  );
}

/**
 * Back to exactly where the visitor came from on this site — the same page,
 * filters and scroll — or to the schedule for a game opened from outside,
 * where "back" would leave the site.
 */
function BackLink() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={styles.back}
      onClick={() => {
        if (canGoBackInSite()) router.back();
        else router.push("/schedule");
      }}
    >
      <ChevronLeftIcon size={20} />
      Back
    </button>
  );
}

/** What this game leads to, so a player knows what is at stake. */
function NextRound({
  fixture,
  fixtures,
  table,
  groupCount,
}: {
  fixture: Fixture;
  fixtures: Fixture[];
  table?: StandingsGroup;
  groupCount: number;
}) {
  let text: React.ReactNode = null;

  if (fixture.stage === "group") {
    const round = firstKnockoutRound(fixture.categoryId, fixtures);
    if (table && round) {
      text = throughLine(table, {
        groups: groupCount,
        groupSize: table.rows.length,
        round,
        group: table.groupName,
      });
    }
  } else if (fixture.stage === "final") {
    text = "The winner is the MGames 2026 champion.";
  } else if (fixture.stage === "third_place") {
    text = "The winner takes bronze.";
  } else {
    const sameCategory = fixtures.filter((f) => f.categoryId === fixture.categoryId);
    let { winner, loser } = nextGames(fixture, fixtures);
    // Knockouts entered by name, with no "Winner SF1" to follow: a semi-final
    // still leads to its category's final and 3rd-place game.
    if (!winner && fixture.stage === "semifinal") {
      winner = sameCategory.find((f) => f.stage === "final") ?? null;
      loser = sameCategory.find((f) => f.stage === "third_place") ?? null;
    }
    const index = roundGames(fixture.categoryId, fixture.stage, fixtures).findIndex(
      (f) => f.id === fixture.id,
    );
    if (winner) {
      text = (
        <>
          Winner plays the{" "}
          <Link href={`/match/${winner.id}`}>
            {winner.stageLabel.toLowerCase()} at {formatTime(winner.scheduledTime)}
          </Link>
          {loser ? (
            <>
              , loser the{" "}
              <Link href={`/match/${loser.id}`}>
                {loser.stage === "third_place" ? "3rd-place game" : loser.stageLabel.toLowerCase()}{" "}
                at {formatTime(loser.scheduledTime)}
              </Link>
            </>
          ) : null}
          .
          {index >= 0 ? (
            <span className="mg-sr-only">
              {" "}
              This is {fixture.stageLabel.toLowerCase()} {index + 1}.
            </span>
          ) : null}
        </>
      );
    }
  }

  if (!text) return null;
  return (
    <div className={styles.fact}>
      <TrophyIcon size={20} className={styles.factIcon} />
      <p className={styles.factMain}>{text}</p>
    </div>
  );
}

/** "Johor Warriors' day", "KL Tigers' day", "Penang's day". */
function possessive(name: string): string {
  return /s$/i.test(name) ? `${name}\u2019` : `${name}\u2019s`;
}

/**
 * When the game is: the time it is now expected at, the same as the big one
 * above — and if that has moved, a plain sentence saying from when and why.
 * The one place a delay is spelled out; lists just show the time.
 */
function WhenFact({ fixture }: { fixture: Fixture }) {
  const { iso, lateMin } = useKickoff(fixture);
  const delayed = fixture.status === "upcoming" && lateMin > 0;
  return (
    <div>
      <p className={styles.factMain}>
        {formatDay(fixture.scheduledTime)} · {formatTime(delayed ? iso : fixture.scheduledTime)}
      </p>
      {delayed ? (
        <p className={styles.factDelay}>
          Delayed from {formatTime(fixture.scheduledTime)} — {fixture.courtName} is running behind.
        </p>
      ) : null}
      <p className={styles.factSub}>
        {fixture.status === "upcoming"
          ? "Be courtside 10 minutes before kick-off."
          : fixture.status === "live"
            ? `In progress now${fixture.startedAt ? ` · kicked off ${formatTime(fixture.startedAt)}` : ""}.`
            : "Played."}
      </p>
    </div>
  );
}
