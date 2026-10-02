"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";

import { RelTime } from "@/components/rel-time";
import { UPDATE_TYPE_LABEL, UpdateTypeIcon } from "@/components/update-type-icon";
import { postAnnouncement, type AnnouncementState } from "@/lib/actions/announcements";
import { formatFeedTime } from "@/lib/format";
import { useLiveFeed } from "@/lib/live-feed";
import type { Announcement } from "@/lib/queries";
import type { AnnouncementType } from "@/lib/supabase/types";
import { markUpdatesSeen } from "@/lib/updates-seen";

import styles from "./updates-view.module.css";

/**
 * The committee's updates, newest first — and, for a signed-in coordinator,
 * the form that posts them.
 *
 * New updates arrive through the shared live feed rather than a Realtime
 * subscription of their own. The first version held one open Supabase
 * connection per phone on this page, which is the same per-connection
 * ceiling the scores were moved off; the feed already carries the newest
 * update, so seeing one we do not have is the cue to re-fetch the list.
 */
export function UpdatesView({
  updates,
  canPost,
}: {
  updates: Announcement[];
  canPost: boolean;
}) {
  const router = useRouter();
  const { latestUpdate } = useLiveFeed();
  const newest = updates[0];

  // Opening this page is reading the updates: clear the header's badge.
  useEffect(() => {
    if (newest) markUpdatesSeen(newest.publishedAt);
  }, [newest]);

  // The feed knows about an update this list has not got yet.
  const behind = latestUpdate !== null && !updates.some((u) => u.id === latestUpdate.id);
  useEffect(() => {
    if (behind) router.refresh();
  }, [behind, router]);

  return (
    <div className={`mg-wrap ${styles.page}`}>
      <div>
        <h1 className="mg-page-title">Updates</h1>
        <p className={styles.sub}>Delays, court changes and news from the committee.</p>
      </div>

      {canPost ? <Composer /> : null}

      {updates.length === 0 ? (
        <p className={styles.empty}>Nothing yet. Anything that changes on the day appears here first.</p>
      ) : (
        <ol className={styles.feed}>
          {updates.map((u, index) => (
            <li key={u.id} className={styles.item} data-type={u.type} data-latest={index === 0 ? "" : undefined}>
              <span className={styles.icon}>
                <UpdateTypeIcon type={u.type} size={18} />
              </span>
              <div className={styles.content}>
                <p className={styles.meta}>
                  <span className={styles.type}>{UPDATE_TYPE_LABEL[u.type]}</span>
                  <time dateTime={u.publishedAt}>{formatFeedTime(u.publishedAt)}</time>
                  <RelTime iso={u.publishedAt} className={styles.ago} />
                </p>
                <h2 className={styles.title}>{u.title}</h2>
                {u.body ? <p className={styles.body}>{u.body}</p> : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

const TYPES: AnnouncementType[] = ["delay", "schedule", "notice", "result"];
const IDLE: AnnouncementState = { status: "idle", message: null };
const TITLE_MAX = 90;

/**
 * Posting an update: pick what kind, say it in a line, optionally add detail.
 * Posting also pushes it to every phone that turned notifications on, so the
 * button says so.
 */
function Composer() {
  const [state, action, pending] = useActionState(postAnnouncement, IDLE);
  const [type, setType] = useState<AnnouncementType>("delay");
  const [title, setTitle] = useState("");
  const form = useRef<HTMLFormElement>(null);

  // Clear the form once an update has gone out, so the next one starts fresh.
  const [handled, setHandled] = useState(state);
  if (state !== handled) {
    setHandled(state);
    if (state.status === "success") setTitle("");
  }
  useEffect(() => {
    if (state.status === "success") form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className={styles.composer}>
      <p className={styles.composerTitle}>Post an update</p>

      <div className={styles.types} role="radiogroup" aria-label="Kind of update">
        {TYPES.map((t) => (
          <label key={t} className={`${styles.typeOption} ${type === t ? styles.typeOn : ""}`}>
            <input
              type="radio"
              name="type"
              value={t}
              checked={type === t}
              onChange={() => setType(t)}
              className="mg-sr-only"
            />
            <UpdateTypeIcon type={t} size={16} />
            {UPDATE_TYPE_LABEL[t]}
          </label>
        ))}
      </div>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>
          Headline
          <span className={styles.count}>
            {title.length}/{TITLE_MAX}
          </span>
        </span>
        <input
          name="title"
          required
          maxLength={TITLE_MAX}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={
            type === "delay"
              ? "Basketball semi-final 2 starts 10 min late"
              : type === "schedule"
                ? "Netball final moved to Court 3"
                : type === "result"
                  ? "Melaka Mariners win the football"
                  : "Lost property is at Trinity reception"
          }
          className={styles.input}
          autoComplete="off"
        />
      </label>

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Detail (optional)</span>
        <textarea name="body" rows={2} className={styles.input} />
      </label>

      {state.status === "error" && state.message ? (
        <p className={styles.error} role="alert">
          {state.message}
        </p>
      ) : null}
      {state.status === "success" ? (
        <p className={styles.success} role="status">
          Posted — it is on every open page within about 20 seconds.
        </p>
      ) : null}

      <button type="submit" className="mg-btn mg-btn-gold" disabled={pending || title.trim() === ""}>
        {pending ? "Posting…" : "Post and notify everyone"}
      </button>
    </form>
  );
}
