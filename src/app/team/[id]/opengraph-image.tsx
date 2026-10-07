import { OG_SIZE, ogCard } from "@/lib/og-card";
import { getTeams } from "@/lib/queries";

/** The card for a team's page: who, and in what. */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "A team at MGames 2026";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const team = (await getTeams()).find((t) => t.id === id);
  return ogCard({
    kicker: team
      ? [team.sportName, team.categoryName !== "Open" ? team.categoryName : null].filter(Boolean).join(" · ")
      : "MGames 2026",
    title: [team ? team.name.toUpperCase() : "MGAMES 2026"],
    lines: ["Games, results and where they stand", "Manchester MGames 2026 · Saturday 24 October"],
  });
}
