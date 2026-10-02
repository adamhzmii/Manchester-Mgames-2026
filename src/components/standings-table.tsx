import Link from "next/link";

import type { Fixture } from "@/lib/fixtures";
import { teamForm, type StandingsGroup } from "@/lib/standings";

import styles from "./standings-table.module.css";

/**
 * One group's table. Qualifying places are marked with a green tick in the
 * margin and a dashed line under the last of them — the cut — so "are we
 * through?" is answered without reading a number.
 */
export function StandingsTable({
  group,
  fixtures,
  highlight = [],
  qualifying = 2,
  captionHidden = false,
}: {
  group: StandingsGroup;
  fixtures: readonly Fixture[];
  /** Team ids to emphasise — the two sides of an open match, or followed teams. */
  highlight?: readonly string[];
  qualifying?: number;
  /** When the page already heads the table with the group's name. */
  captionHidden?: boolean;
}) {
  return (
    <div className={styles.card}>
      <table className={styles.table}>
        <caption className={captionHidden ? "mg-sr-only" : styles.caption}>{group.groupName}</caption>
        <thead>
          <tr>
            <th scope="col" className={styles.pos}>
              <span className="mg-sr-only">Position</span>
            </th>
            <th scope="col" className={styles.team}>
              Team
            </th>
            <th scope="col" title="Played">P</th>
            <th scope="col" title="Won">W</th>
            <th scope="col" title="Drawn">D</th>
            <th scope="col" title="Lost">L</th>
            <th scope="col" title="Score difference" className={styles.diff}>
              +/−
            </th>
            <th scope="col" className={styles.form}>
              Form
            </th>
            <th scope="col" title="Points" className={styles.pts}>
              Pts
            </th>
          </tr>
        </thead>
        <tbody>
          {group.rows.map((row) => {
            const form = teamForm(fixtures, row.teamId).slice(-4);
            return (
              <tr
                key={row.teamId}
                className={[
                  row.qualifying ? styles.through : "",
                  row.position === qualifying ? styles.cut : "",
                  highlight.includes(row.teamId) ? styles.highlight : "",
                ].join(" ")}
              >
                <td className={styles.pos}>{row.position}</td>
                <th scope="row" className={styles.team}>
                  <Link href={`/team/${row.teamId}`}>{row.teamName}</Link>
                </th>
                <td>{row.played}</td>
                <td>{row.won}</td>
                <td>{row.drawn}</td>
                <td>{row.lost}</td>
                <td className={styles.diff}>
                  {row.scoreDifference > 0 ? `+${row.scoreDifference}` : row.scoreDifference}
                </td>
                <td className={styles.form}>
                  <span className={styles.formRow}>
                    {form.map((r, i) => (
                      <span key={i} className={styles.formDot} data-r={r}>
                        {r}
                      </span>
                    ))}
                  </span>
                </td>
                <td className={styles.pts}>{row.points}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
