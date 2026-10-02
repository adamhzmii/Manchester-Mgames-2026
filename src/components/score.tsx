"use client";

import { useState } from "react";

/**
 * A score that flashes gold the moment it changes.
 *
 * Someone glancing at their phone between rallies should see what moved
 * without comparing numbers. Only a change flashes — not the first render —
 * so a page full of scores does not light up on load.
 *
 * The previous value is tracked during render rather than in an effect, so
 * the flash starts on the same paint as the new number.
 */
export function Score({ value, className }: { value: number | null; className?: string }) {
  const [shown, setShown] = useState(value);
  const [changes, setChanges] = useState(0);

  if (value !== shown) {
    setShown(value);
    setChanges((n) => n + 1);
  }

  return (
    <span key={changes} className={className} data-flash={changes > 0 ? "" : undefined}>
      {value ?? "–"}
    </span>
  );
}
