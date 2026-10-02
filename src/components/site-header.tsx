"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { CloseIcon, MegaphoneIcon } from "@/components/icons";
import { UPDATE_TYPE_LABEL, UpdateTypeIcon } from "@/components/update-type-icon";
import { useNow } from "@/lib/clock";
import { useLiveFeed } from "@/lib/live-feed";
import { daysUntil, firstKickoff, liveFixtures, phaseOf } from "@/lib/matchday";
import { NAV_ITEMS, isActive } from "@/lib/nav";
import { formatTime } from "@/lib/format";
import { isUnseen, markUpdatesSeen, useUpdatesSeen } from "@/lib/updates-seen";

import styles from "./site-header.module.css";

/** Updates older than this stop interrupting under the header. */
const STRIP_WINDOW_MS = 2 * 60 * 60 * 1000;

export function SiteHeader() {
  const pathname = usePathname();

  return (
    <>
      <header className={styles.header}>
        <div className={`mg-wrap ${styles.inner}`}>
          <Link href="/" className={styles.brand} aria-label="MGames 2026 home">
            <Image
              src="/brand/logo-mark.png"
              alt=""
              width={908}
              height={889}
              className={styles.crest}
              priority
            />
            <span className={styles.wordmark}>
              <span className={styles.wordTop}>MGames</span>
              <span className={styles.wordSub}>Manchester 2026</span>
            </span>
          </Link>

          <nav className={styles.nav} aria-label="Primary">
            {NAV_ITEMS.map((item) => {
              const active = isActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.navLink} ${active ? styles.navLinkActive : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className={styles.actions}>
            <StatusChip />
            <UpdatesButton active={pathname === "/updates"} />
          </div>
        </div>
      </header>
      {pathname === "/updates" ? null : <UpdateStrip />}
    </>
  );
}

/**
 * The one line that always says where the event is: days to go beforehand,
 * how many games are live during, results after. Renders nothing until the
 * first poll lands, so it never flashes a wrong state from the server.
 */
function StatusChip() {
  const { fixtures } = useLiveFeed();
  const now = useNow();
  if (!fixtures || now === null) return null;

  const live = liveFixtures(fixtures).length;
  if (live > 0) {
    return (
      <Link href="/#live" className={`${styles.chip} ${styles.chipLive}`}>
        <span className={styles.liveDot} aria-hidden="true" />
        <span className="mg-num">{live}</span> Live
      </Link>
    );
  }

  const phase = phaseOf(fixtures, now);
  const first = firstKickoff(fixtures);

  if (phase === "after") {
    return (
      <Link href="/standings" className={styles.chip}>
        Results
      </Link>
    );
  }

  if (phase === "before" && first !== null) {
    const days = daysUntil(now, first);
    return (
      <span className={styles.chip}>
        {days <= 1 ? "Tomorrow" : (
          <>
            <span className="mg-num">{days}</span> days to go
          </>
        )}
      </span>
    );
  }

  if (first !== null && now < first) {
    return <span className={styles.chip}>Starts {formatTime(new Date(first).toISOString())}</span>;
  }

  return <span className={styles.chip}>Matchday</span>;
}

function UpdatesButton({ active }: { active: boolean }) {
  const { latestUpdate } = useLiveFeed();
  const seen = useUpdatesSeen();
  const unseen = latestUpdate !== null && isUnseen(latestUpdate.publishedAt, seen);

  return (
    <Link
      href="/updates"
      className={`${styles.updates} ${active ? styles.updatesActive : ""}`}
      aria-label={unseen ? "Updates — new update" : "Updates"}
    >
      <MegaphoneIcon size={19} />
      <span className={styles.updatesLabel}>Updates</span>
      {unseen ? <span className={styles.badge} aria-hidden="true" /> : null}
    </Link>
  );
}

/**
 * A new committee update, shown under the header on whatever page you are on.
 *
 * On event day the updates that matter are a court change or a delay, and the
 * person who needs one is usually looking at the schedule, not the updates
 * page. Only unseen updates from the last two hours appear; dismissing one
 * counts as having seen it.
 */
function UpdateStrip() {
  const { latestUpdate } = useLiveFeed();
  const seen = useUpdatesSeen();
  const now = useNow();

  if (!latestUpdate || now === null) return null;
  if (!isUnseen(latestUpdate.publishedAt, seen)) return null;
  if (now - Date.parse(latestUpdate.publishedAt) > STRIP_WINDOW_MS) return null;

  return (
    <div className={styles.strip} role="status">
      <div className={`mg-wrap ${styles.stripInner}`}>
        <Link
          href="/updates"
          className={styles.stripLink}
          onClick={() => markUpdatesSeen(latestUpdate.publishedAt)}
        >
          <span className={styles.stripType}>
            <UpdateTypeIcon type={latestUpdate.type} size={15} />
            {UPDATE_TYPE_LABEL[latestUpdate.type]}
          </span>
          <span className={styles.stripTitle}>{latestUpdate.title}</span>
        </Link>
        <button
          type="button"
          className={styles.stripClose}
          onClick={() => markUpdatesSeen(latestUpdate.publishedAt)}
          aria-label="Dismiss update"
        >
          <CloseIcon size={16} />
        </button>
      </div>
    </div>
  );
}
