"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import type { PickerTeam } from "@/components/schedule-view";

import styles from "./team-picker.module.css";

/**
 * "My Games" team picker.
 *
 * A team's name is not unique across sports, so each row shows the sport too —
 * "KL Tigers · Football" and "KL Tigers · Badminton" are different rows and
 * following one does not follow the other.
 */
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
  const [query, setQuery] = useState("");

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return teams;
    return teams.filter(
      (team) =>
        team.name.toLowerCase().includes(needle) ||
        team.sportName.toLowerCase().includes(needle),
    );
  }, [teams, query]);

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
              Follow your teams
            </h2>
            <p className={styles.subtitle}>
              Saved on this device only — no account needed.
            </p>
          </div>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <CloseIcon size={18} />
          </button>
        </div>

        <input
          className={styles.search}
          type="search"
          placeholder="Search teams or sports"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          aria-label="Search teams"
          autoComplete="off"
        />

        <div className={styles.list}>
          {matches.map((team) => {
            const on = selected.includes(team.id);
            return (
              <button
                key={team.id}
                type="button"
                className={styles.option}
                onClick={() => onToggle(team.id)}
                aria-pressed={on}
              >
                <span className={`${styles.check} ${on ? styles.checkOn : ""}`} aria-hidden="true">
                  ✓
                </span>
                <span className={styles.optionName}>{team.name}</span>
                <span className={styles.optionSport}>{team.sportName}</span>
              </button>
            );
          })}
          {matches.length === 0 ? (
            <p className={styles.emptyList}>No teams match “{query}”.</p>
          ) : null}
        </div>

        <div className={styles.foot}>
          <button type="button" className={styles.clear} onClick={onClear} disabled={selected.length === 0}>
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
