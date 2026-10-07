"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * Where the visitor has been on this site, in this tab — for a Back button
 * that goes back, rather than guessing.
 *
 * The match page's Back used to trust document.referrer. That is the page
 * the site was first opened from, and moving around inside the site never
 * changes it: open the site from a bookmark, tap a game on the home page,
 * tap Back, and it sent you to the schedule instead of home. This keeps a
 * small record of the site's own history entries instead.
 *
 * Kept in sessionStorage, which belongs to the tab and survives a reload,
 * the same lifetime as the browser's own history.
 */
const KEY = "mg:history";

type Trail = { urls: string[]; at: number };

function read(): Trail {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Trail;
  } catch {
    // Private mode or a mangled value: start again.
  }
  return { urls: [], at: -1 };
}

function write(trail: Trail) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    // Without storage, Back falls back to its default page; nothing breaks.
  }
}

/** When the browser last went back or forward — set before the route changes. */
let traversedAt = 0;

/** True just after a back or forward navigation, for pages deciding where to scroll. */
export function arrivedByBackOrForward(): boolean {
  return Date.now() - traversedAt < 1500;
}

/** Whether the entry before this one in the tab's history is a page of this site. */
export function canGoBackInSite(): boolean {
  return read().at > 0;
}

/**
 * Follows the route and keeps the trail in step. Treats every new URL as a
 * new entry unless the browser has just gone back or forward; a filter that
 * replaces the URL is counted as an entry too, which only ever errs towards
 * "there is somewhere to go back to" when there really is.
 */
export function NavigationTracker() {
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    const onTraverse = () => {
      traversedAt = Date.now();
    };
    window.addEventListener("popstate", onTraverse);
    return () => window.removeEventListener("popstate", onTraverse);
  }, []);

  useEffect(() => {
    const query = search.toString();
    const url = query ? `${pathname}?${query}` : pathname;
    const trail = read();

    // A reload, or the first effect after one: already where we are.
    if (trail.urls[trail.at] === url) return;

    if (arrivedByBackOrForward()) {
      if (trail.urls[trail.at - 1] === url) trail.at -= 1;
      else if (trail.urls[trail.at + 1] === url) trail.at += 1;
      else {
        const found = trail.urls.lastIndexOf(url);
        if (found >= 0) trail.at = found;
        else {
          trail.urls = [url];
          trail.at = 0;
        }
      }
    } else {
      trail.urls = [...trail.urls.slice(0, trail.at + 1), url].slice(-50);
      trail.at = trail.urls.length - 1;
    }
    write(trail);
  }, [pathname, search]);

  return null;
}
