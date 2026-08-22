"use client";

import styles from "./filter-chips.module.css";

export type ChipOption = {
  value: string;
  label: string;
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
 */
export function FilterChips({ label, options, value, onChange }: FilterChipsProps) {
  return (
    <div className={`mg-rail ${styles.rail}`} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            className={`${styles.chip} ${selected ? styles.chipOn : ""}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
