import { SportBadge } from "@/components/sport-badge";
import type { Fixture } from "@/lib/fixtures";
import { podiumStatus, type Medallist } from "@/lib/medals";

import styles from "./podium-summary.module.css";

const PLACES = [
  { key: "gold", label: "1st" },
  { key: "silver", label: "2nd" },
  { key: "bronze", label: "3rd" },
] as const;

/**
 * Who won what, every sport at a glance: first, second and third in each
 * category, filled in as finals and third-place games finish.
 */
export function PodiumSummary({ fixtures }: { fixtures: readonly Fixture[] }) {
  const podiums = podiumStatus(fixtures);
  if (podiums.length === 0) return null;
  const decided = podiums.filter((p) => p.gold).length;

  return (
    <details className={styles.wrap} open>
      <summary className={styles.summary}>
        <span className={styles.heading}>Winners</span>
        <span className={styles.count}>
          {decided} of {podiums.length} decided
        </span>
      </summary>
      <ul className={styles.grid}>
        {podiums.map((p) => (
          <li key={p.categoryId} className={styles.card}>
            <p className={styles.title}>
              <SportBadge code={p.sportCode} color={p.sportColor} slug={p.sportSlug} size={22} />
              {p.title}
            </p>
            <ol className={styles.places}>
              {PLACES.map(({ key, label }) => {
                const who: Medallist | null = p[key];
                if (key === "bronze" && !p.hasThirdPlace) return null;
                return (
                  <li key={key} className={styles.place}>
                    <span className={styles.medal} data-medal={key}>
                      {label}
                    </span>
                    <span className={who ? styles.name : styles.tbd}>{who ? who.name : "To be decided"}</span>
                  </li>
                );
              })}
            </ol>
          </li>
        ))}
      </ul>
    </details>
  );
}
