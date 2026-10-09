"use client";

import { useEffect, useState } from "react";

/**
 * The same site at Vercel's own address, for networks that block ours.
 *
 * University of Manchester wifi (eduroam, and the University VPN) resets any
 * connection to manchestermgames.com: the domain was registered on
 * 1 October 2026 and the campus firewall refuses newly registered domains.
 * The vercel.app address is the same deployment with the same live data, and
 * it gets through. When a page on our domain cannot reach the scores but
 * this address answers, the visitor is told plainly and offered it.
 *
 * public/sw.js keeps its own copy of these two constants — a service worker
 * cannot import from here.
 */
export const BACKUP_ORIGIN = "https://manchester-mgames-2026.vercel.app";
const PRIMARY_HOSTS = ["manchestermgames.com", "www.manchestermgames.com"];

/** Carries followed teams across: localStorage does not cross origins. */
export const FOLLOW_PARAM = "follow";

export function onPrimaryHost(): boolean {
  return PRIMARY_HOSTS.includes(window.location.hostname);
}

/** This page on the backup address, bringing the visitor's teams along. */
export function backupUrl(path: string, follow: readonly string[]): string {
  const url = new URL(path, BACKUP_ORIGIN);
  if (follow.length > 0) url.searchParams.set(FOLLOW_PARAM, follow.join(","));
  return url.toString();
}

/**
 * Whether the backup address answers. An opaque no-cors request is enough:
 * it resolves when the connection succeeds and rejects when it does not,
 * which is all this needs to know.
 */
export async function backupReachable(timeoutMs = 5000): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    await fetch(`${BACKUP_ORIGIN}/icons/icon-192.png`, {
      mode: "no-cors",
      cache: "no-store",
      signal: controller.signal,
    });
    return true;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * True once the scores have stopped loading on our address while the backup
 * still answers — this network blocks us, rather than the phone being
 * offline. Checked once per run of failures, never on the backup itself.
 */
export function useBlockedHere(failing: boolean): boolean {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    if (!failing || !onPrimaryHost()) return;
    let cancelled = false;
    void backupReachable().then((ok) => {
      if (!cancelled) setBlocked(ok);
    });
    return () => {
      cancelled = true;
    };
  }, [failing]);

  // Scores coming through again means the block has gone (or the visitor
  // moved off that wifi).
  return failing && blocked;
}
