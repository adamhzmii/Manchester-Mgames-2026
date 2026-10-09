"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { LateCourts } from "@/components/delays";
import { FilterChips, type ChipOption } from "@/components/filter-chips";
import { EditIcon, StarIcon } from "@/components/icons";
import { MatchList, MatchRow } from "@/components/match-row";
import { TeamPicker } from "@/components/team-picker";
import { signOut } from "@/lib/actions/auth";
import type { Coordinator } from "@/lib/coordinator";
import { SPORT_KEY, byKickoff, categoriesOf, type Fixture } from "@/lib/fixtures";
import { formatHour, hourKey } from "@/lib/format";
import { useLiveFixtures } from "@/lib/live-feed";
import { arrivedByBackOrForward } from "@/lib/navigation";
import type { PickerTeam, Sport } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";
import { useStored } from "@/lib/use-stored";

import styles from "./schedule-view.module.css";

export type ScheduleFilters = {
  /** The sport asked for in the link, or null to open on the one last looked at. */
  sport: string | null;
  /** A category slug ("md"), for a sport played in several. */
  category: string | null;
  /** One court or pitch, by id; null for all of the sport's. */
  court: string | null;
  mine: boolean;
  live: boolean;
};

type ScheduleViewProps = {
  fixtures: Fixture[];
  sports: Sport[];
  teams: PickerTeam[];
  coordinator: Coordinator | null;
  initialFilters: ScheduleFilters;
};

/**
 * The schedule: one sport's games, grouped by the hour they start.
 *
 * One sport at a time, never all of them: every sport is its own day in its
 * own venue, and three hundred games from eight of them in one list was
 * noise to everyone. Badminton and pickleball narrow again to a category.
 * "My games" is the one view across sports — the teams you follow, wherever
 * they play.
 *
 * Filters live in the URL, so "badminton mixed doubles" is a link someone
 * can send, and the sport is remembered on the phone for next time.
 * Filtering is client-side over the whole list: a round trip per chip on a
 * crowded sports hall's wifi would make every tap feel broken.
 */
