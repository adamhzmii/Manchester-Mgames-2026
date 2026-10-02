/**
 * The primary destinations, shared by the bottom bar on phones and the inline
 * header nav on wider screens so the two can never disagree.
 *
 * Food is a tab of its own: the stalls are part of what makes the day, and
 * selling them out is part of the committee's job, so they get the same
 * prominence as the scores rather than sitting inside Venues. Six tabs still
 * leaves each a 65px-wide target on a phone. Updates is in the header, where
 * it can carry an unread badge on every screen.
 */
export const NAV_ITEMS = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/schedule", label: "Schedule", icon: "calendar" },
  { href: "/standings", label: "Standings", icon: "standings" },
  { href: "/food", label: "Food", icon: "food" },
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
  return pathname === href || pathname.startsWith(`${href}/`);
}
