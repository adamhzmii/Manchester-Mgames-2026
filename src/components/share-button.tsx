"use client";

import { useState } from "react";

/**
 * Shares the current page through the phone's own share sheet — straight into
 * WhatsApp, which is where a team actually coordinates — and falls back to
 * copying the link where there is no share sheet (most laptops).
 */
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
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
        return;
      } catch (error) {
        // Dismissing the sheet is not a failure worth falling back from.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // No clipboard either: nothing more to try.
    }
  };

  return (
    <button type="button" className={className} onClick={share} aria-live="polite">
      {copied ? "Link copied" : children}
    </button>
  );
}
