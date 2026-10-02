"use client";

import Link from "next/link";
import { useMemo } from "react";

import { Countdown } from "@/components/countdown";
import { FindTeamButton } from "@/components/find-team-button";
import { ChevronRightIcon, PinIcon, TrophyIcon } from "@/components/icons";
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
import { formatTime } from "@/lib/format";
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
import type { Announcement, PickerTeam, Sport, Venue } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./home-view.module.css";

type HomeViewProps = {
  fixtures: Fixture[];
  teams: PickerTeam[];
  sports: Sport[];
  venues: Venue[];
  updates: Announcement[];
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
export function HomeView({ fixtures: initial, teams, sports, venues, updates, renderedAt }: HomeViewProps) {
  const fixtures = useLiveFixtures(initial);
  const minute = useMinute();
  const now = minute ?? renderedAt;
  const phase = phaseOf(fixtures, now);
  const favourites = useFavouriteTeams();

  const finals = useMemo(() => podiums(fixtures), [fixtures]);

  return (
    <>
      {phase === "before" ? (
        <BeforeHero fixtures={fixtures} teams={teams} sports={sports} venues={venues} />
      ) : phase === "matchday" ? (
        <MatchdayBand fixtures={fixtures} now={now} />
      ) : (
        <ChampionsBand finals={finals} teams={teams} />
      )}

      <div className={`mg-wrap ${styles.body}`}>
        <div className={styles.main}>
          {phase === "after" ? (
            <section className={styles.sMedals}>
              <SectionHead title="Medal table" href="/standings" action="Standings" />
              <MedalTable
                rows={medalTable(finals, (id) => teams.find((t) => t.id === id)?.university ?? null)}
              />
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
          <div className={styles.sTeam}>
            <YourTeam fixtures={fixtures} teams={teams} venues={venues} />
          </div>

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
    <section className={styles.hero}>
      <div className={`mg-wrap ${styles.heroInner}`}>
        <div className={styles.heroText}>
          <p className={styles.eyebrow}>Malaysian Students&rsquo; Society of Manchester presents</p>
          <h1 className={styles.heroTitle}>
            MGames <span className={styles.heroYear}>2026</span>
          </h1>
          <p className={styles.heroCity}>Manchester</p>
          <p className={styles.heroWhen}>
            Saturday 24 October · Trinity &amp; Sugden Sports Centres
          </p>

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
          <div className={styles.heroClock}>
            <p className={styles.clockLabel}>Until the first whistle</p>
            <Countdown target={new Date(first).toISOString()} label="Time until the first game" />
            <p className={styles.clockFoot}>
              First game {formatTime(new Date(first).toISOString())} · doors 08:30
            </p>
          </div>
        ) : null}
      </div>
    </section>
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

function MatchdayBand({ fixtures, now }: { fixtures: Fixture[]; now: number }) {
  const live = liveFixtures(fixtures);
  const [next] = upNext(fixtures, 1);
  const first = firstKickoff(fixtures);
  const notStarted = live.length === 0 && fixtures.every((f) => f.status === "upcoming");

  return (
    <section className={styles.band} id="live">
      <div className="mg-wrap">
        <div className={styles.bandTop}>
          <p className={styles.bandKicker}>
            <span className={styles.bandGold}>Matchday</span> · Sat 24 October
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
            <h1 className={styles.morningTitle}>Today&rsquo;s the day</h1>
            <Countdown target={new Date(first).toISOString()} label="Time until the first game" />
            <p className={styles.clockFoot}>
              First game {formatTime(new Date(first).toISOString())} · doors 08:30
            </p>
          </div>
        ) : next ? (
          <div className={styles.lull}>
            <p className={styles.lullLabel}>
              Nothing live right now · next up <RelTime iso={next.scheduledTime} />
            </p>
            <div className={styles.boards}>
              <LiveScoreboard fixture={next} />
            </div>
          </div>
        ) : null}
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

function ChampionsBand({ finals, teams }: { finals: Podium[]; teams: PickerTeam[] }) {
  return (
    <section className={styles.band}>
      <div className="mg-wrap">
        <div className={styles.bandTop}>
          <p className={styles.bandKicker}>
            <span className={styles.bandGold}>That&rsquo;s a wrap</span> · MGames 2026
          </p>
        </div>
        <h1 className={styles.championsTitle}>Champions</h1>
        <div className={styles.champions}>
          {finals.map((p) => {
            const university = teams.find((t) => t.id === p.gold.teamId)?.university;
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
                {university ? <span className={styles.championUni}>{university}</span> : null}
                <span className={styles.championScore}>
                  Beat {p.silver.name} {a}–{b}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
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
