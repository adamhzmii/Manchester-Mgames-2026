"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { BellIcon } from "@/components/icons";
import { formatTime } from "@/lib/format";
import { NAV_ITEMS, isActive } from "@/lib/nav";

import styles from "./site-header.module.css";

/**
 * Whether the page has been scrolled away from the very top.
 *
 * Read through `useSyncExternalStore` rather than an effect that copies scroll
 * position into state: the server snapshot is a plain `false`, so the markup
 * React renders on the server and the markup it hydrates with agree, and a
 * browser that restores a mid-page scroll position on reload is read correctly
 * on the first paint instead of one render late.
 */
const SCROLL_THRESHOLD = 20;

function subscribeToScroll(onChange: () => void): () => void {
  window.addEventListener("scroll", onChange, { passive: true });
  return () => window.removeEventListener("scroll", onChange);
}

function getScrolledSnapshot(): boolean {
  return window.scrollY > SCROLL_THRESHOLD;
}

function getScrolledServerSnapshot(): boolean {
  return false;
}

/**
 * The clock is client-only on purpose. Rendering "now" on the server produces
 * a different string than the browser a moment later, which React reports as a
 * hydration mismatch — so the pill stays empty for one paint and fills in on
 * mount.
 */
function EventClock() {
  const [now, setNow] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setNow(formatTime(new Date().toISOString()));
    tick();
    // Aligning to the next minute rather than polling every second keeps this
    // from waking the main thread 60× more often than the display changes.
    const timer = window.setInterval(tick, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className={styles.clock}>
      <span className={styles.dot} />
      <span suppressHydrationWarning>{now ?? "--:--"}</span>
      <span className="mg-sr-only">Current time in Manchester</span>
    </span>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const scrolled = useSyncExternalStore(
    subscribeToScroll,
    getScrolledSnapshot,
    getScrolledServerSnapshot,
  );

  // Only the home page has a photographic hero for the header to sit over.
  const overlaysHero = pathname === "/" && !scrolled;

  return (
    <header className={`${styles.header} ${overlaysHero ? styles.transparent : ""}`}>
      <div className={styles.inner}>
        <Link href="/" className={styles.brand}>
          <Image
            src="/brand/logo-mark.png"
            alt="MGames"
            width={908}
            height={889}
            className={styles.mark}
            priority
          />
          <span className={styles.wordmark}>
            MGAMES <span className={styles.year}>&rsquo;26</span>
          </span>
        </Link>

        <nav className={styles.deskNav} aria-label="Primary">
          {NAV_ITEMS.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`${styles.deskLink} ${active ? styles.deskLinkActive : ""}`}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={styles.actions}>
          <EventClock />
          <Link href="/announcements" className={styles.iconButton} aria-label="Announcements">
            <BellIcon size={18} />
            <span className={styles.badge} />
          </Link>
        </div>
      </div>
    </header>
  );
}
