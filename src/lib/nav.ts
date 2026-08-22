/**
 * The primary destinations, shared by the bottom bar on mobile and the inline
 * header nav on wider screens so the two can never disagree.
 *
 * /announcements is deliberately not here: it is reached from the bell in the
 * header, which can carry an unread dot. Six items is already the most a
 * bottom bar can hold legibly.
 */
export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/schedule", label: "Schedule", icon: "calendar" },
  { href: "/scores", label: "Scores", icon: "scores" },
  { href: "/map", label: "Map", icon: "map" },
  { href: "/food", label: "Food", icon: "food" },
  { href: "/info", label: "Info", icon: "info" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

/** A nav item is current when it is the exact route or an ancestor of it. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
