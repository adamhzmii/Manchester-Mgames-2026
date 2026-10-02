import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TeamView } from "@/components/team-view";
import { getFixtures, getStandingsData, getTeams, getVenues } from "@/lib/queries";

/** Live data — never prerendered or cached. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/team/[id]">): Promise<Metadata> {
  const { id } = await params;
  const team = (await getTeams()).find((t) => t.id === id);
  if (!team) return { title: "Team not found" };
  const title = `${team.name} · ${team.sportName}`;
  const description = `${team.name}${team.university ? ` (${team.university})` : ""} at MGames 2026 — fixtures, results and where they stand.`;
  return { title, description, openGraph: { title, description } };
}

export default async function TeamPage({ params }: PageProps<"/team/[id]">) {
  const { id } = await params;
  const [fixtures, teams, standings, venues] = await Promise.all([
    getFixtures(),
    getTeams(),
    getStandingsData(),
    getVenues(),
  ]);

  const team = teams.find((t) => t.id === id);
  if (!team) notFound();

  return (
    <TeamView
      team={team}
      groupId={standings.teams.find((t) => t.id === id)?.groupId ?? null}
      fixtures={fixtures}
      groups={standings.groups}
      standingTeams={standings.teams}
      venues={venues}
    />
  );
}
