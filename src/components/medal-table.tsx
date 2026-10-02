import type { MedalRow } from "@/lib/medals";

import styles from "./medal-table.module.css";

/**
 * Medals by team. Medals are drawn as coloured discs in the column heads —
 * the convention every Olympic table uses — so the numbers below read without
 * a legend.
 */
export function MedalTable({ rows }: { rows: MedalRow[] }) {
  if (rows.length === 0) {
    return (
      <p className={styles.empty}>
        The medal table fills in as each final is played.
      </p>
    );
  }

  return (
    <div className={styles.wrap}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col" className={styles.rank}>
              <span className="mg-sr-only">Rank</span>
            </th>
            <th scope="col" className={styles.name}>
              Team
            </th>
            <th scope="col" className={styles.medal}>
              <span className={`${styles.disc} ${styles.gold}`} aria-hidden="true" />
              <span className="mg-sr-only">Gold</span>
            </th>
            <th scope="col" className={styles.medal}>
              <span className={`${styles.disc} ${styles.silver}`} aria-hidden="true" />
              <span className="mg-sr-only">Silver</span>
            </th>
            <th scope="col" className={styles.medal}>
              <span className={`${styles.disc} ${styles.bronze}`} aria-hidden="true" />
              <span className="mg-sr-only">Bronze</span>
            </th>
            <th scope="col" className={styles.total}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            // Shared rank on an exact tie, the way medal tables are read.
            const prev = rows[index - 1];
            const tied =
              prev !== undefined &&
              prev.gold === row.gold &&
              prev.silver === row.silver &&
              prev.bronze === row.bronze;
            const rank = tied ? null : index + 1;
            return (
              <tr key={row.name} className={index === 0 ? styles.leader : undefined}>
                <td className={styles.rank}>{rank ?? "="}</td>
                <th scope="row" className={styles.name}>
                  {row.name}
                </th>
                <td className={styles.medal}>{row.gold}</td>
                <td className={styles.medal}>{row.silver}</td>
                <td className={styles.medal}>{row.bronze}</td>
                <td className={styles.total}>{row.total}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className={styles.note}>
        Gold and silver from each final; bronze from third-place play-offs, where played.
      </p>
    </div>
  );
}
