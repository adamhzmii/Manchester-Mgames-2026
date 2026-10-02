"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { CalendarIcon, HomeIcon, InfoIcon, MapIcon, PodiumIcon } from "@/components/icons";
import { NAV_ITEMS, isActive, type NavItem } from "@/lib/nav";

import styles from "./bottom-nav.module.css";

const ICONS: Record<NavItem["icon"], (props: { size?: number }) => React.ReactElement> = {
  home: HomeIcon,
  calendar: CalendarIcon,
  standings: PodiumIcon,
  map: MapIcon,
  info: InfoIcon,
};

/** Phone tab bar. Hidden from 900px, where the header carries the same links. */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className={styles.nav} aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`${styles.link} ${active ? styles.linkActive : ""}`}
            aria-current={active ? "page" : undefined}
          >
            <Icon size={22} />
            <span className={styles.label}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
