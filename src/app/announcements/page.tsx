import type { Metadata } from "next";
import { Suspense } from "react";

import { AnnouncementFeed } from "@/components/announcement-feed";
import { getAnnouncements } from "@/lib/queries";

export const metadata: Metadata = {
  title: "Announcements",
  description:
    "Live updates from the MGames 2026 committee — delays, room changes and notices as they happen.",
};

/**
 * Live data — never prerendered or cached. Scores and announcements change
 * during the event, and a stale page is worse than a slower one.
 */
export const dynamic = "force-dynamic";

export default function AnnouncementsPage() {
  return (
    <div className="mg-page mg-container" style={{ padding: 0 }}>
      <div style={{ padding: "16px var(--mg-gutter) 6px" }}>
        <h1 className="mg-page-title">Announcements</h1>
        <p className="mg-muted">Live updates from the committee</p>
      </div>

      <Suspense fallback={<p className="mg-muted" style={{ padding: "0 var(--mg-gutter)" }}>Loading updates…</p>}>
        <Feed />
      </Suspense>
    </div>
  );
}

async function Feed() {
  const announcements = await getAnnouncements();
  return <AnnouncementFeed announcements={announcements} />;
}
