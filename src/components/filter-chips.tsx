"use client";

import { useEffect, useRef } from "react";

import { SPORT_ICONS } from "@/components/sport-icons";

import styles from "./filter-chips.module.css";

export type ChipOption = {
  value: string;
  label: string;
  /**
   * Sport slug, where the chip stands for a sport. Optional because these rows
   * also filter by venue and stage, and because "All sports" is a chip with no
   * sport behind it.
   */
  slug?: string;
};

type FilterChipsProps = {
  /** Names the group for screen readers — the chips alone don't say what they filter. */
  label: string;
  options: readonly ChipOption[];
  value: string;
  onChange: (value: string) => void;
};

/**
 * One horizontally scrolling row of single-select filter chips.
 *
 * Rendered as radios rather than buttons so a screen reader announces the
 * group and its current selection, and arrow keys move between options.
 *
 * The chosen chip is scrolled into view: a page opening on Badminton, the
 * sixth of eight, would otherwise look as if nothing were chosen.
 */
export function FilterChips({ label, options, value, onChange }: FilterChipsProps) {
  const rail = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const row = rail.current;
    const chip = row?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (!row || !chip) return;
    // The row only, never the page: scrollIntoView would move the page too.
    const left = chip.offsetLeft - (row.clientWidth - chip.offsetWidth) / 2;
    row.scrollTo({ left: Math.max(0, left) });
  }, [value]);

  return (
    <div ref={rail} className={`mg-rail ${styles.rail}`} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        const Icon = option.slug ? SPORT_ICONS[option.slug] : undefined;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.chip} ${selected ? styles.chipOn : ""}`}
            onClick={() => onChange(option.value)}
          >
            {Icon ? <Icon size={15} className={styles.chipIcon} /> : null}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
