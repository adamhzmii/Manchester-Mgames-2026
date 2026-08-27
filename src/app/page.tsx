import Link from "next/link";
import { Suspense } from "react";

import { ChevronRightIcon } from "@/components/icons";
import { LiveRail } from "@/components/live-rail";
import { formatFeedTime } from "@/lib/format";
import { getAnnouncements, getLiveFixtures } from "@/lib/queries";

import styles from "./home.module.css";

const EVENT_DATE = "Sat 24 October";
const EVENT_PLACE = "Trinity & Sugden, Manchester";

/** The five sections that don't need data to render their row. Announcements is appended after, since its hint line needs a count. */
const SECTIONS = [
  {
    href: "/schedule",
    num: "01",
    title: "Schedule",
    hint: "Every fixture, filterable by sport, venue and stage.",
    primary: true,
  },
  {
    href: "/scores",
    num: "02",
    title: "Scores",
    hint: "Live standings and the knockout bracket, sport by sport.",
    primary: true,
  },
  {
    href: "/map",
    num: "03",
    title: "Venue Map",
    hint: "Courts, halls and stalls at Trinity and Sugden.",
    primary: false,
  },
  {
    href: "/food",
    num: "04",
    title: "Food",
    hint: "Six vendors across both venues, with full menus.",
    primary: false,
  },
  {
    href: "/info",
    num: "05",
    title: "Info & Help",
    hint: "First aid, prayer rooms, transport, FAQ.",
    primary: false,
  },
] as const;

/**
 * Live data — never prerendered or cached. Scores and announcements change
 * during the event, and a stale page is worse than a slower one.
 */
export const dynamic = "force-dynamic";

export default function HomePage() {
  return (
    <>
      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.kicker}>Malaysian Students&rsquo; Society · Manchester</p>
          <div className={styles.wordmark}>
            <span className={styles.wordmarkMain}>MGames</span>
            <span className={styles.wordmarkYear}>2026</span>
          </div>
          <div className={styles.dateline}>
            <span>{EVENT_DATE}</span>
            <span className={styles.datelineDivider} aria-hidden="true" />
            <span>{EVENT_PLACE}</span>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className={styles.ticker} />}>
        <LatestAnnouncement />
      </Suspense>

      <section aria-labelledby="live-heading">
        <div className={styles.scoreboardHead}>
          <h2 id="live-heading" className={styles.scoreboardTitle}>
            <span className={styles.liveDot} aria-hidden="true" />
            Happening now
          </h2>
          <Link href="/scores" className={styles.sectionLink}>
            All scores
            <ChevronRightIcon size={13} />
          </Link>
        </div>
        <Suspense fallback={<p className={styles.loadingNote}>Loading live games…</p>}>
          <LiveGames />
        </Suspense>
      </section>

      <section aria-labelledby="explore-heading" className={styles.exploreSection}>
        <h2 id="explore-heading" className={styles.exploreTitle}>
          Explore
        </h2>
        <nav className={styles.index} aria-label="Sections">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className={`${styles.indexRow} ${section.primary ? styles.indexRowPrimary : ""}`}
            >
              <span className={styles.indexNum}>{section.num}</span>
              <span className={styles.indexBody}>
                <span className={styles.indexTitle}>{section.title}</span>
                <span className={styles.indexHint}>{section.hint}</span>
              </span>
              <ChevronRightIcon size={16} className={styles.indexArrow} />
            </Link>
          ))}
          <Suspense
            fallback={
              <span className={styles.indexRow}>
                <span className={styles.indexNum}>06</span>
                <span className={styles.indexBody}>
                  <span className={styles.indexTitle}>Announcements</span>
                  <span className={styles.indexHint}>Live updates from the committee.</span>
                </span>
                <ChevronRightIcon size={16} className={styles.indexArrow} />
              </span>
            }
          >
            <AnnouncementsIndexRow />
          </Suspense>
        </nav>
      </section>
    </>
  );
}

async function LatestAnnouncement() {
  const [latest] = await getAnnouncements(1);

  if (!latest) return null;

  return (
    <Link href="/announcements" className={styles.ticker}>
      <span className={styles.tickerDot} aria-hidden="true" />
      <span className={styles.tickerLabel}>Latest</span>
      <span className={styles.tickerTitle}>{latest.title}</span>
      <span className={styles.tickerMeta}>
        {formatFeedTime(latest.publishedAt)}
        <ChevronRightIcon size={13} />
      </span>
    </Link>
  );
}

async function LiveGames() {
  const fixtures = await getLiveFixtures();
  return <LiveRail fixtures={fixtures} />;
}

async function AnnouncementsIndexRow() {
  const announcements = await getAnnouncements();

  return (
    <Link href="/announcements" className={styles.indexRow}>
      <span className={styles.indexNum}>06</span>
      <span className={styles.indexBody}>
        <span className={styles.indexTitle}>
          Announcements
          {announcements.length > 0 ? <span className={styles.indexDot} aria-hidden="true" /> : null}
        </span>
        <span className={styles.indexHint}>
          {announcements.length} {announcements.length === 1 ? "update" : "updates"} from the
          committee today.
        </span>
      </span>
      <ChevronRightIcon size={16} className={styles.indexArrow} />
    </Link>
  );
}
