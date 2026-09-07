"use client";

import { useEffect, useState } from "react";

import { BellIcon } from "@/components/icons";
import { removePushSubscription, savePushSubscription } from "@/lib/actions/push";
import { useFavouriteTeams } from "@/lib/use-favourite-teams";

import styles from "./notify-toggle.module.css";

/**
 * VAPID keys travel as base64url; PushManager wants raw bytes.
 *
 * Built on an explicitly-allocated ArrayBuffer rather than `Uint8Array.from`,
 * whose inferred `ArrayBufferLike` backing store does not satisfy
 * `BufferSource` — that union excludes SharedArrayBuffer.
 */
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
  const raw = atob(padded.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

type State = "unsupported" | "denied" | "off" | "on" | "working";

/**
 * Opt-in for match notifications.
 *
 * Deliberately never asks on page load. An unprompted permission dialog is the
 * fastest way to get permanently blocked, and once denied the browser gives no
 * way back from inside the page — so the request only happens on a tap.
 */
export function NotifyToggle() {
  const [state, setState] = useState<State>("working");
  const [error, setError] = useState<string | null>(null);
  const favourites = useFavouriteTeams();

  useEffect(() => {
    let cancelled = false;

    const detect = async () => {
      if (
        typeof window === "undefined" ||
        !("serviceWorker" in navigator) ||
        !("PushManager" in window) ||
        !("Notification" in window)
      ) {
        if (!cancelled) setState("unsupported");
        return;
      }
      if (Notification.permission === "denied") {
        if (!cancelled) setState("denied");
        return;
      }
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      if (!cancelled) setState(sub ? "on" : "off");
    };

    void detect();
    return () => {
      cancelled = true;
    };
  }, []);

  // Keep the stored team list in step: someone who follows a new team after
  // subscribing should start getting that team's alerts without re-subscribing.
  useEffect(() => {
    if (state !== "on") return;
    let cancelled = false;

    const sync = async () => {
      const reg = await navigator.serviceWorker.ready.catch(() => null);
      const sub = await reg?.pushManager.getSubscription().catch(() => null);
      if (!sub || cancelled) return;
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) return;
      await savePushSubscription(
        { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        [...favourites.teamIds],
      );
    };

    void sync();
    return () => {
      cancelled = true;
    };
  }, [state, favourites.teamIds]);

  if (state === "unsupported") return null;

  const enable = async () => {
    setError(null);
    setState("working");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      setState(permission === "denied" ? "denied" : "off");
      return;
    }

    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      setError("Notifications aren't configured yet.");
      setState("off");
      return;
    }

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(key),
      });
      const json = sub.toJSON();
      if (!json.keys?.p256dh || !json.keys?.auth) throw new Error("subscription missing keys");

      const result = await savePushSubscription(
        { endpoint: sub.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth },
        [...favourites.teamIds],
      );
      if (result.status === "error") {
        setError(result.message);
        setState("off");
        return;
      }
      setState("on");
    } catch {
      setError("Couldn't turn notifications on.");
      setState("off");
    }
  };

  const disable = async () => {
    setState("working");
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
    } catch {
      // Falls through: the local state still flips off, and a stale row is
      // pruned server-side the first time the push service rejects it.
    }
    setState("off");
  };

  return (
    <div className={styles.wrap}>
      <button
        type="button"
        className={`${styles.button} ${state === "on" ? styles.on : ""}`}
        onClick={state === "on" ? disable : enable}
        disabled={state === "working" || state === "denied"}
        aria-pressed={state === "on"}
      >
        <BellIcon size={15} />
        {state === "working"
          ? "…"
          : state === "on"
            ? "Notifications on"
            : state === "denied"
              ? "Notifications blocked"
              : "Notify me"}
      </button>

      {state === "denied" ? (
        <p className={styles.note}>
          Blocked in your browser settings — allow notifications for this site to turn them on.
        </p>
      ) : null}
      {error ? (
        <p className={styles.note} role="alert">
          {error}
        </p>
      ) : null}
      {state === "on" && favourites.teamIds.length === 0 ? (
        <p className={styles.note}>
          You&rsquo;ll get committee announcements. Pick a team to also get its match alerts.
        </p>
      ) : null}
    </div>
  );
}
