"use client";

import Link from "next/link";
import { useMemo } from "react";

import { FindTeamButton } from "@/components/find-team-button";
import { StarIcon } from "@/components/icons";
import { MatchList, MatchRow } from "@/components/match-row";
import { NextGame } from "@/components/next-game";
import { NotifyToggle } from "@/components/notify-toggle";
import { SportBadge } from "@/components/sport-badge";
import { byKickoff, type Fixture } from "@/lib/fixtures";
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
  // Only teams that still exist: a team followed before the draw was redone
  // would otherwise leave an empty card instead of the prompt to pick again.
  const followed = favourites.teamIds.filter((id) => teams.some((t) => t.id === id));

  const mine = useMemo(
    () =>
      fixtures
        .filter(
          (f) =>
            (f.teamAId !== null && followed.includes(f.teamAId)) ||
            (f.teamBId !== null && followed.includes(f.teamBId)),
        )
        .sort(byKickoff),
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
