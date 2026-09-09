"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { FilterChips, type ChipOption } from "@/components/filter-chips";
import { FixtureCard } from "@/components/fixture-card";
import { StarIcon } from "@/components/icons";
import { ScoreEditor } from "@/components/score-editor";
import { TeamPicker } from "@/components/team-picker";
import {
  STAGE_FILTERS,
  byRelevance,
  filterFixtures,
  isStageFilter,
  type Fixture,
  type StageFilter,
} from "@/lib/fixtures";
import { coordinatorCanEdit, type Coordinator } from "@/lib/coordinator";
import { formatHour, hourKey } from "@/lib/format";
import type { PickerTeam, Sport, Venue } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";
import { useLiveFixtures } from "@/lib/use-live-fixtures";

import styles from "./schedule-view.module.css";

type ScheduleViewProps = {
  fixtures: Fixture[];
  sports: Sport[];
  venues: Venue[];
  teams: PickerTeam[];
  /** Null when nobody is signed in. Decides which fixtures show an Edit button. */
  coordinator: Coordinator | null;
};

/**
 * The schedule screen.
 *
 * All filtering is client-side over the full fixture list. The whole
 * tournament is a few dozen rows, so re-querying per filter change would cost
 * a round trip to save nothing — and it keeps every chip instant on a crowded
 * sports hall's wifi.
 */
