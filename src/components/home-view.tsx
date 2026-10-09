"use client";

import Link from "next/link";
import { useMemo } from "react";

import { LateCourts } from "@/components/delays";
import { FindTeamButton } from "@/components/find-team-button";
import { CalendarIcon, ChevronRightIcon, PinIcon, TrophyIcon } from "@/components/icons";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { MatchList, MatchRow } from "@/components/match-row";
import { MedalTable } from "@/components/medal-table";
import { SectionHead } from "@/components/section-head";
import { SportBadge } from "@/components/sport-badge";
import { UpdateTypeIcon, UPDATE_TYPE_LABEL } from "@/components/update-type-icon";
import { YourTeam } from "@/components/your-team";
import { useMinute } from "@/lib/clock";
import { byKickoff, type Fixture } from "@/lib/fixtures";
import { formatPrice, formatTime } from "@/lib/format";
import { useLiveFixtures } from "@/lib/live-feed";
import {
  daysUntil,
  firstKickoff,
  latestResults,
  liveFixtures,
  type Phase,
  phaseOf,
  upNext,
} from "@/lib/matchday";
import { medalTable, podiums, type Podium } from "@/lib/medals";
import type { Announcement, PickerTeam, Sport, Vendor, Venue } from "@/lib/queries";
import { fromPrice } from "@/lib/vendors";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./home-view.module.css";

type HomeViewProps = {
  fixtures: Fixture[];
  teams: PickerTeam[];
  sports: Sport[];
  venues: Venue[];
  updates: Announcement[];
  vendors: Vendor[];
  /** The server's "now", so the first client render picks the same phase. */
  renderedAt: number;
};

/**
 * The home page, which is three different pages depending on the day.
 *
 *   before   — a countdown, how to find your team, what is on and where
 *   matchday — what is live, what is next, your next game, the latest news
 *   after    — champions and the medal table
 *
 * Reads the shared live feed, so a game going live while the page is open
 * flips it into matchday without a reload.
 */
export function HomeView({
  fixtures: initial,
  teams,
  sports,
  venues,
  updates,
  vendors,
  renderedAt,
}: HomeViewProps) {
  const fixtures = useLiveFixtures(initial);
  const minute = useMinute();
  const now = minute ?? renderedAt;
  const phase = phaseOf(fixtures, now);
  const favourites = useFavouriteTeams();

  const finals = useMemo(() => podiums(fixtures), [fixtures]);

  return (
    <>
      {/* One photo band: the event's name first, whatever the day, then what
          the day calls for under it. Someone arriving from a link in a group
          chat should see "Manchester MGames 2026" before anything else. */}
      <section className={styles.top}>
        <div className={`mg-wrap ${styles.topInner}`} data-phase={phase}>
          <Masthead venues={venues} />
          {phase === "before" || phase === "matchday" ? (
            <DayHero
              phase={phase}
              fixtures={fixtures}
              now={now}
              teams={teams}
              venues={venues}
              following={favourites.teamIds.some((id) => teams.some((t) => t.id === id))}
            />
          ) : (
            <Champions finals={finals} />
          )}
        </div>
      </section>

      <div className={`mg-wrap ${styles.body}`}>
        <div className={styles.main}>
          {phase === "matchday" ? <LiveNow fixtures={fixtures} /> : null}

          {phase === "after" ? (
            <section className={styles.sMedals}>
              <SectionHead title="Medal table" href="/standings" action="Standings" />
              <MedalTable rows={medalTable(finals)} />
            </section>
          ) : null}

          {phase === "matchday" ? (
            <section className={styles.sNext}>
              <SectionHead title="Up next" href="/schedule" action="Full schedule" />
              <LateCourts className={styles.late} />
              <UpNextList fixtures={fixtures} followed={favourites.teamIds} />
            </section>
          ) : null}

          {phase === "before" ? (
            <section className={styles.sNext}>
              <SectionHead title="Opening games" href="/schedule" action="Full schedule" />
              <MatchList>
                {upNext(fixtures, 6).map((f) => (
                  <MatchRow key={f.id} fixture={f} followed={favourites.teamIds} />
                ))}
              </MatchList>
            </section>
          ) : null}

          {/* Selling the stalls out is part of the job, so they get a place on
              the page everyone lands on — before and during the day, not after
              it is over. */}
          {phase !== "after" && vendors.length > 0 ? (
            <section className={styles.sFood}>
              <SectionHead title="Food & drink" count={vendors.length} href="/food" action="All stalls" />
              <FoodRail vendors={vendors} />
            </section>
          ) : null}

          {phase !== "before" ? (
            <section className={styles.sResults}>
              <SectionHead
                title={phase === "after" ? "Finals" : "Latest results"}
                href="/schedule"
                action="All results"
              />
              <MatchList>
                {(phase === "after"
                  ? fixtures
                      .filter((f) => f.stage === "final")
                      .sort((a, b) => byKickoff(b, a))
                  : latestResults(fixtures, 5)
                ).map((f) => (
                  <MatchRow key={f.id} fixture={f} followed={favourites.teamIds} />
                ))}
              </MatchList>
            </section>
          ) : null}

          <section className={styles.sSports}>
            <SectionHead title="The sports" count={sports.length} href="/standings" action="Standings" />
            <SportGrid sports={sports} teams={teams} fixtures={fixtures} phase={phase} />
          </section>
        </div>

        <aside className={styles.aside}>
          {/* On the day it leads the page, in the band above. Once it is all
              over, "follow your team to see your next game" has nothing left
              to offer; a team already followed still shows. */}
          {phase === "after" && favourites.teamIds.length > 0 ? (
            <div className={styles.sTeam}>
              <YourTeam fixtures={fixtures} teams={teams} venues={venues} />
            </div>
          ) : null}

          {updates.length > 0 ? (
            <section className={styles.sUpdates}>
              <SectionHead title="Updates" href="/updates" />
              <UpdatesList updates={updates} />
            </section>
          ) : null}

          <section className={styles.sVenues}>
            <SectionHead title="Venues" href="/venues" action="Venue guide" />
            <VenueCards venues={venues} fixtures={fixtures} phase={phase} />
          </section>
        </aside>
      </div>
    </>
  );
}

