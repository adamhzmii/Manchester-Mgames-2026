"use client";

import { useMemo, useState } from "react";

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
import type { Sport, Venue } from "@/lib/queries";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";
import { useLiveFixtures } from "@/lib/use-live-fixtures";

import styles from "./schedule-view.module.css";

export type PickerTeam = {
  id: string;
  name: string;
  sportName: string;
  sportSlug: string;
};

type ScheduleViewProps = {
  fixtures: Fixture[];
  sports: Sport[];
  venues: Venue[];
  teams: PickerTeam[];
  /** Signed in with the shared coordinator credential. */
  canEdit: boolean;
};

/**
 * The schedule screen.
 *
 * All filtering is client-side over the full fixture list. The whole
 * tournament is a few dozen rows, so re-querying per filter change would cost
 * a round trip to save nothing — and it keeps every chip instant on a crowded
 * sports hall's wifi.
 */
export function ScheduleView({ fixtures: initial, sports, venues, teams, canEdit }: ScheduleViewProps) {
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
      ...sports.map((s) => ({ value: s.slug, label: s.name })),
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

      <div className={styles.list}>
        {visible.map((fixture) => (
          <FixtureCard
            key={fixture.id}
            fixture={fixture}
            favourite={favourites.has(fixture.teamAId) || favourites.has(fixture.teamBId)}
            onToggleFavourite={(f) => favourites.toggle([f.teamAId, f.teamBId])}
            onEdit={canEdit ? setEditing : undefined}
          />
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

      {editing ? <ScoreEditor fixture={editing} onClose={() => setEditing(null)} /> : null}
    </div>
  );
}
