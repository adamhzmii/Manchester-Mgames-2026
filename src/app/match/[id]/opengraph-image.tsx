import { formatDay, formatTime } from "@/lib/format";
import { OG_SIZE, ogCard } from "@/lib/og-card";
import { getFixtures } from "@/lib/queries";

/**
 * The card for one game, so a link sent to the team's group chat shows who,
 * when and where before anyone taps it — and the score, once there is one.
 */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "An MGames 2026 game";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const f = (await getFixtures()).find((x) => x.id === id);
  if (!f) {
    return ogCard({ kicker: "MGames 2026", title: ["MANCHESTER", "MGAMES 2026"], goldLast: true, lines: [] });
  }
  const competition = [f.sportName, f.categoryName !== "Open" ? f.categoryName : null, f.stageLabel]
    .filter(Boolean)
    .join(" · ");
  const score = `${f.scoreA ?? 0}–${f.scoreB ?? 0}`;
  return ogCard({
    kicker: competition,
    badge:
      f.status === "live"
        ? { text: `LIVE ${score}`, live: true }
        : f.status === "finished"
          ? { text: `FULL TIME ${score}`, live: false }
          : null,
    title: [f.teamA.toUpperCase(), `v ${f.teamB.toUpperCase()}`],
    lines: [
      `${formatDay(f.scheduledTime)} · ${formatTime(f.scheduledTime)}`,
      `${f.venueShortName} · ${f.courtName} · MGames 2026`,
    ],
  });
}
