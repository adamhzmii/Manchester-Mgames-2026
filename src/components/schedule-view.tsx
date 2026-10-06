"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { LateCourts } from "@/components/delays";
import { FilterChips, type ChipOption } from "@/components/filter-chips";
import { EditIcon, StarIcon } from "@/components/icons";
import { MatchList, MatchRow } from "@/components/match-row";
import { TeamPicker } from "@/components/team-picker";
import type { Coordinator } from "@/lib/coordinator";
import { byKickoff, type Fixture } from "@/lib/fixtures";
import { formatHour, hourKey } from "@/lib/format";
import { useLiveFixtures } from "@/lib/live-feed";
import type { PickerTeam, Sport, Venue } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./schedule-view.module.css";

export type ScheduleFilters = {
  sport: string;
  venue: string;
  mine: boolean;
  live: boolean;
};

type ScheduleViewProps = {
  fixtures: Fixture[];
  sports: Sport[];
  venues: Venue[];
  teams: PickerTeam[];
  coordinator: Coordinator | null;
  initialFilters: ScheduleFilters;
};

/**
 * The schedule: every game of the day, grouped by the hour it starts.
 *
 * Filters live in the URL, so "football at Sugden" is a link someone can send
 * and the back button undoes a tap. Filtering is client-side over the whole
 * list — the tournament is a few dozen rows, and a round trip per chip on a
 * crowded sports hall's wifi would make every tap feel broken.
 */
export function ScheduleView({
  fixtures: initial,
  sports,
  venues,
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

  const update = (patch: Partial<ScheduleFilters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    const params = new URLSearchParams();
    if (next.sport !== "all") params.set("sport", next.sport);
    if (next.venue !== "all") params.set("venue", next.venue);
    if (next.mine) params.set("mine", "1");
    if (next.live) params.set("live", "1");
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  const sportOptions: ChipOption[] = useMemo(
    () => [
      { value: "all", label: "All sports" },
      ...sports.map((s) => ({ value: s.slug, label: s.name, slug: s.slug })),
    ],
    [sports],
  );

  const liveCount = fixtures.filter((f) => f.status === "live").length;

  const visible = useMemo(
    () =>
      fixtures.filter((f) => {
        if (filters.sport !== "all" && f.sportSlug !== filters.sport) return false;
        if (filters.venue !== "all" && f.venueSlug !== filters.venue) return false;
        if (filters.live && f.status !== "live") return false;
        if (filters.mine) {
          const mine =
            (f.teamAId !== null && favourites.teamIds.includes(f.teamAId)) ||
            (f.teamBId !== null && favourites.teamIds.includes(f.teamBId));
          if (!mine) return false;
        }
        return true;
      }),
    [fixtures, filters, favourites.teamIds],
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

  const filtered =
    filters.sport !== "all" || filters.venue !== "all" || filters.mine || filters.live;

  return (
    <div className={styles.page}>
      <div className={`mg-wrap ${styles.head}`}>
        <div>
          <h1 className="mg-page-title">Schedule</h1>
          <p className={styles.sub}>
            Saturday 24 October · {visible.length} of {fixtures.length} games
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
              Signed in as {coordinator.name}. Tap a game to update its score.
            </span>
            {/* The way out on a borrowed or shared phone. */}
            <Link href="/login" className={styles.coordinatorLink}>
              Sign out
            </Link>
          </p>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <FilterChips
          label="Sport"
          options={sportOptions}
          value={filters.sport}
          onChange={(sport) => update({ sport })}
        />
      </div>

      <div className={`mg-wrap ${styles.secondary}`}>
        <div className={styles.segment} role="radiogroup" aria-label="Venue">
          {[{ slug: "all", shortName: "All venues" }, ...venues].map((v) => (
            <button
              key={v.slug}
              type="button"
              role="radio"
              aria-checked={filters.venue === v.slug}
              className={`${styles.segmentItem} ${filters.venue === v.slug ? styles.segmentOn : ""}`}
              onClick={() => update({ venue: v.slug })}
            >
              {v.shortName}
            </button>
          ))}
        </div>

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

        {filtered ? (
          <button
            type="button"
            className={styles.clear}
            onClick={() => update({ sport: "all", venue: "all", mine: false, live: false })}
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="mg-wrap">
        <LateCourts className={styles.late} />
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
                  : "Try a different sport or venue."}
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
