"use client";

import { useNow } from "@/lib/clock";

import styles from "./countdown.module.css";

/**
 * Days, hours, minutes, seconds to `target`, as four scoreboard tiles.
 *
 * Before the client clock starts, the tiles render with placeholder dashes at
 * their final size, so the hero does not jump when the numbers arrive.
 */
export function Countdown({ target, label }: { target: string; label: string }) {
  const now = useNow();
  const remaining = now === null ? null : Math.max(0, Date.parse(target) - now);

  const parts =
    remaining === null
      ? null
      : {
          days: Math.floor(remaining / 86_400_000),
          hours: Math.floor(remaining / 3_600_000) % 24,
          minutes: Math.floor(remaining / 60_000) % 60,
          seconds: Math.floor(remaining / 1000) % 60,
        };

  const tiles: [string, number | undefined][] = [
    ["Days", parts?.days],
    ["Hrs", parts?.hours],
    ["Min", parts?.minutes],
    ["Sec", parts?.seconds],
  ];

  return (
    <div className={styles.countdown} role="timer" aria-label={label}>
      {tiles.map(([unit, value]) => (
        <div key={unit} className={styles.tile}>
          <span className={styles.value}>
            {value === undefined ? "--" : String(value).padStart(2, "0")}
          </span>
          <span className={styles.unit}>{unit}</span>
        </div>
      ))}
    </div>
  );
}
