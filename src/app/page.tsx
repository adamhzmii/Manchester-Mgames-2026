import { HomeView } from "@/components/home-view";
import { serverNow } from "@/lib/demo";
import {
  getAnnouncements,
  getFixtures,
  getSports,
  getTeams,
  getVendors,
  getVenues,
} from "@/lib/queries";

/**
 * Live data — never prerendered or cached. Scores and announcements change
 * during the event, and a stale page is worse than a slower one. Once on the
 * page, the shared live feed keeps it current without a reload.
 */
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [fixtures, teams, sports, venues, updates, vendors] = await Promise.all([
    getFixtures(),
    getTeams(),
    getSports(),
    getVenues(),
    getAnnouncements(3),
    getVendors(),
  ]);

  return (
    <HomeView
      fixtures={fixtures}
      teams={teams}
      sports={sports}
      venues={venues}
      updates={updates}
      vendors={vendors}
      renderedAt={serverNow()}
    />
  );
}
