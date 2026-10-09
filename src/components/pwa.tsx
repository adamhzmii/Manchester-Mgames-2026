"use client";

import { useEffect } from "react";

import { FOLLOW_PARAM } from "@/lib/backup-site";
import { adoptFavourites, mirrorFavouritesForWorker } from "@/lib/use-favourite-teams";

/**
 * Registers the service worker, which notifications and the offline copy of
 * the site depend on. Renders nothing.
 *
 * There used to be an "add MGames to your home screen" banner here. It went:
 * on the phones the committee tried it on it did not do what it said, and a
 * banner that fails is worse than none. Chrome's own install bar is held
 * back for the same reason; anyone who wants the site on their home screen
 * can still add it from the browser's menu.
 */
export function Pwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV !== "production") {
      // Production only. sw.js serves /_next/static/ cache-first, which is safe
      // when every changed file gets a new hashed name — true for a production
      // build, not for `next dev`, where a worker left over from an earlier
      // visit kept handing out old code until the page crashed on a function
      // that did not exist yet. Clear out any such worker so a developer's
      // browser heals itself.
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
        .then(() => caches.keys())
        .then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
        .catch(() => {});
    } else if ("serviceWorker" in navigator) {
      // After load, not during: registration competes with the first render
      // for bandwidth otherwise, and this is the least urgent thing on the page.
      const register = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // A failed registration costs offline support and push, nothing else.
        });
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
      mirrorFavouritesForWorker();
    }

    adoptCarriedTeams();

    // Taking the event is what stops Chrome showing its own install bar.
    const hold = (event: Event) => event.preventDefault();
    window.addEventListener("beforeinstallprompt", hold);
    return () => window.removeEventListener("beforeinstallprompt", hold);
  }, []);

  return null;
}

/**
 * Arriving at the backup address from a blocked network: the link carries the
 * teams the visitor follows on the main address (localStorage does not cross
 * over). Follow them here too, then tidy the parameter out of the address bar
 * so a shared link does not hand them to somebody else.
 */
function adoptCarriedTeams() {
  const url = new URL(window.location.href);
  const carried = url.searchParams.get(FOLLOW_PARAM);
  if (carried === null) return;
  const ids = carried
    .split(",")
    .filter((id) => /^[\w-]{1,64}$/.test(id))
    .slice(0, 100);
  adoptFavourites(ids);
  url.searchParams.delete(FOLLOW_PARAM);
  window.history.replaceState(window.history.state, "", url);
}
