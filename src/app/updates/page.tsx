import type { Metadata } from "next";

import { UpdatesView } from "@/components/updates-view";
import { demoScorer } from "@/lib/demo";
import { getAnnouncements, getCoordinator } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Updates",
  description:
    "Live updates from the MGames 2026 committee — delays, court changes and news as they happen.",
};

/** Live data — never prerendered or cached. */
export const dynamic = "force-dynamic";

export default async function UpdatesPage() {
  const [updates, coordinator] = await Promise.all([getAnnouncements(), getCoordinator()]);
  // Any signed-in coordinator may post: a court change is everyone's business,
  // whichever sport noticed it.
  return <UpdatesView updates={updates} canPost={coordinator !== null || demoScorer()} />;
}
