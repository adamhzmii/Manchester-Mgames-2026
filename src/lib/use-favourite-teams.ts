"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * "My Games" — the visitor's saved teams.
 *
 * Attendees never log in, so there is no row to store this against. It lives
 * in localStorage as a list of team ids and the filtering happens client-side
 * over data the page already has.
 *
 * Ids rather than names: two sports can both field "KL Tigers" as separate
 * teams, and following the football side should not light up the netball
 * fixtures.
 *
 * Exposed through `useSyncExternalStore` rather than an effect that copies
 * localStorage into state. That gives the right answer in all three places it
 * matters: the server render and first client paint agree (both see the empty
 * server snapshot, so no hydration mismatch), a second tab stays in step via
 * the storage event, and React never has to re-render to catch up with a store
 * it could have read directly.
 */
const STORAGE_KEY = "mgames26:favourite-teams";

/** Shared empty array — a fresh [] each read would loop getSnapshot forever. */
const EMPTY: readonly string[] = [];

const listeners = new Set<() => void>();

// getSnapshot must return a referentially stable value while the underlying
// store is unchanged, so the parsed array is memoised against the raw string
// it came from.
let cachedRaw: string | null = null;
let cachedValue: readonly string[] = EMPTY;

function parse(raw: string | null): readonly string[] {
  if (!raw) return EMPTY;
  try {
    const parsed: unknown = JSON.parse(raw);
    // Anything can be written into localStorage — by an older version of this
    // app, or by hand. Take only what still looks right.
    if (!Array.isArray(parsed)) return EMPTY;
    const ids = parsed.filter((v): v is string => typeof v === "string");
    return ids.length === 0 ? EMPTY : ids;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): readonly string[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedValue = parse(raw);
  }
  return cachedValue;
}

/** No localStorage on the server — everyone starts with nothing followed. */
function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // `storage` fires in *other* tabs only, so writes in this one notify directly.
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function write(ids: readonly string[]): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // Private browsing and full quotas both throw here. Losing the saved teams
    // is a minor downgrade; breaking the schedule would not be. The in-memory
    // cache below still updates, so the current session behaves normally.
  }
  cachedRaw = JSON.stringify(ids);
  cachedValue = ids.length === 0 ? EMPTY : ids;
  for (const listener of listeners) listener();
  mirrorForWorker(ids);
}

/**
 * A copy the service worker can read. When a network blocks our address
 * (see src/lib/backup-site.ts) the worker sends the visitor to the backup
 * address, where localStorage starts empty; it reads the teams from here to
 * bring them along. Not "mgames-…": the worker clears those on every update.
 */
const WORKER_CACHE = "mgames26-prefs";
export const WORKER_FOLLOW_KEY = "/__mgames/follow";

function mirrorForWorker(ids: readonly string[]): void {
  if (typeof caches === "undefined") return;
  void caches
    .open(WORKER_CACHE)
    .then((cache) => cache.put(WORKER_FOLLOW_KEY, new Response(JSON.stringify(ids))))
    .catch(() => {});
}

/** Teams followed before the mirror existed get copied over on any visit. */
export function mirrorFavouritesForWorker(): void {
  mirrorForWorker(getSnapshot());
}

/**
 * Teams brought over from the other address in the link. Added to whatever
 * is already followed here, never replacing it.
 */
export function adoptFavourites(ids: readonly string[]): void {
  const current = getSnapshot();
  const added = ids.filter((id) => !current.includes(id));
  if (added.length > 0) write([...current, ...added]);
}

export function useFavouriteTeams() {
  const teamIds = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback((ids: readonly (string | null)[]) => {
    const wanted = ids.filter((id): id is string => Boolean(id));
    if (wanted.length === 0) return;

    const current = getSnapshot();
    // Toggling a fixture toggles both sides together: if either is already
    // followed, the tap means "stop following this match".
    const anyFollowed = wanted.some((id) => current.includes(id));
    write(
      anyFollowed
        ? current.filter((id) => !wanted.includes(id))
        : [...current, ...wanted.filter((id) => !current.includes(id))],
    );
  }, []);

  const clear = useCallback(() => write(EMPTY), []);

  const has = useCallback(
    (id: string | null) => id !== null && teamIds.includes(id),
    [teamIds],
  );

  return { teamIds, toggle, clear, has };
}
