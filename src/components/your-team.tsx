"use client";

import Link from "next/link";
import { useMemo } from "react";

import { FindTeamButton } from "@/components/find-team-button";
import { PinIcon, StarIcon } from "@/components/icons";
import { MatchList, MatchRow } from "@/components/match-row";
import { NotifyToggle } from "@/components/notify-toggle";
import { RelTime } from "@/components/rel-time";
import { Score } from "@/components/score";
import { SportBadge } from "@/components/sport-badge";
import type { Fixture } from "@/lib/fixtures";
import { formatDay, formatTime } from "@/lib/format";
import type { PickerTeam } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./your-team.module.css";

/**
 * The player's corner of the home page.
 *
 * A player's first question all day is "when and where is my next game, and
 * who against" — so once a team is followed, that answer leads, in large
 * type, with the court and a way to get there. Everything else about the team
 * is one tap away on its own page.
 */
export function YourTeam({
  fixtures,
  teams,
  venues,
}: {
  fixtures: Fixture[];
  teams: PickerTeam[];
  venues: { slug: string; latitude: number | null; longitude: number | null }[];
}) {
  const favourites = useFavouriteTeams();
  const followed = favourites.teamIds;

  const mine = useMemo(
    () =>
      fixtures
        .filter(
          (f) =>
            (f.teamAId !== null && followed.includes(f.teamAId)) ||
            (f.teamBId !== null && followed.includes(f.teamBId)),
        )
        .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime)),
    [fixtures, followed],
  );

  const followedTeams = teams.filter((t) => followed.includes(t.id));

  if (followed.length === 0) {
    return (
      <section className={styles.prompt} aria-labelledby="your-team">
        <span className={styles.promptIcon}>
          <StarIcon size={20} />
        </span>
        <div className={styles.promptBody}>
          <h2 id="your-team" className={styles.promptTitle}>
            Playing? Follow your team
          </h2>
          <p className={styles.promptText}>
            Pick your team once and this page leads with your next game — time, court and
            opponent — all day.
          </p>
        </div>
        <FindTeamButton teams={teams} className={`mg-btn mg-btn-plum ${styles.promptButton}`} />
      </section>
    );
  }

  // Live outranks upcoming: if your game is on, that is the game.
  const next =
    mine.find((f) => f.status === "live") ?? mine.find((f) => f.status === "upcoming") ?? null;
  const later = mine.filter((f) => f.status === "upcoming" && f !== next).slice(0, 3);
  const lastResult = [...mine].reverse().find((f) => f.status === "finished") ?? null;

  return (
    <section className={styles.panel} aria-labelledby="your-team">
      <div className={styles.head}>
        <h2 id="your-team" className={styles.title}>
          <StarIcon size={15} filled className={styles.titleStar} />
          Your team
        </h2>
        <FindTeamButton teams={teams} className={styles.manage} label="Edit" />
      </div>

      <div className={styles.teams}>
        {followedTeams.map((team) => (
          <Link key={team.id} href={`/team/${team.id}`} className={styles.teamChip}>
            <SportBadge
              code={team.sportCode}
              color={team.sportColor}
              slug={team.sportSlug}
              size={18}
            />
            {team.name}
          </Link>
        ))}
      </div>

      {next ? (
        <NextGame
          fixture={next}
          followed={followed}
          venue={venues.find((v) => v.slug === next.venueSlug)}
        />
      ) : (
        <p className={styles.done}>
          {lastResult
            ? "Every game played. Thanks for taking part — results are on your team page."
            : "No games found for your teams yet."}
        </p>
      )}

      {later.length > 0 ? (
        <div className={styles.later}>
          <p className="mg-label">Then</p>
          <MatchList>
            {later.map((f) => (
              <MatchRow key={f.id} fixture={f} followed={followed} />
            ))}
          </MatchList>
        </div>
      ) : null}

      <div className={styles.notify}>
        <NotifyToggle />
      </div>
    </section>
  );
}

function NextGame({
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
              <RelTime iso={fixture.scheduledTime} className={styles.nextIn} />
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
          {fixture.sportName} · {fixture.stageLabel}
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
          <span className={styles.kickoff}>{formatTime(fixture.scheduledTime)}</span>
          <span className={styles.whenDay}>{formatDay(fixture.scheduledTime)}</span>
        </span>
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
