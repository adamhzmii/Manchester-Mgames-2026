"use client";

import { useEffect, useState } from "react";

import { formatFeedTime } from "@/lib/format";
import type { Announcement } from "@/lib/queries";
import { createClient } from "@/lib/supabase/client";
import type { AnnouncementType } from "@/lib/supabase/types";

import styles from "./announcement-feed.module.css";

/** Tag colours per announcement type. A delay should read differently from a welcome. */
const TONES: Record<AnnouncementType, { bg: string; fg: string; dot: string; label: string }> = {
  delay: { bg: "var(--mg-live-bg)", fg: "var(--mg-danger)", dot: "var(--mg-live)", label: "Delay" },
  schedule: {
    bg: "var(--mg-surface-cream)",
    fg: "#9a7414",
    dot: "var(--mg-gold)",
    label: "Schedule",
  },
  result: { bg: "var(--mg-win-bg)", fg: "var(--mg-win)", dot: "var(--mg-win)", label: "Result" },
  notice: {
    bg: "var(--mg-surface-alt)",
    fg: "var(--mg-purple)",
    dot: "#7a4fbf",
    label: "Notice",
  },
};

/**
 * The announcements timeline.
 *
 * This is the highest-value realtime surface on the day: a delayed match or a
 * moved court has to reach people who already have the page open. New rows are
 * prepended straight from the payload — an announcement is self-contained, so
 * unlike a fixture there is nothing to join and no need to re-query.
 */
export function AnnouncementFeed({ announcements: initial }: { announcements: Announcement[] }) {
  const [announcements, setAnnouncements] = useState(initial);
  const [seenInitial, setSeenInitial] = useState(initial);

  // Adopt a fresh server render during render, not in an effect: an effect
  // would paint the previous list once before correcting itself.
  if (seenInitial !== initial) {
    setSeenInitial(initial);
    setAnnouncements(initial);
  }

  useEffect(() => {
    const supabase = createClient();

    const channel = supabase
      .channel("announcements-feed")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "announcements" },
        (payload) => {
          setAnnouncements((current) => {
            if (payload.eventType === "DELETE") {
              const removed = payload.old as { id?: string };
              return current.filter((a) => a.id !== removed.id);
            }

            const row = payload.new as {
              id: string;
              type: AnnouncementType;
              title: string;
              body: string | null;
              published_at: string;
            };
            const next: Announcement = {
              id: row.id,
              type: row.type,
              title: row.title,
              body: row.body,
              publishedAt: row.published_at,
            };

            const rest = current.filter((a) => a.id !== next.id);
            return [next, ...rest].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  if (announcements.length === 0) {
    return <p className={styles.empty}>No announcements yet. Check back through the day.</p>;
  }

  return (
    <div className={styles.feed}>
      <span className={styles.thread} aria-hidden="true" />
      {announcements.map((announcement) => {
        const tone = TONES[announcement.type] ?? TONES.notice;
        return (
          <article key={announcement.id} className={styles.item}>
            <span className={styles.dotCell}>
              <span
                className={styles.dot}
                style={{ background: tone.dot, boxShadow: `0 0 0 1px ${tone.dot}` }}
              />
            </span>
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <span className={styles.tag} style={{ background: tone.bg, color: tone.fg }}>
                  {tone.label}
                </span>
                <time className={styles.time} dateTime={announcement.publishedAt}>
                  {formatFeedTime(announcement.publishedAt)}
                </time>
              </div>
              <h2 className={styles.title}>{announcement.title}</h2>
              {announcement.body ? <p className={styles.body}>{announcement.body}</p> : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}
