"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Bracket } from "@/components/bracket";
import { FilterChips, type ChipOption } from "@/components/filter-chips";
import { TrophyIcon } from "@/components/icons";
import { MatchList, MatchRow } from "@/components/match-row";
import { MedalTable } from "@/components/medal-table";
import { SportBadge } from "@/components/sport-badge";
import { StandingsTable } from "@/components/standings-table";
import type { Fixture } from "@/lib/fixtures";
import { useLiveFixtures } from "@/lib/live-feed";
import { medalTable, podiums } from "@/lib/medals";
import type { PickerTeam, Sport } from "@/lib/queries";
import {
  computeStandings,
  pointsRule,
  QUALIFYING,
  type GroupMeta,
  type TeamMeta,
} from "@/lib/standings";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./standings-view.module.css";

export type StandingsTab = "table" | "bracket" | "games";

type StandingsViewProps = {
  fixtures: Fixture[];
  sports: Sport[];
  teams: PickerTeam[];
  groups: (GroupMeta & { sportSlug: string })[];
  standingTeams: (TeamMeta & { sportSlug: string })[];
  initialSport: string;
  initialTab: StandingsTab | null;
};

/**
 * Who is winning: the overall medal table, and for each sport its group
 * tables, knockout bracket and every game. Selections live in the URL, so
 * "the netball bracket" is a link.
 */
export function StandingsView({
  fixtures: initial,
  sports,
  teams,
  groups,
  standingTeams,
  initialSport,
  initialTab,
}: StandingsViewProps) {
  const fixtures = useLiveFixtures(initial);
  const favourites = useFavouriteTeams();
  const router = useRouter();
  const pathname = usePathname();

  const [sport, setSport] = useState(initialSport);
  const [tab, setTab] = useState<StandingsTab | null>(initialTab);

  const go = (nextSport: string, nextTab: StandingsTab | null) => {
    setSport(nextSport);
    setTab(nextTab);
    const params = new URLSearchParams({ sport: nextSport });
    if (nextTab) params.set("view", nextTab);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  const options: ChipOption[] = useMemo(
    () => [
      { value: "overall", label: "Overall" },
      ...sports.map((s) => ({ value: s.slug, label: s.name, slug: s.slug })),
    ],
    [sports],
  );

  return (
    <div className={styles.page}>
      <div className="mg-wrap">
        <h1 className="mg-page-title">Standings</h1>
      </div>

      <div className={styles.chips}>
        <FilterChips label="Standings for" options={options} value={sport} onChange={(s) => go(s, null)} />
      </div>

      <div className={`mg-wrap ${styles.body}`}>
        {sport === "overall" ? (
          <Overall fixtures={fixtures} teams={teams} />
        ) : (
          <SportStandings
            key={sport}
            sport={sports.find((s) => s.slug === sport)!}
            fixtures={fixtures.filter((f) => f.sportSlug === sport)}
            groups={groups.filter((g) => g.sportSlug === sport)}
            standingTeams={standingTeams.filter((t) => t.sportSlug === sport)}
            followed={favourites.teamIds}
            tab={tab}
            onTab={(t) => go(sport, t)}
          />
        )}
      </div>
    </div>
  );
}

function Overall({ fixtures, teams }: { fixtures: Fixture[]; teams: PickerTeam[] }) {
  const list = podiums(fixtures);
  const universityOf = (id: string) => teams.find((t) => t.id === id)?.university ?? null;

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.title}>Medal table</h2>
        <MedalTable rows={medalTable(list, universityOf)} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.title}>Champions</h2>
        {list.length === 0 ? (
          <p className={styles.empty}>Each sport&rsquo;s champion appears here as its final finishes.</p>
        ) : (
          <ul className={styles.champions}>
            {list.map((p) => (
              <li key={p.categoryId}>
                <Link href={`/match/${p.final.id}`} className={styles.champion}>
                  <SportBadge code={p.sportCode} color={p.sportColor} slug={p.sportSlug} size={30} />
                  <span className={styles.championText}>
                    <span className={styles.championSport}>{p.title}</span>
                    <span className={styles.championName}>
                      <TrophyIcon size={15} className={styles.cup} />
                      {p.gold.name}
                    </span>
                    <span className={styles.championRest}>
                      Runner-up {p.silver.name}
                      {p.bronze ? ` · Bronze ${p.bronze.name}` : ""}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function SportStandings({
  sport,
  fixtures,
  groups,
  standingTeams,
  followed,
  tab,
  onTab,
}: {
  sport: Sport;
  fixtures: Fixture[];
  groups: (GroupMeta & { sportSlug: string })[];
  standingTeams: (TeamMeta & { sportSlug: string })[];
  followed: readonly string[];
  tab: StandingsTab | null;
  onTab: (tab: StandingsTab) => void;
}) {
  const tables = computeStandings(fixtures, groups, standingTeams, sport.slug);
  const hasKnockout = fixtures.some((f) => f.stage !== "group");

  // A sport with no groups has no table to open on.
  const tabs: { value: StandingsTab; label: string }[] = [
    ...(tables.length > 0 ? [{ value: "table" as const, label: "Table" }] : []),
    ...(hasKnockout ? [{ value: "bracket" as const, label: "Bracket" }] : []),
    { value: "games", label: "Games" },
  ];
  const active = tab && tabs.some((t) => t.value === tab) ? tab : tabs[0].value;
  const rule = pointsRule(sport.slug);

  return (
    <>
      <div className={styles.tabs} role="tablist" aria-label={`${sport.name} standings`}>
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            role="tab"
            aria-selected={active === t.value}
            className={`${styles.tab} ${active === t.value ? styles.tabOn : ""}`}
            onClick={() => onTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {active === "table" ? (
        <section className={styles.section}>
          {tables.map((group) => (
            <StandingsTable
              key={group.groupId}
              group={group}
              fixtures={fixtures}
              highlight={followed}
            />
          ))}
          <p className={styles.note}>
            Top {QUALIFYING} in each group go through. {rule.win} points for a win, {rule.draw} for
            a draw. Level on points is split by score difference, then by score.
          </p>
        </section>
      ) : null}

      {active === "bracket" ? (
        <section className={styles.section}>
          <Bracket fixtures={fixtures} />
        </section>
      ) : null}

      {active === "games" ? (
        <section className={styles.section}>
          <MatchList>
            {[...fixtures]
              .sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime))
              .map((f) => (
                <MatchRow key={f.id} fixture={f} followed={followed} hideSport />
              ))}
          </MatchList>
        </section>
      ) : null}
    </>
  );
}
