"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";

import { CloseIcon, ShareIcon } from "@/components/icons";

import styles from "./pwa.module.css";

/**
 * Chrome fires this instead of showing its own install banner, handing the
 * decision to the page. Not in TypeScript's DOM lib because it is not a
 * standard.
 */
type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISSED_KEY = "mgames26:install-dismissed";

/** Pages someone has opened before being asked to install anything. */
const PAGES_BEFORE_ASKING = 2;

function wasDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

function isInstalled(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Safari on an iPhone or iPad, not yet installed and not already declined.
 * Chrome and Firefox on iOS report as iOS too but cannot install; "CriOS" and
 * "FxiOS" tell them apart. Read as an external store: it is a fact about the
 * browser, and the server's answer is simply "no".
 */
function iosCanInstall(): boolean {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return ios && !isInstalled() && !wasDismissed();
}

const noSubscription = () => () => {};

/**
 * Registers the service worker and, once a visitor has shown some interest,
 * offers to put the site on their home screen.
 *
 * Two routes in, because the two phones differ. Android Chrome hands over an
 * install prompt; iPhones never do, and Safari only installs from its Share
 * menu — so on an iPhone this shows how, instead of a button that could not
 * work. Most people at a UK university are on iPhones, and the first version
 * only ever offered the Android route.
 *
 * Waits for a second page before asking: an install banner over the first
 * screen someone sees covers the thing they came for.
 */
export function Pwa() {
  const pathname = usePathname();
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [pages, setPages] = useState<string[]>([]);
  const ios = useSyncExternalStore(noSubscription, iosCanInstall, () => false);

  // Count distinct pages seen this visit, during render rather than in an
  // effect so the banner can appear on the same paint as the second page.
  if (!pages.includes(pathname)) setPages([...pages, pathname]);

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
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (wasDismissed() || isInstalled()) return;
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = (remember: boolean) => {
    setDismissed(true);
    setPromptEvent(null);
    if (remember) {
      try {
        window.localStorage.setItem(DISMISSED_KEY, "1");
      } catch {
        // Private browsing; the banner simply reappears next visit.
      }
    }
  };

  if (dismissed || pages.length < PAGES_BEFORE_ASKING) return null;
  if (!promptEvent && !ios) return null;

  return (
    <div className={styles.bar} role="region" aria-label="Install this app">
      <Image src="/icons/icon-192.png" alt="" width={36} height={36} className={styles.icon} />
      <div className={styles.text}>
        <p className={styles.title}>Keep MGames on your home screen</p>
        {!promptEvent ? (
          <p className={styles.body}>
            Tap <ShareIcon size={14} className={styles.inline} /> Share, then{" "}
            <strong>Add to Home Screen</strong>.
          </p>
        ) : (
          <p className={styles.body}>Opens like an app, and works when the wifi drops.</p>
        )}
      </div>
      {promptEvent ? (
        <button
          type="button"
          className={styles.install}
          onClick={async () => {
            await promptEvent.prompt();
            // Either outcome ends this banner: accepted installs it, dismissed
            // means they have answered and should not be asked again.
            const { outcome } = await promptEvent.userChoice;
            close(outcome === "dismissed");
          }}
        >
          Install
        </button>
      ) : null}
      <button type="button" className={styles.dismiss} onClick={() => close(true)} aria-label="Not now">
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