export function ScheduleView({
  fixtures: initial,
  sports,
  teams,
  coordinator,
  initialFilters,
}: ScheduleViewProps) {
  const fixtures = useLiveFixtures(initial);
  const favourites = useFavouriteTeams();
  const router = useRouter();
  const pathname = usePathname();

  const [filters, setFilters] = useState(initialFilters);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [storedSport, setStoredSport] = useStored(SPORT_KEY);

  const known = (slug: string | null) => (slug && sports.some((s) => s.slug === slug) ? slug : null);
  const sport = known(filters.sport) ?? known(storedSport) ?? sports[0]?.slug ?? "";

  const sportFixtures = useMemo(() => fixtures.filter((f) => f.sportSlug === sport), [fixtures, sport]);
  const categories = useMemo(() => categoriesOf(sportFixtures), [sportFixtures]);
  const category =
    categories.length > 1
      ? (categories.find((c) => c.slug === filters.category) ?? categories[0])
      : null;

  const update = (patch: Partial<ScheduleFilters>) => {
    const next = { ...filters, sport, ...patch };
    if (patch.sport) {
      setStoredSport(patch.sport);
      if (patch.sport !== sport) {
        next.category = null;
        next.court = null;
      }
    }
    setFilters(next);
    const params = new URLSearchParams();
    if (next.mine) {
      params.set("mine", "1");
    } else {
      if (next.sport) params.set("sport", next.sport);
      if (next.category) params.set("cat", next.category);
      if (next.court) params.set("court", next.court);
    }
    if (next.live) params.set("live", "1");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const sportOptions: ChipOption[] = useMemo(
    () => sports.map((s) => ({ value: s.slug, label: s.name, slug: s.slug })),
    [sports],
  );

  const categoryFixtures = useMemo(
    () => (category ? sportFixtures.filter((f) => f.categoryId === category.id) : sportFixtures),
    [category, sportFixtures],
  );

  // The courts and pitches this sport (and category) is played on, in order:
  // Pitch A before Pitch B, Hall C2 before Hall C10.
  const courts = useMemo(() => {
    const found = new Map<string, string>();
    for (const f of categoryFixtures) {
      if (f.courtId && f.courtName !== "TBC") found.set(f.courtId, f.courtName);
    }
    return [...found].sort(([, a], [, b]) => a.localeCompare(b, undefined, { numeric: true }));
  }, [categoryFixtures]);
  const court = courts.some(([id]) => id === filters.court) ? filters.court : null;

  // "My games" crosses sports; everything else is the sport, category and court chosen.
  const scope = useMemo(
    () =>
      filters.mine
        ? fixtures.filter(
            (f) =>
              (f.teamAId !== null && favourites.teamIds.includes(f.teamAId)) ||
              (f.teamBId !== null && favourites.teamIds.includes(f.teamBId)),
          )
        : court
          ? categoryFixtures.filter((f) => f.courtId === court)
          : categoryFixtures,
    [filters.mine, fixtures, favourites.teamIds, court, categoryFixtures],
  );

  const liveCount = scope.filter((f) => f.status === "live").length;

  const visible = useMemo(
    () => (filters.live ? scope.filter((f) => f.status === "live") : scope),
    [scope, filters.live],
  );

  /**
   * Grouped by kick-off hour, strictly in time order — an hour heading is a
   * claim about when a game starts, so a finished match sorted elsewhere would
   * open a second 09:00 block under the 16:00 one.
   *
   * One block per hour whatever the order, too: the hour is each block's key,
   * and two blocks sharing one left React unable to tell them apart, so
   * filtering kept stale games on screen under the right count.
   */
  const blocks = useMemo(() => {
    const byHour = new Map<string, { key: string; label: string; fixtures: Fixture[] }>();
    for (const fixture of [...visible].sort(byKickoff)) {
      const key = hourKey(fixture.scheduledTime);
      const block = byHour.get(key);
      if (block) block.fixtures.push(fixture);
      else byHour.set(key, { key, label: formatHour(fixture.scheduledTime), fixtures: [fixture] });
    }
    return [...byHour.values()];
  }, [visible]);

  // The hour the day is up to: the first block with a game still to finish.
  const nowKey = useMemo(() => {
    const started = fixtures.some((f) => f.status !== "upcoming");
    if (!started) return null;
    return blocks.find((b) => b.fixtures.some((f) => f.status !== "finished"))?.key ?? null;
  }, [blocks, fixtures]);

  // Open at "now", once per visit, and only once the day has begun: before
  // then the top of the list is the right place to be, and re-scrolling under
  // someone who just tapped a filter reads as the page fighting them.
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrolled = useRef(false);
  useEffect(() => {
    if (scrolled.current || nowKey === null) return;
    // Back from a game: the browser puts the list where it was, and jumping
    // to "now" would lose the visitor's place.
    if (arrivedByBackOrForward()) {
      scrolled.current = true;
      return;
    }
    const target = listRef.current?.querySelector<HTMLElement>(
      `[data-hour="${CSS.escape(nowKey)}"]`,
    );
    if (!target) return;
    scrolled.current = true;
    // The first block is already at the top; scrolling there would only hide
    // the filters.
    if (target !== listRef.current?.firstElementChild) {
      target.scrollIntoView({ block: "start" });
    }
  }, [nowKey]);

  return (
    <div className={styles.page}>
      <div className={`mg-wrap ${styles.head}`}>
        <div>
          <h1 className="mg-page-title">Schedule</h1>
          <p className={styles.sub}>
            Saturday 24 October · {visible.length} {visible.length === 1 ? "game" : "games"}
          </p>
        </div>
        <button
          type="button"
          className={`${styles.mine} ${filters.mine ? styles.mineOn : ""}`}
          onClick={() => {
            if (favourites.teamIds.length === 0) setPickerOpen(true);
            else update({ mine: !filters.mine });
          }}
          aria-pressed={filters.mine}
        >
          <StarIcon size={15} filled={filters.mine} />
          My games
        </button>
      </div>

      {coordinator ? (
        <div className="mg-wrap">
          <p className={styles.coordinator}>
            <EditIcon size={16} />
            <span className={styles.coordinatorText}>
              Signed in as {coordinator.name}.{" "}
              <Link href="/coordinate" className={styles.coordinatorLink}>
                Court sheet
              </Link>
            </span>
            {/* The way out on a borrowed or shared phone. */}
            <form action={signOut}>
              <button type="submit" className={styles.coordinatorLink}>
                Sign out
              </button>
            </form>
          </p>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <FilterChips
          label="Sport"
          options={sportOptions}
          // Nothing picked while "My games" shows every sport; a tap goes back to one.
          value={filters.mine ? "" : sport}
          onChange={(next) => update({ sport: next, mine: false })}
        />
      </div>

      <div className={`mg-wrap ${styles.secondary}`}>
        {category && !filters.mine ? (
          <div className={styles.categories} role="radiogroup" aria-label="Category">
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                role="radio"
                aria-checked={c.slug === category.slug}
                className={`${styles.category} ${c.slug === category.slug ? styles.categoryOn : ""}`}
                onClick={() => update({ category: c.slug })}
              >
                {c.name}
              </button>
            ))}
          </div>
        ) : null}

        {courts.length > 1 && !filters.mine ? (
          <div className={styles.courts} role="radiogroup" aria-label="Court">
            {[["", "All courts"] as const, ...courts].map(([id, name]) => {
              const on = (court ?? "") === id;
              return (
                <button
                  key={id || "all"}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`${styles.category} ${on ? styles.categoryOn : ""}`}
                  onClick={() => update({ court: id || null })}
                >
                  {name}
                </button>
              );
            })}
          </div>
        ) : null}

        {liveCount > 0 || filters.live ? (
          <button
            type="button"
            className={`${styles.liveToggle} ${filters.live ? styles.liveToggleOn : ""}`}
            onClick={() => update({ live: !filters.live })}
            aria-pressed={filters.live}
          >
            <span className={styles.liveDot} aria-hidden="true" />
            Live <span className="mg-num">{liveCount}</span>
          </button>
        ) : null}

      </div>

      <div className="mg-wrap">
        <LateCourts
          className={styles.late}
          sport={filters.mine ? undefined : sport}
          court={filters.mine ? undefined : courts.find(([id]) => id === court)?.[1]}
        />
      </div>

      <div className={`mg-wrap ${styles.blocks}`} ref={listRef}>
        {blocks.map((block) => {
          const isNow = block.key === nowKey;
          const past = block.fixtures.every((f) => f.status === "finished");
          return (
            <section
              key={block.key}
              className={styles.block}
              data-hour={block.key}
              data-past={past ? "" : undefined}
            >
              <h2 className={styles.hour}>
                <span className={styles.hourTime}>{block.label}</span>
                {isNow ? <span className={styles.now}>Now</span> : null}
                <span className={styles.hourRule} />
                <span className={styles.hourCount}>
                  {block.fixtures.length} {block.fixtures.length === 1 ? "game" : "games"}
                </span>
              </h2>
              <MatchList>
                {block.fixtures.map((fixture) => (
                  <MatchRow key={fixture.id} fixture={fixture} followed={favourites.teamIds} />
                ))}
              </MatchList>
            </section>
          );
        })}

        {visible.length === 0 ? (
          <div className={styles.empty}>
            <p className={styles.emptyTitle}>No games match</p>
            <p className={styles.emptyBody}>
              {filters.mine && favourites.teamIds.length === 0
                ? "You aren't following a team yet."
                : filters.live
                  ? "Nothing is live with these filters right now."
                  : "No games here yet."}
            </p>
            {filters.mine && favourites.teamIds.length === 0 ? (
              <button type="button" className="mg-btn mg-btn-plum" onClick={() => setPickerOpen(true)}>
                <StarIcon size={16} />
                Find your team
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      {pickerOpen ? (
        <TeamPicker
          teams={teams}
          selected={favourites.teamIds}
          onToggle={(id) => favourites.toggle([id])}
          onClear={favourites.clear}
          onClose={() => {
            setPickerOpen(false);
            if (favourites.teamIds.length > 0) update({ mine: true });
          }}
        />
      ) : null}
    </div>
  );
}