export function ScheduleView({
  fixtures: initial,
  sports,
  venues,
  teams,
  coordinator,
}: ScheduleViewProps) {
  const fixtures = useLiveFixtures(initial);
  const favourites = useFavouriteTeams();

  const [sport, setSport] = useState("all");
  const [venue, setVenue] = useState("all");
  const [stage, setStage] = useState<StageFilter>("all");
  const [myGamesOnly, setMyGamesOnly] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<Fixture | null>(null);

  const sportOptions: ChipOption[] = useMemo(
    () => [
      { value: "all", label: "All sports" },
      ...sports.map((s) => ({ value: s.slug, label: s.name, slug: s.slug })),
    ],
    [sports],
  );

  const venueOptions: ChipOption[] = useMemo(
    () => [
      { value: "all", label: "All venues" },
      ...venues.map((v) => ({ value: v.slug, label: v.shortName })),
    ],
    [venues],
  );

  const stageOptions: ChipOption[] = useMemo(
    () => STAGE_FILTERS.map((s) => ({ value: s.value, label: s.label })),
    [],
  );

  const visible = useMemo(
    () =>
      filterFixtures(fixtures, {
        sport,
        venue,
        stage,
        favouriteTeamIds: myGamesOnly ? favourites.teamIds : undefined,
      }).sort(byRelevance),
    [fixtures, sport, venue, stage, myGamesOnly, favourites.teamIds],
  );

  const filtersActive = sport !== "all" || venue !== "all" || stage !== "all" || myGamesOnly;

  /**
   * Kick-off times, grouped by the hour. A flat list of 49 games means a
   * player looking for their next match at 14:00 scrolls past everything that
   * has already been played; an hour heading gives them something to skim.
   *
   * `visible` is already in kick-off order, so one pass builds the blocks.
   */
  const hourBlocks = useMemo(() => {
    // Strictly by kick-off, not by the live-first relevance order the flat
    // list used: an hour heading is a claim about when a game starts, so a
    // finished match sorted to the bottom would open a second 09:00 block
    // below the 16:00 one. The card still says whether it is live or played.
    const chronological = [...visible].sort((a, b) =>
      a.scheduledTime.localeCompare(b.scheduledTime),
    );

    const blocks: { key: string; label: string; fixtures: Fixture[] }[] = [];
    for (const fixture of chronological) {
      const key = hourKey(fixture.scheduledTime);
      const last = blocks[blocks.length - 1];
      if (last?.key === key) last.fixtures.push(fixture);
      else blocks.push({ key, label: formatHour(fixture.scheduledTime), fixtures: [fixture] });
    }
    return blocks;
  }, [visible]);

  const listRef = useRef<HTMLDivElement | null>(null);
  // Once per visit, not on every filter change: re-scrolling the page under
  // someone who just tapped a chip reads as the page fighting them.
  const hasScrolled = useRef(false);

  /**
   * Open the page at the first hour that has not finished yet.
   *
   * All of this lives in the effect rather than in render because it depends
   * on the current time: reading the clock while rendering would give the
   * server and the client different answers and break hydration.
   *
   * Does nothing before the tournament starts, which is the common case for
   * anyone opening the site in the weeks beforehand — jumping them past the
   * filters to the 09:00 block they were already looking at would only hide
   * the heading. Also does nothing once everything has been played, so the
   * page does not fight a visitor scrolling back through results.
   */
  useEffect(() => {
    if (hasScrolled.current || hourBlocks.length === 0) return;

    const now = Date.now();
    const started = hourBlocks.some((b) =>
      b.fixtures.some((f) => new Date(f.scheduledTime).getTime() <= now),
    );
    if (!started) return;

    const target = hourBlocks.find((b) =>
      b.fixtures.some((f) => new Date(f.scheduledTime).getTime() > now),
    );
    if (!target) return;

    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-hour="${CSS.escape(target.key)}"]`,
    );
    if (!el) return;

    hasScrolled.current = true;
    el.scrollIntoView({ block: "start", behavior: "auto" });
  }, [hourBlocks]);

  const resetFilters = () => {
    setSport("all");
    setVenue("all");
    setStage("all");
    setMyGamesOnly(false);
  };

  return (
    <div className="mg-page mg-container-wide" style={{ padding: 0 }}>
      <div className={styles.head}>
        <h1 className="mg-page-title">Schedule</h1>
        <button
          type="button"
          className={`${styles.myGames} ${myGamesOnly ? styles.myGamesOn : ""}`}
          onClick={() => setMyGamesOnly((on) => !on)}
          aria-pressed={myGamesOnly}
        >
          <StarIcon size={14} filled={myGamesOnly} />
          My Games
        </button>
      </div>

      <FilterChips label="Filter by sport" options={sportOptions} value={sport} onChange={setSport} />

      <FilterChips label="Filter by venue" options={venueOptions} value={venue} onChange={setVenue} />

      <FilterChips
        label="Filter by stage"
        options={stageOptions}
        value={stage}
        onChange={(value) => {
          if (isStageFilter(value)) setStage(value);
        }}
      />

      <div className={styles.count}>
        <span>
          {visible.length} {visible.length === 1 ? "game" : "games"}
          {myGamesOnly ? " · My Games" : ""}
        </span>
        <span>
          <button type="button" className={styles.reset} onClick={() => setPickerOpen(true)}>
            Choose teams
          </button>
          {filtersActive ? (
            <button type="button" className={styles.reset} onClick={resetFilters}>
              Clear filters
            </button>
          ) : null}
        </span>
      </div>

      <div className={styles.list} ref={listRef}>
        {hourBlocks.map((block) => (
          <section key={block.key} className={styles.block} data-hour={block.key}>
            <h2 className={styles.hour}>
              <span className={styles.hourTime}>{block.label}</span>
              <span className={styles.hourRule} />
              <span className={styles.hourCount}>
                {block.fixtures.length} {block.fixtures.length === 1 ? "game" : "games"}
              </span>
            </h2>

            <div className={styles.blockGames}>
              {block.fixtures.map((fixture) => (
                <FixtureCard
                  key={fixture.id}
                  fixture={fixture}
                  favourite={favourites.has(fixture.teamAId) || favourites.has(fixture.teamBId)}
                  onToggleFavourite={(f) => favourites.toggle([f.teamAId, f.teamBId])}
                  // Per fixture, not per session: a football coordinator gets the button
                  // on football games only. RLS rejects the write either way, so this
                  // is about not offering an action that would fail.
                  onEdit={
                    coordinatorCanEdit(coordinator, fixture.sportId) ? setEditing : undefined
                  }
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <StarIcon size={40} />
          <p className={styles.emptyTitle}>No games match</p>
          <p className={styles.emptyBody}>
            {myGamesOnly && favourites.teamIds.length === 0
              ? "You haven't followed any teams yet — tap a star on a game, or choose teams."
              : "Try clearing a filter."}
          </p>
        </div>
      ) : null}

      {pickerOpen ? (
        <TeamPicker
          teams={teams}
          selected={favourites.teamIds}
          onToggle={(id) => favourites.toggle([id])}
          onClear={favourites.clear}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}

      {editing ? (
        <ScoreEditor fixture={editing} teams={teams} onClose={() => setEditing(null)} />
      ) : null}
    </div>
  );
}
