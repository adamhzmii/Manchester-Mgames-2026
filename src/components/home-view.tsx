"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Countdown } from "@/components/countdown";
import { FindTeamButton } from "@/components/find-team-button";
import { CalendarIcon, ChevronRightIcon, PinIcon, TrophyIcon } from "@/components/icons";
import { LiveScoreboard } from "@/components/live-scoreboard";
import { MatchList, MatchRow } from "@/components/match-row";
import { MedalTable } from "@/components/medal-table";
import { RelTime } from "@/components/rel-time";
import { SectionHead } from "@/components/section-head";
import { SportBadge } from "@/components/sport-badge";
import { UpdateTypeIcon, UPDATE_TYPE_LABEL } from "@/components/update-type-icon";
import { YourTeam } from "@/components/your-team";
import { useMinute } from "@/lib/clock";
import type { Fixture } from "@/lib/fixtures";
import { formatPrice, formatTime } from "@/lib/format";
import { useLiveFixtures } from "@/lib/live-feed";
import {
  firstKickoff,
  latestResults,
  liveFixtures,
  phaseOf,
  upNext,
  type Phase,
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
          <Masthead />
          {phase === "before" ? (
            <BeforeHero fixtures={fixtures} teams={teams} sports={sports} venues={venues} />
          ) : phase === "matchday" ? (
            <MatchdayLive fixtures={fixtures} now={now} />
          ) : (
            <Champions finals={finals} />
          )}
        </div>
      </section>

      <div className={`mg-wrap ${styles.body}`}>
        <div className={styles.main}>
          {phase === "after" ? (
            <section className={styles.sMedals}>
              <SectionHead title="Medal table" href="/standings" action="Standings" />
              <MedalTable rows={medalTable(finals)} />
            </section>
          ) : null}

          {phase === "matchday" ? (
            <section className={styles.sNext}>
              <SectionHead title="Up next" href="/schedule" action="Full schedule" />
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
                      .sort((a, b) => b.scheduledTime.localeCompare(a.scheduledTime))
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
          {/* Once it is all over, "follow your team to see your next game"
              has nothing left to offer; a team already followed still shows. */}
          {phase !== "after" || favourites.teamIds.length > 0 ? (
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
function Masthead() {
  return (
    <div className={styles.masthead}>
      <p className={styles.mastKicker}>Malaysian Students&rsquo; Society · Manchester</p>
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
          Trinity &amp; Sugden
        </span>
      </div>
    </div>
  );
}

// ------------------------------------------------------------- before ----

function BeforeHero({
  fixtures,
  teams,
  sports,
  venues,
}: {
  fixtures: Fixture[];
  teams: PickerTeam[];
  sports: Sport[];
  venues: Venue[];
}) {
  const first = firstKickoff(fixtures);

  return (
    <>
      <div className={styles.beforeExtra}>
        <dl className={styles.stats}>
          <Stat value={sports.length} label="Sports" />
          <Stat value={teams.length} label="Teams" />
          <Stat value={fixtures.length} label="Matches" />
          <Stat value={venues.length} label="Venues" />
        </dl>

        <div className={styles.ctas}>
          <FindTeamButton teams={teams} className="mg-btn mg-btn-gold" />
          <Link href="/schedule" className={`mg-btn mg-btn-ghost ${styles.ghostLight}`}>
            The schedule
          </Link>
        </div>
      </div>

      {first !== null ? (
        <div className={styles.beforeClock}>
          <p className={styles.clockLabel}>Until the first whistle</p>
          <Countdown target={new Date(first).toISOString()} label="Time until the first game" />
          <p className={styles.clockFoot}>
            First game {formatTime(new Date(first).toISOString())} · doors 08:30
          </p>
        </div>
      ) : null}
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className={styles.stat}>
      <dt className={styles.statLabel}>{label}</dt>
      <dd className={styles.statValue}>{value}</dd>
    </div>
  );
}

// ----------------------------------------------------------- matchday ----

function MatchdayLive({ fixtures, now }: { fixtures: Fixture[]; now: number }) {
  const live = liveFixtures(fixtures);
  const [next] = upNext(fixtures, 1);
  const first = firstKickoff(fixtures);
  const notStarted = live.length === 0 && fixtures.every((f) => f.status === "upcoming");

  return (
    // "Live" in the header links here, past the masthead to the scores.
    <div className={styles.phaseBlock} id="live">
      <div className={styles.bandTop}>
        <p className={styles.bandKicker}>
          <span className={styles.bandGold}>Matchday</span>
          {live.length === 0 && next && !notStarted ? " · between games" : null}
        </p>
        {live.length > 0 ? (
          <p className={styles.bandCount}>
            <span className={styles.bandDot} aria-hidden="true" />
            {live.length} live now
          </p>
        ) : null}
      </div>

      {live.length > 0 ? (
        <div className={styles.boards}>
          {live.map((f) => (
            <LiveScoreboard key={f.id} fixture={f} />
          ))}
        </div>
      ) : notStarted && first !== null && now < first ? (
        <div className={styles.morning}>
          <p className={styles.morningTitle}>Today&rsquo;s the day</p>
          <Countdown target={new Date(first).toISOString()} label="Time until the first game" />
          <p className={styles.clockFoot}>
            First game {formatTime(new Date(first).toISOString())} · doors 08:30
          </p>
        </div>
      ) : next ? (
        <div className={styles.lull}>
          <p className={styles.lullLabel}>
            Next up <RelTime iso={next.scheduledTime} />
          </p>
          <div className={styles.boards}>
            <LiveScoreboard fixture={next} />
          </div>
        </div>
      ) : null}
    </div>
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
            href={`/food?venue=${v.venueSlug}#${v.id}`}
            className={styles.foodTile}
          >
            <span className={styles.foodCuisine}>{v.cuisine}</span>
            <span className={styles.foodName}>{v.name}</span>
            {v.tagline ? <span className={styles.foodTagline}>{v.tagline}</span> : null}
            <span className={styles.foodFoot}>
              <span className={styles.foodWhere}>
                <PinIcon size={13} />
                {v.venueShortName}
              </span>
              {from !== null ? <span className={styles.foodFrom}>from {formatPrice(from)}</span> : null}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
