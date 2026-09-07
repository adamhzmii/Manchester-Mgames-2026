"use client";

import { useEffect, useState } from "react";

import { CloseIcon } from "@/components/icons";

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

/**
 * Registers the service worker and, where the browser allows it, offers to
 * install the app to the home screen.
 *
 * Rendered from the root layout so registration happens once per session
 * regardless of entry page.
 */
export function Pwa() {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // After load, not during: registration competes with the first render
      // for bandwidth otherwise, and this is the least urgent thing on the page.
      const register = () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // A failed registration costs offline support and push, nothing else.
          // The app must still work, so this is deliberately swallowed.
        });
      };
      if (document.readyState === "complete") register();
      else window.addEventListener("load", register, { once: true });
    }

    let alreadyDismissed = false;
    try {
      alreadyDismissed = window.localStorage.getItem(DISMISSED_KEY) === "1";
    } catch {
      alreadyDismissed = false;
    }

    const onPrompt = (event: Event) => {
      event.preventDefault();
      if (alreadyDismissed) return;
      setInstallEvent(event as InstallPromptEvent);
      setDismissed(false);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  const close = (remember: boolean) => {
    setDismissed(true);
    setInstallEvent(null);
    if (remember) {
      try {
        window.localStorage.setItem(DISMISSED_KEY, "1");
      } catch {
        // Private browsing; the banner simply reappears next visit.
      }
    }
  };

  if (!installEvent || dismissed) return null;

  return (
    <div className={styles.bar} role="region" aria-label="Install this app">
      <div className={styles.text}>
        <p className={styles.title}>Add MGames to your home screen</p>
        <p className={styles.body}>Opens like an app, and works if the venue wifi drops.</p>
      </div>
      <button
        type="button"
        className={styles.install}
        onClick={async () => {
          await installEvent.prompt();
          // Either outcome ends this banner: accepted installs it, dismissed
          // means they have answered and should not be asked again.
          const { outcome } = await installEvent.userChoice;
          close(outcome === "dismissed");
        }}
      >
        Install
      </button>
      <button
        type="button"
        className={styles.dismiss}
        onClick={() => close(true)}
        aria-label="Not now"
      >
        <CloseIcon size={16} />
      </button>
    </div>
  );
}
