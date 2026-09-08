"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { SportBadge } from "@/components/sport-badge";
import type { PickerTeam } from "@/lib/queries";

import styles from "./team-picker.module.css";

/**
 * "Find my team", as a drill-down rather than one long list.
 *
 * A flat roster does not work here: team names repeat across sports — KL
 * Tigers field a side in Football, Badminton and Table Tennis — so a search
 * for a name returns several visually identical rows that differ only by a
 * small label, and a player has no way to tell which one is theirs.
 *
 * The drill-down follows what a player actually knows, in the order they know
 * it: the sport they are playing, then their category if that sport has more
 * than one, then their team. By the last step every remaining name is unique,
 * so there is nothing left to get wrong. Search still exists for anyone who
 * would rather type, but it is no longer the only way through.
 */
type Step = { kind: "sport" } | { kind: "category"; sportId: string } | { kind: "team"; categoryId: string };

export function TeamPicker({
  teams,
  selected,
  onToggle,
  onClear,
  onClose,
}: {
  teams: PickerTeam[];
  selected: readonly string[];
  onToggle: (teamId: string) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  const [step, setStep] = useState<Step>({ kind: "sport" });
  const [query, setQuery] = useState("");

  const sports = useMemo(() => {
    const seen = new Map<string, PickerTeam>();
    for (const t of teams) if (!seen.has(t.sportId)) seen.set(t.sportId, t);
    return [...seen.values()].sort((a, b) => a.sportOrder - b.sportOrder);
  }, [teams]);

  const categoriesFor = (sportId: string) => {
    const seen = new Map<string, PickerTeam>();
    for (const t of teams) {
      if (t.sportId === sportId && !seen.has(t.categoryId)) seen.set(t.categoryId, t);
    }
    return [...seen.values()].sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  };

  /**
   * Most sports run a single category, and making someone tap through a
   * one-item list is just a wasted step — so it is skipped, and the back
   * button from the team list returns to the sports grid rather than to a
   * category screen the player never saw.
   */
  const chooseSport = (sportId: string) => {
    const categories = categoriesFor(sportId);
    setStep(
      categories.length === 1
        ? { kind: "team", categoryId: categories[0].categoryId }
        : { kind: "category", sportId },
    );
  };

  // Search cuts across every step: typing a name skips the drill-down
  // entirely, and each result still carries its sport and category so two
  // same-named teams remain tellable apart.
  const searchResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return null;
    return teams.filter(
      (t) =>
        t.name.toLowerCase().includes(needle) ||
        t.sportName.toLowerCase().includes(needle) ||
        t.categoryName.toLowerCase().includes(needle),
    );
  }, [teams, query]);

  const back = () => {
    if (step.kind === "team") {
      const team = teams.find((t) => t.categoryId === step.categoryId);
      const siblings = team ? categoriesFor(team.sportId) : [];
      setStep(siblings.length > 1 && team ? { kind: "category", sportId: team.sportId } : { kind: "sport" });
    } else if (step.kind === "category") {
      setStep({ kind: "sport" });
    }
  };

  const heading =
    searchResults !== null
      ? "Search results"
      : step.kind === "sport"
        ? "Which sport are you playing?"
        : step.kind === "category"
          ? "Which category?"
          : "Which team is yours?";

  const sheet = (
    <div
      className={styles.backdrop}
      onPointerDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className={styles.sheet} role="dialog" aria-modal="true" aria-labelledby="team-picker-title">
        <div className={styles.head}>
          <div>
            <h2 id="team-picker-title" className={styles.title}>
              Find your team
            </h2>
            <p className={styles.subtitle}>Saved on this device only — no account needed.</p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <input
          className={styles.search}
          type="search"
          placeholder="Or search a team name"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search teams"
          autoComplete="off"
        />

        <div className={styles.stepHead}>
          {searchResults === null && step.kind !== "sport" ? (
            <button type="button" className={styles.back} onClick={back}>
              ‹ Back
            </button>
          ) : null}
          <p className={styles.stepTitle}>{heading}</p>
        </div>

        <div className={styles.list}>
          {searchResults !== null ? (
            searchResults.length > 0 ? (
              searchResults.map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  showContext
                  selected={selected.includes(team.id)}
                  onToggle={() => onToggle(team.id)}
                />
              ))
            ) : (
              <p className={styles.emptyList}>No teams match &ldquo;{query}&rdquo;.</p>
            )
          ) : step.kind === "sport" ? (
            <div className={styles.sportGrid}>
              {sports.map((s) => (
                <button
                  key={s.sportId}
                  type="button"
                  className={styles.sportTile}
                  onClick={() => chooseSport(s.sportId)}
                >
                  <SportBadge code={s.sportCode} color={s.sportColor} slug={s.sportSlug} size={26} />
                  <span className={styles.sportName}>{s.sportName}</span>
                </button>
              ))}
            </div>
          ) : step.kind === "category" ? (
            categoriesFor(step.sportId).map((c) => (
              <button
                key={c.categoryId}
                type="button"
                className={styles.option}
                onClick={() => setStep({ kind: "team", categoryId: c.categoryId })}
              >
                <span className={styles.optionName}>{c.categoryName}</span>
                <span className={styles.chevron}>›</span>
              </button>
            ))
          ) : (
            teams
              .filter((t) => t.categoryId === step.categoryId)
              .map((team) => (
                <TeamRow
                  key={team.id}
                  team={team}
                  selected={selected.includes(team.id)}
                  onToggle={() => onToggle(team.id)}
                />
              ))
          )}
        </div>

        <div className={styles.foot}>
          <button
            type="button"
            className={styles.clear}
            onClick={onClear}
            disabled={selected.length === 0}
          >
            Clear all ({selected.length})
          </button>
          <button type="button" className={styles.done} onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );

  // Same containing-block problem as the score editor: `.mg-page` keeps a
  // transform after its entry animation, so a `position: fixed` backdrop
  // rendered inside it is measured against the page, not the viewport.
  return typeof document === "undefined" ? null : createPortal(sheet, document.body);
}

function TeamRow({
  team,
  selected,
  onToggle,
  showContext = false,
}: {
  team: PickerTeam;
  selected: boolean;
  onToggle: () => void;
  /** Search results need the sport and category to tell same-named teams apart. */
  showContext?: boolean;
}) {
  return (
    <button type="button" className={styles.option} onClick={onToggle} aria-pressed={selected}>
      <span className={`${styles.check} ${selected ? styles.checkOn : ""}`} aria-hidden="true">
        ✓
      </span>
      <span className={styles.optionBody}>
        <span className={styles.optionName}>{team.name}</span>
        {showContext ? (
          <span className={styles.optionMeta}>
            {team.sportName}
            {team.categoryName ? ` · ${team.categoryName}` : ""}
          </span>
        ) : null}
      </span>
    </button>
  );
}