// ----------------------------------------------------------- masthead ----

/** The event's name, as a poster would set it, at the top of every phase. */
function Masthead({ venues }: { venues: Venue[] }) {
  // "Trinity, Sugden & Denmark Road", from the venues there are.
  const names = venues.map((v) => v.shortName);
  const where =
    names.length > 1 ? `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}` : names[0];

  return (
    <div className={styles.masthead}>
      <p className={styles.mastKicker}>Malaysian Students&rsquo; Society Manchester</p>
      <h1 className={styles.mastTitle}>
        Manchester
        <br />
        MGames <span className={styles.gold}>2026</span>
      </h1>
      <div className={styles.mastFacts}>
        <span className={styles.mastFact}>
          <CalendarIcon size={15} className={styles.mastIcon} />
          Sat 24 October 2026
        </span>
        <span className={styles.mastFact}>
          <PinIcon size={15} className={styles.mastIcon} />
          {where}
        </span>
      </div>
    </div>
  );
}

// ----------------------------------------------------------- matchday ----

/**
 * Under the event's name, from a player's side: their own next game — time,
 * court, opponent, whether it is running late — before the day and on it.
 * Somebody else's live semi-final can wait a scroll; so can the counts of
 * sports and teams and a ticking countdown, which used to fill the first
 * screen before the day. Not following a team yet, the same spot asks them
 * to, in one line.
 */
