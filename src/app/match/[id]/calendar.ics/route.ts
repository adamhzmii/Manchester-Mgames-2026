import { getFixtures, getVenues } from "@/lib/queries";

/** How long a calendar entry blocks out; games run 20–40 minutes. */
const DURATION_MIN = 30;

/** RFC 5545 text: backslash, comma, semicolon and newlines are escaped. */
function text(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/([,;])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

function stamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

/** Lines over 75 octets are folded with a leading space, as the spec asks. */
function fold(line: string): string {
  const parts: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    parts.push(rest.slice(0, 74));
    rest = ` ${rest.slice(74)}`;
  }
  parts.push(rest);
  return parts.join("\r\n");
}

/**
 * One game as a calendar entry, with a reminder 20 minutes before — enough to
 * walk between Trinity and Sugden. Served rather than generated in the
 * browser: iPhones only offer "Add to Calendar" for a real text/calendar
 * response, not for a file a page builds itself.
 */
export async function GET(_request: Request, ctx: RouteContext<"/match/[id]/calendar.ics">) {
  const { id } = await ctx.params;
  const [fixtures, venues] = await Promise.all([getFixtures(), getVenues()]);
  const fixture = fixtures.find((f) => f.id === id);
  if (!fixture) return new Response("Game not found", { status: 404 });

  const venue = venues.find((v) => v.slug === fixture.venueSlug);
  const start = Date.parse(fixture.scheduledTime);
  const url = `https://manchestermgames.com/match/${fixture.id}`;
  const location = [venue?.name ?? fixture.venueShortName, fixture.courtName, venue?.address]
    .filter(Boolean)
    .join(", ");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//MGames 2026//Manchester//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${fixture.id}@manchestermgames.com`,
    `DTSTAMP:${stamp(Date.now())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(start + DURATION_MIN * 60_000)}`,
    `SUMMARY:${text(`${fixture.sportName} ${fixture.stageLabel}: ${fixture.teamA} v ${fixture.teamB}`)}`,
    `LOCATION:${text(location)}`,
    `DESCRIPTION:${text(`MGames 2026 — live score and directions: ${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${text(`${fixture.teamA} v ${fixture.teamB} in 20 minutes`)}`,
    "TRIGGER:-PT20M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return new Response(lines.map(fold).join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `inline; filename="mgames-${fixture.sportSlug}-${fixture.id.slice(0, 8)}.ics"`,
    },
  });
}
