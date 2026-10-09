"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * A small remembered choice — which sport a coordinator looks after, which
 * of its courts — kept in localStorage so the court sheet opens where they
 * left it.
 *
 * Read through useSyncExternalStore, so the server render and first paint
 * agree (both see null) and every component using the same key stays in
 * step. Private browsing throws on localStorage; the choice then lives in
 * memory for the visit instead of failing.
 */
const listeners = new Set<() => void>();
const memory = new Map<string, string | null>();

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memory.get(key) ?? null;
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function useStored(key: string): [string | null, (value: string | null) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => read(key),
    () => null,
  );

  const set = useCallback(
    (next: string | null) => {
      try {
        if (next === null) window.localStorage.removeItem(key);
        else window.localStorage.setItem(key, next);
      } catch {
        memory.set(key, next);
      }
      for (const listener of listeners) listener();
    },
    [key],
  );

  return [value, set];
}