function DayHero({
  phase,
  fixtures,
  now,
  teams,
  venues,
  following,
}: {
  phase: "before" | "matchday";
  fixtures: Fixture[];
  now: number;
  teams: PickerTeam[];
  venues: Venue[];
  following: boolean;
}) {
  const live = liveFixtures(fixtures);
  const first = firstKickoff(fixtures);
  const notStarted = live.length === 0 && fixtures.every((f) => f.status === "upcoming");

  return (
    <div className={styles.phaseBlock}>
      <div className={styles.bandTop}>
        <p className={styles.bandKicker}>
          {phase === "before" && first !== null ? (
            <>
              <span className={styles.bandGold}>{daysToGo(now, first)}</span> · first game{" "}
              {formatTime(new Date(first).toISOString())}
            </>
          ) : (
            <>
              <span className={styles.bandGold}>Matchday</span>
              {notStarted && first !== null && now < first
                ? ` · first game ${formatTime(new Date(first).toISOString())}`
                : null}
            </>
          )}
        </p>
        {live.length > 0 ? (
          <a href="#live" className={styles.bandCount}>
            <span className={styles.bandDot} aria-hidden="true" />
            {live.length} live now
          </a>
        ) : null}
      </div>

      {following ? (
        <div className={styles.heroCard}>
          <YourTeam fixtures={fixtures} teams={teams} venues={venues} />
        </div>
      ) : (
        <div className={styles.followCta}>
          <p className={styles.followText}>
            <strong>{phase === "before" ? "Playing?" : "Playing today?"}</strong> Follow your team,
            and this spot shows your next game: time, court, opponent, and whether it&rsquo;s
            running late.
          </p>
          <FindTeamButton teams={teams} className={`mg-btn mg-btn-gold ${styles.followButton}`} />
        </div>
      )}
    </div>
  );
}

/** "17 days to go", "Tomorrow", "Today". */
function daysToGo(now: number, first: number): string {
  const days = daysUntil(now, first);
  return days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `${days} days to go`;
}

/** Every game being played right now, under the player's own. */
function LiveNow({ fixtures }: { fixtures: Fixture[] }) {
  const live = liveFixtures(fixtures);
  if (live.length === 0) return null;
  return (
    // "Live" in the header links here.
    <section className={styles.sLive} id="live">
      <SectionHead title="Live now" count={live.length} href="/schedule" action="Schedule" />
      <div className={styles.boards}>
        {live.map((f) => (
          <LiveScoreboard key={f.id} fixture={f} />
        ))}
      </div>
    </section>
  );
}

function UpNextList({ fixtures, followed }: { fixtures: Fixture[]; followed: readonly string[] }) {
  const next = upNext(fixtures, 6);
  if (next.length === 0) {
    return <p className={styles.empty}>Every game has started. Results are below.</p>;
  }
  return (
    <MatchList>
      {next.map((f) => (
        <MatchRow key={f.id} fixture={f} followed={followed} />
      ))}
    </MatchList>
  );
}

// -------------------------------------------------------------- after ----

