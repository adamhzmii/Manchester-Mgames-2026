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
import { byKickoff, type Fixture } from "@/lib/fixtures";
import { useLiveFixtures } from "@/lib/live-feed";
import { medalTable, podiums } from "@/lib/medals";
import type { Sport } from "@/lib/queries";
import {
  computeStandings,
  pointsRule,
  bestPlaceTable,
  type GroupMeta,
  type TeamMeta,
} from "@/lib/standings";
import { firstKnockoutRound, throughLine } from "@/lib/tournament-format";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./standings-view.module.css";

export type StandingsTab = "table" | "bracket" | "games";

type StandingsViewProps = {
  fixtures: Fixture[];
  sports: Sport[];
  groups: (GroupMeta & { sportSlug: string })[];
  standingTeams: (TeamMeta & { sportSlug: string })[];
  initialSport: string;
  initialTab: StandingsTab | null;
  /** A category slug ("md"), for a sport played in several. */
  initialCategory: string | null;
};

/**
 * Who is winning: the overall medal table, and for each sport its group
 * tables, knockout bracket and every game. Selections live in the URL, so
 * "the netball bracket" is a link.
 */
export function StandingsView({
  fixtures: initial,
  sports,
  groups,
  standingTeams,
  initialSport,
  initialTab,
  initialCategory,
}: StandingsViewProps) {
  const fixtures = useLiveFixtures(initial);
  const favourites = useFavouriteTeams();
  const router = useRouter();
  const pathname = usePathname();

  const [sport, setSport] = useState(initialSport);
  const [tab, setTab] = useState<StandingsTab | null>(initialTab);
  const [category, setCategory] = useState<string | null>(initialCategory);

  const go = (nextSport: string, nextTab: StandingsTab | null, nextCategory: string | null) => {
    setSport(nextSport);
    setTab(nextTab);
    setCategory(nextCategory);
    const params = new URLSearchParams({ sport: nextSport });
    if (nextCategory) params.set("cat", nextCategory);
    if (nextTab) params.set("view", nextTab);
    router.replace(`${pathname}?${params}`, { scroll: false });
  };

  // Badminton is four competitions — men's doubles, mixed, singles, women's —
  // each with its own groups and bracket. Mixing them on one page put four
  // "Group A" tables side by side and joined four brackets into one.
  const sportFixtures = fixtures.filter((f) => f.sportSlug === sport);
  const categories = [
    ...new Map(
      sportFixtures.map((f) => [
        f.categorySlug,
        { slug: f.categorySlug, id: f.categoryId, name: f.categoryName },
      ]),
    ).values(),
  ];
  // Doubles before singles, men's before women's: the order the sheet lists them.
  const ORDER = ["md", "xd", "ms", "ws", "wd"];
  categories.sort((a, b) => (ORDER.indexOf(a.slug) + 1 || 99) - (ORDER.indexOf(b.slug) + 1 || 99));
  const current =
    categories.length > 1
      ? (categories.find((c) => c.slug === category) ?? categories[0])
      : null;

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
        <FilterChips
          label="Standings for"
          options={options}
          value={sport}
          onChange={(s) => go(s, null, null)}
        />
      </div>

      {current ? (
        <div className="mg-wrap">
          <div className={styles.categories} role="tablist" aria-label="Category">
            {categories.map((c) => (
              <button
                key={c.slug}
                type="button"
                role="tab"
                aria-selected={c.slug === current.slug}
                className={`${styles.category} ${c.slug === current.slug ? styles.categoryOn : ""}`}
                onClick={() => go(sport, tab, c.slug)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className={`mg-wrap ${styles.body}`}>
        {sport === "overall" ? (
          <Overall fixtures={fixtures} />
        ) : (
          <SportStandings
            key={`${sport}-${current?.slug ?? ""}`}
            sport={sports.find((s) => s.slug === sport)!}
            fixtures={
              current ? sportFixtures.filter((f) => f.categoryId === current.id) : sportFixtures
            }
            groups={groups.filter(
              (g) => g.sportSlug === sport && (!current || g.categoryId === current.id),
            )}
            standingTeams={standingTeams.filter((t) => t.sportSlug === sport)}
            followed={favourites.teamIds}
            tab={tab}
            onTab={(t) => go(sport, t, current?.slug ?? null)}
          />
        )}
      </div>
    </div>
  );
}

function Overall({ fixtures }: { fixtures: Fixture[] }) {
  const list = podiums(fixtures);

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.title}>Medal table</h2>
        <MedalTable rows={medalTable(list)} />
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
  const thirds = bestPlaceTable(tables);
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
          {thirds ? (
            <>
              <StandingsTable group={thirds} fixtures={fixtures} highlight={followed} />
              <p className={styles.note}>
                The {thirds.places} best of these go through too, ranked the same way as a group.
              </p>
            </>
          ) : null}
          <p className={styles.note}>
            {tables[0]
              ? `${throughLine(tables[0], {
                  groups: tables.length,
                  groupSize: Math.max(...tables.map((t) => t.rows.length)),
                  round: firstKnockoutRound(tables[0].categoryId, fixtures),
                })} `
              : null}
            {rule.win} points for a win, {rule.draw} for a draw. Level on points is split by score
            difference, then by score.
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
              .sort(byKickoff)
              .map((f) => (
                <MatchRow key={f.id} fixture={f} followed={followed} hideSport />
              ))}
          </MatchList>
        </section>
      ) : null}
    </>
  );
}
