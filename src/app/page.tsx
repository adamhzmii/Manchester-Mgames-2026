import Link from "next/link";
import { Suspense } from "react";

import {
  BellIcon,
  CalendarIcon,
  ChevronRightIcon,
  FoodIcon,
  InfoIcon,
  MapIcon,
  PinIcon,
  ScoresIcon,
} from "@/components/icons";
import { LiveRail } from "@/components/live-rail";
import { formatFeedTime } from "@/lib/format";
import { getAnnouncements, getLiveFixtures } from "@/lib/queries";

import styles from "./home.module.css";

/** The date is fixed for this event; it is display copy, not data. */
const EVENT_DATE = "Sat 24 October 2026";
const EVENT_VENUES = "Trinity & Sugden";

/**
 * The two data-backed strips stream in under Suspense. Everything above them —
 * the hero, the tiles — is static markup, so the page paints immediately even
 * if Supabase is slow to answer.
 */
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
          <h1 className={styles.title}>
            MANCHESTER
            <br />
            MGAMES <span className={styles.gold}>2026</span>
          </h1>
          <div className={styles.facts}>
            <span className={styles.fact}>
              <CalendarIcon size={14} className={styles.factIcon} />
              {EVENT_DATE}
            </span>
            <span className={styles.fact}>
              <PinIcon size={14} className={styles.factIcon} />
              {EVENT_VENUES}
            </span>
          </div>
        </div>
      </section>

      <Suspense fallback={<div className={styles.banner}>Loading the latest update…</div>}>
        <LatestAnnouncement />
      </Suspense>

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>
          <span className={styles.liveDot} />
          Happening now
        </h2>
        <Link href="/scores" className={styles.sectionLink}>
          All scores ›
        </Link>
      </div>

      <Suspense fallback={<div className="mg-container mg-muted">Loading live games…</div>}>
        <LiveGames />
      </Suspense>

      <div className={styles.sectionHead}>
        <h2 className={styles.sectionTitle}>Explore</h2>
      </div>

      <nav className={styles.tiles} aria-label="Sections">
        <Tile href="/schedule" title="Schedule" hint="All fixtures & times" icon={<CalendarIcon size={21} />} />
        <Tile
          href="/scores"
          title="Scores"
          hint="Standings & brackets"
          icon={<ScoresIcon size={21} />}
          tone="gold"
        />
        <Tile href="/map" title="Venue Map" hint="Courts & stalls" icon={<MapIcon size={21} />} />
        <Tile
          href="/food"
          title="Food"
          hint="Vendors at both venues"
          icon={<FoodIcon size={21} />}
          tone="gold"
        />
        <Tile href="/info" title="Info & Help" hint="First aid, prayer, FAQ" icon={<InfoIcon size={21} />} />
        <Suspense
          fallback={
            <Tile
              href="/announcements"
              title="Announcements"
              hint="Live updates"
              icon={<BellIcon size={21} />}
              tone="feature"
            />
          }
        >
          <AnnouncementsTile />
        </Suspense>
      </nav>
    </>
  );
}

async function LatestAnnouncement() {
  const [latest] = await getAnnouncements(1);

  if (!latest) return null;

  return (
    <Link href="/announcements" className={styles.banner}>
      <span className={styles.bannerHead}>
        <span className={styles.bannerTag}>
          <span className={styles.bannerDot} />
          Latest
        </span>
        <span className={styles.bannerTime}>{formatFeedTime(latest.publishedAt)}</span>
      </span>
      <span className={styles.bannerTitle}>{latest.title}</span>
      <span className={styles.bannerMore}>
        See all updates
        <ChevronRightIcon size={12} />
      </span>
    </Link>
  );
}

async function LiveGames() {
  const fixtures = await getLiveFixtures();
  return <LiveRail fixtures={fixtures} />;
}

async function AnnouncementsTile() {
  const announcements = await getAnnouncements();
  return (
    <Tile
      href="/announcements"
      title="Announcements"
      hint={`${announcements.length} ${announcements.length === 1 ? "update" : "updates"} today`}
      icon={<BellIcon size={21} />}
      tone="feature"
    />
  );
}

function Tile({
  href,
  title,
  hint,
  icon,
  tone = "purple",
}: {
  href: string;
  title: string;
  hint: string;
  icon: React.ReactNode;
  tone?: "purple" | "gold" | "feature";
}) {
  const iconClass =
    tone === "gold"
      ? `${styles.tileIcon} ${styles.tileIconGold}`
      : tone === "feature"
        ? `${styles.tileIcon} ${styles.tileIconOnDark}`
        : styles.tileIcon;

  return (
    <Link
      href={href}
      className={`${styles.tile} ${tone === "feature" ? styles.tileFeature : ""}`}
    >
      <span className={iconClass}>{icon}</span>
      <span className={styles.tileTitle} style={{ display: "block" }}>
        {title}
      </span>
      <span className={styles.tileHint} style={{ display: "block" }}>
        {hint}
      </span>
    </Link>
  );
}
