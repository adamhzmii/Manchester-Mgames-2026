"use client";

import { useSyncExternalStore } from "react";

/**
 * Which committee update this browser has already seen, so the header badge
 * and the strip under it mean "new since you last looked" rather than "an
 * update exists". The first version showed the dot permanently.
 *
 * Stored as the publish time of the newest update seen. Read through
 * useSyncExternalStore so a visit to /updates in one tab clears the badge in
 * every other open tab too.
 */
const KEY = "mgames26:updates-seen";
const EVENT = "mgames26:updates-seen";

function read(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(EVENT, onChange);
  };
}

export function useUpdatesSeen(): string | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function markUpdatesSeen(publishedAt: string): void {
  const current = read();
  if (current && Date.parse(current) >= Date.parse(publishedAt)) return;
  try {
    window.localStorage.setItem(KEY, publishedAt);
  } catch {
    // Private mode: the badge simply comes back next visit.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Whether an update published at `publishedAt` is newer than what was seen. */
export function isUnseen(publishedAt: string, seen: string | null): boolean {
  return seen === null || Date.parse(publishedAt) > Date.parse(seen);
}
