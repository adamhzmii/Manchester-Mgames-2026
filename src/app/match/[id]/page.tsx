import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { MatchView } from "@/components/match-view";
import { coordinatorCanEdit } from "@/lib/coordinator";
import { demoScorer } from "@/lib/demo";
import { formatDay, formatTime } from "@/lib/format";
import {
  getCoordinator,
  getFixtures,
  getStandingsData,
  getTeams,
  getVenues,
} from "@/lib/queries";

/** Live data — never prerendered or cached. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const { id } = await params;
  const fixture = (await getFixtures()).find((f) => f.id === id);
  if (!fixture) return { title: "Game not found" };

  // What a link preview in a group chat should say about this game.
  const title = `${fixture.teamA} v ${fixture.teamB}`;
  const description = `${fixture.sportName} ${fixture.stageLabel} · ${formatDay(fixture.scheduledTime)} ${formatTime(fixture.scheduledTime)} · ${fixture.venueShortName} ${fixture.courtName}`;
  return { title, description, openGraph: { title, description } };
}

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const { id } = await params;
  const [fixtures, teams, standings, venues, coordinator] = await Promise.all([
    getFixtures(),
    getTeams(),
    getStandingsData(),
    getVenues(),
    getCoordinator(),
  ]);

  const fixture = fixtures.find((f) => f.id === id);
  if (!fixture) notFound();

  return (
    <MatchView
      id={id}
      fixtures={fixtures}
      teams={teams}
      groups={standings.groups}
      standingTeams={standings.teams}
      venues={venues}
      canEdit={coordinatorCanEdit(coordinator, fixture.sportId) || demoScorer()}
    />
  );
}
