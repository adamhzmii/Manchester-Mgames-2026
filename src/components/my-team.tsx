"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FixtureCard } from "@/components/fixture-card";
import { NotifyToggle } from "@/components/notify-toggle";
import { StarIcon } from "@/components/icons";
import { TeamPicker } from "@/components/team-picker";
import { byRelevance, type Fixture } from "@/lib/fixtures";
import type { PickerTeam } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./my-team.module.css";

/** Live games first, then the next one due. More than this is what /schedule is for. */
const MAX_SHOWN = 2;

/**
 * "Your team" on the home page.
 *
 * The picker used to live only behind a small text button in the schedule's
 * filter row, which meant a player had to already know the feature existed to
 * find it. On the day the first thing they want is their own next game, so
 * this asks the question on the home page and then answers it in the same
 * place.
 */
export function MyTeam({ fixtures, teams }: { fixtures: Fixture[]; teams: PickerTeam[] }) {
  const favourites = useFavouriteTeams();
  const [pickerOpen, setPickerOpen] = useState(false);

  const mine = useMemo(() => {
    if (favourites.teamIds.length === 0) return [];
    return fixtures
      .filter(
        (f) =>
          (f.teamAId !== null && favourites.teamIds.includes(f.teamAId)) ||
          (f.teamBId !== null && favourites.teamIds.includes(f.teamBId)),
      )
      .sort(byRelevance);
  }, [fixtures, favourites.teamIds]);

  // Once every one of your games has been played there is no "next" to show,
  // but the section should still say so rather than silently vanish.
  const upcoming = mine.filter((f) => f.status !== "finished").slice(0, MAX_SHOWN);

  const followedNames = useMemo(
    () =>
      teams
        .filter((t) => favourites.teamIds.includes(t.id))
        .map((t) => t.name),
    [teams, favourites.teamIds],
  );

  return (
    <section className={styles.section} aria-labelledby="my-team-heading">
      <div className={styles.head}>
        <h2 id="my-team-heading" className={styles.title}>
          <StarIcon size={17} filled={favourites.teamIds.length > 0} />
          Your team
        </h2>
        {favourites.teamIds.length > 0 ? (
          <button type="button" className={styles.change} onClick={() => setPickerOpen(true)}>
            Change
          </button>
        ) : null}
      </div>

      {favourites.teamIds.length === 0 ? (
        <div className={styles.prompt}>
          <p className={styles.promptTitle}>Playing today?</p>
          <p className={styles.promptBody}>
            Pick your team once and this page will show your next game, all day.
          </p>
          <button type="button" className={styles.promptButton} onClick={() => setPickerOpen(true)}>
            Find my team
          </button>
        </div>
      ) : (
        <div className={styles.body}>
          <p className={styles.following}>
            Following {followedNames.length > 0 ? followedNames.join(", ") : "your teams"}
          </p>

          {upcoming.length > 0 ? (
            <div className={styles.games}>
              {upcoming.map((fixture) => (
                <FixtureCard key={fixture.id} fixture={fixture} />
              ))}
            </div>
          ) : (
            <p className={styles.done}>
              {mine.length > 0
                ? "That's every game played. Final standings are on the Scores page."
                : "No games found for your teams yet."}
            </p>
          )}

          <div className={styles.footRow}>
            <Link href="/schedule" className={styles.allLink}>
              See all your games ›
            </Link>
            <NotifyToggle />
          </div>
        </div>
      )}

      {pickerOpen ? (
        <TeamPicker
          teams={teams}
          selected={favourites.teamIds}
          onToggle={(id) => favourites.toggle([id])}
          onClear={favourites.clear}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </section>
  );
}
