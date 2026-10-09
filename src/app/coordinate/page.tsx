import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CourtSheet } from "@/components/court-sheet";
import { coordinatorCanEdit } from "@/lib/coordinator";
import { demoScorer } from "@/lib/demo";
import { getCoordinator, getFixtures, getSports } from "@/lib/queries";

/** Live data — never prerendered or cached. */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Court sheet",
  robots: { index: false, follow: false },
};

/**
 * The coordinators' screen for the day: every court of a sport, what is on
 * it, what is next, and how far behind it is — the spreadsheet they used to
 * keep, where starting a game, scoring it and moving its time are one tap.
 */
export default async function CoordinatePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [coordinator, fixtures, sports, params] = await Promise.all([
    getCoordinator(),
    getFixtures(),
    getSports(),
    searchParams,
  ]);
  if (!coordinatorCanEdit(coordinator) && !demoScorer()) redirect("/login");

  const asked = typeof params.sport === "string" ? params.sport : null;
  const sport = asked === "all" || sports.some((s) => s.slug === asked) ? asked : null;

  return (
    <CourtSheet
      initial={fixtures}
      sports={sports}
      askedSport={sport}
      signedInAs={coordinator?.name ?? null}
    />
  );
}
