/**
 * Turning a time a coordinator types ("08:45") into a moment, for the day in
 * Manchester it belongs to. The server runs in UTC and a coordinator's phone
 * could be set to anything, so neither's own clock is the right one — the
 * wall clock in the sports hall is.
 */
const EVENT_TIME_ZONE = "Europe/London";

const dateFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const offsetFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: EVENT_TIME_ZONE,
  timeZoneName: "shortOffset",
});

/** "2026-10-24": the Manchester date of a moment. */
export function londonDate(iso: string): string {
  return dateFormatter.format(new Date(iso));
}

/** Minutes Manchester is ahead of UTC at a moment: 60 in summer, 0 in winter. */
function offsetMinutes(ms: number): number {
  const name =
    offsetFormatter.formatToParts(new Date(ms)).find((p) => p.type === "timeZoneName")?.value ?? "";
  const match = /GMT([+-])(\d{1,2})(?::(\d{2}))?/.exec(name);
  if (!match) return 0;
  const minutes = Number(match[2]) * 60 + Number(match[3] ?? 0);
  return match[1] === "-" ? -minutes : minutes;
}

/**
 * The moment a Manchester wall-clock time happens on a Manchester date, as an
 * ISO string, or null for a time that is not one ("25:00", "8.30").
 */
export function londonToIso(date: string, time: string): string | null {
  const d = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const t = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
  if (!d || !t) return null;
  const hours = Number(t[1]);
  const minutes = Number(t[2]);
  if (hours > 23 || minutes > 59) return null;

  const wall = Date.UTC(Number(d[1]), Number(d[2]) - 1, Number(d[3]), hours, minutes);
  // The offset at the wall time, then checked at the moment it gives: they
  // differ only within an hour of the clocks changing.
  let ms = wall - offsetMinutes(wall) * 60_000;
  const settled = offsetMinutes(ms);
  if (settled !== offsetMinutes(wall)) ms = wall - settled * 60_000;
  return new Date(ms).toISOString();
}
