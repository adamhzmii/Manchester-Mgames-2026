"use client";

import { useState } from "react";

/**
 * Shares a page through the phone's own share sheet — straight into WhatsApp,
 * which is where a team actually coordinates.
 *
 * Always the site's real address, not whatever the browser is on: shared
 * from a test copy or a preview, the link should still open for everyone.
 * Where the browser has no share sheet, the link is copied; where it cannot
 * copy either (a page opened over plain http, as on a test copy), WhatsApp
 * opens with the message written.
 */
const SITE = "https://manchestermgames.com";

export function ShareButton({
  title,
  text,
  className,
  children,
}: {
  title: string;
  text: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [copied, setCopied] = useState(false);

  const share = async () => {
    const url = `${SITE}${window.location.pathname}`;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Dismissing the sheet is not a failure worth falling back from.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch {
        // Fall through to WhatsApp.
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text}\n${url}`)}`, "_blank", "noopener");
  };

  return (
    <button type="button" className={className} onClick={share} aria-live="polite">
      {copied ? "Link copied" : children}
    </button>
  );
}
