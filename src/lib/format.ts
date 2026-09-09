/**
 * The event runs in Manchester, so every time on screen is a UK local time —
 * pinned explicitly rather than left to the viewer's locale. Two reasons:
 * a visitor whose phone is still on Malaysian time should see the kick-off
 * time printed on the wall, and a server render in UTC must produce the exact
 * same string as the client render or React reports a hydration mismatch.
 */
const EVENT_TIME_ZONE = "Europe/London";

const timeFormatter = new Intl.DateTimeFormat("en-GB", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: EVENT_TIME_ZONE,
});

const dayFormatter = new Intl.DateTimeFormat("en-GB", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: EVENT_TIME_ZONE,
});

/** "13:15" */
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** "Sat 24 Oct" */
export function formatDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

const hourKeyFormatter = new Intl.DateTimeFormat("en-GB", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hour12: false,
  timeZone: EVENT_TIME_ZONE,
});

/**
 * A sortable key for the hour a fixture kicks off in, in Manchester time —
 * "24/10/2026, 13". Includes the date so a two-day event would not fold both
 * afternoons into one heading.
 */
export function hourKey(iso: string): string {
  return hourKeyFormatter.format(new Date(iso));
}

/** "13:00" — the heading for an hour block, not the fixture's own time. */
export function formatHour(iso: string): string {
  return `${formatTime(iso).slice(0, 2)}:00`;
}

/** 650 → "£6.50" */
export function formatPrice(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

/**
 * "13:15" for today's feed. Announcements are all same-day during the event,
 * so the time alone is the useful part; the date only appears if the item is
 * from a different day than the reader's "now".
 */
export function formatFeedTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso);
  const sameDay = dayFormatter.format(then) === dayFormatter.format(now);
  return sameDay ? formatTime(then.toISOString()) : `${formatDay(iso)} · ${formatTime(iso)}`;
}
