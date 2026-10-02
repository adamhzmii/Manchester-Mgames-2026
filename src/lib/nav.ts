/**
 * The primary destinations, shared by the bottom bar on phones and the inline
 * header nav on wider screens so the two can never disagree.
 *
 * Five, because that is what a bottom bar holds at a size a thumb can hit
 * reliably. Food lives inside Venues — what you can eat depends on which
 * building you are standing in — and Updates is in the header, where it can
 * carry an unread badge on every screen.
 */
export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/schedule", label: "Schedule", icon: "calendar" },
  { href: "/standings", label: "Standings", icon: "standings" },
  { href: "/venues", label: "Venues", icon: "map" },
  { href: "/info", label: "Info", icon: "info" },
] as const;

export type NavItem = (typeof NAV_ITEMS)[number];

/**
 * A nav item is current when it is the exact route or an ancestor of it.
 * Match and team pages belong to the schedule and standings respectively, so
 * the bar still says where you are when you drill into one.
 */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  if (href === "/schedule" && pathname.startsWith("/match/")) return true;
  if (href === "/standings" && pathname.startsWith("/team/")) return true;
  if (href === "/venues" && pathname.startsWith("/food")) return true;
  return pathname === href || pathname.startsWith(`${href}/`);
}