function Champions({ finals }: { finals: Podium[] }) {
  return (
    <div className={styles.phaseBlock}>
      <div className={styles.bandTop}>
        <p className={styles.bandKicker}>
          <span className={styles.bandGold}>That&rsquo;s a wrap</span> · thanks for coming
        </p>
      </div>
      <h2 className={styles.championsTitle}>Champions</h2>
      <div className={styles.champions}>
        {finals.map((p) => {
          const [a, b] =
            p.final.teamAId === p.gold.teamId
              ? [p.final.scoreA, p.final.scoreB]
              : [p.final.scoreB, p.final.scoreA];
          return (
            <Link key={p.categoryId} href={`/match/${p.final.id}`} className={styles.champion}>
              <span className={styles.championSport}>
                <SportBadge code={p.sportCode} color={p.sportColor} slug={p.sportSlug} size={22} />
                {p.title}
              </span>
              <span className={styles.championName}>
                <TrophyIcon size={20} className={styles.championCup} />
                {p.gold.name}
              </span>
              <span className={styles.championScore}>
                Beat {p.silver.name}{" "}
                <span className={styles.nowrap}>
                  {a}–{b}
                </span>
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ------------------------------------------------------------- shared ----

function SportGrid({
  sports,
  teams,
  fixtures,
  phase,
}: {
  sports: Sport[];
  teams: PickerTeam[];
  fixtures: Fixture[];
  phase: Phase;
}) {
  return (
    <div className={styles.sports}>
      {sports.map((sport) => {
        const games = fixtures.filter((f) => f.sportSlug === sport.slug);
        const teamCount = teams.filter((t) => t.sportSlug === sport.slug).length;
        // Real groups, not the stage label: badminton's opening round is stored
        // as a group-stage game but it has no group table behind it.
        const hasGroups = games.some((f) => f.groupId !== null);
        const live = games.filter((f) => f.status === "live").length;
        const next = upNext(games, 1)[0];
        const champion = podiums(games)[0]?.gold.name;

        let status: React.ReactNode;
        if (phase === "after" && champion) {
          status = (
            <span className={styles.sportChamp}>
              <TrophyIcon size={13} /> {champion}
            </span>
          );
        } else if (live > 0) {
          status = <span className={styles.sportLive}>{live} live</span>;
        } else if (next) {
          status = <span>Next {formatTime(next.scheduledTime)}</span>;
        } else {
          status = <span>All played</span>;
        }

        return (
          <Link key={sport.id} href={`/standings?sport=${sport.slug}`} className={styles.sportTile}>
            <SportBadge code={sport.code} color={sport.color} slug={sport.slug} size={34} />
            <span className={styles.sportText}>
              <span className={styles.sportName}>{sport.name}</span>
              <span className={styles.sportMeta}>
                {teamCount} teams · {hasGroups ? "Groups + knockout" : "Knockout"}
              </span>
              <span className={styles.sportStatus}>{status}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function UpdatesList({ updates }: { updates: Announcement[] }) {
  return (
    <ul className={styles.updates}>
      {updates.map((u) => (
        <li key={u.id}>
          <Link href="/updates" className={styles.update} data-type={u.type}>
            <span className={styles.updateIcon}>
              <UpdateTypeIcon type={u.type} size={16} />
            </span>
            <span className={styles.updateText}>
              <span className={styles.updateMeta}>
                {UPDATE_TYPE_LABEL[u.type]} · {formatTime(u.publishedAt)}
              </span>
              <span className={styles.updateTitle}>{u.title}</span>
            </span>
            <ChevronRightIcon size={16} className={styles.updateChevron} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function VenueCards({
  venues,
  fixtures,
  phase,
}: {
  venues: Venue[];
  fixtures: Fixture[];
  phase: Phase;
}) {
  return (
    <div className={styles.venues}>
      {venues.map((venue) => {
        const here = fixtures.filter((f) => f.venueSlug === venue.slug);
        const sports = [...new Map(here.map((f) => [f.sportSlug, f])).values()].sort(
          (a, b) => a.sportOrder - b.sportOrder,
        );
        const live = here.filter((f) => f.status === "live").length;
        const directions =
          venue.latitude !== null && venue.longitude !== null
            ? `https://www.google.com/maps/dir/?api=1&destination=${venue.latitude},${venue.longitude}`
            : null;

        return (
          <div key={venue.id} className={styles.venue}>
            <div className={styles.venueHead}>
              <h3 className={styles.venueName}>{venue.name}</h3>
              {phase === "matchday" && live > 0 ? (
                <span className={styles.venueLive}>{live} live</span>
              ) : null}
            </div>
            {venue.address ? (
              <p className={styles.venueAddress}>
                <PinIcon size={14} />
                {venue.address}
              </p>
            ) : null}
            <div className={styles.venueSports}>
              {sports.map((f) => (
                <span key={f.sportSlug} className={styles.venueSport}>
                  <SportBadge code={f.sportCode} color={f.sportColor} slug={f.sportSlug} size={18} />
                  {f.sportName}
                </span>
              ))}
            </div>
            <div className={styles.venueActions}>
              <Link href={`/venues?v=${venue.slug}`}>Venue guide</Link>
              {directions ? (
                <a href={directions} target="_blank" rel="noreferrer">
                  Directions
                </a>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function FoodRail({ vendors }: { vendors: Vendor[] }) {
  return (
    <div className={styles.foodRail}>
      {vendors.map((v) => {
        const from = fromPrice(v);
        return (
          <Link
            key={v.id}
            href={v.venueSlug ? `/food?venue=${v.venueSlug}#${v.id}` : `/food#${v.id}`}
            className={styles.foodTile}
          >
            <span className={styles.foodCuisine}>{v.cuisine}</span>
            <span className={styles.foodName}>{v.name}</span>
            {v.tagline ? <span className={styles.foodTagline}>{v.tagline}</span> : null}
            <span className={styles.foodFoot}>
              {v.venueShortName ? (
                <span className={styles.foodWhere}>
                  <PinIcon size={13} />
                  {v.venueShortName}
                </span>
              ) : (
                <span />
              )}
              {from !== null ? <span className={styles.foodFrom}>from {formatPrice(from)}</span> : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
