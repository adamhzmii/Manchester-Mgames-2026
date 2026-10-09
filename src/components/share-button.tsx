"use client";

import { useState } from "react";

/**
 * Shares a page through the phone's own share sheet, so people send it
 * wherever they like — WhatsApp, Instagram, Messages, anything.
 *
 * Always the site's real address, not whatever the browser is on: shared
 * from a test copy or a preview, the link should still open for everyone.
 * Where the browser has no share sheet (a computer, or a page opened over
 * plain http), the link is copied instead, to paste anywhere.
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
    if (await copy(url)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      return;
    }
    // Nothing could copy it: show the link to copy by hand.
    window.prompt("Copy this link", url);
  };

  return (
    <button type="button" className={className} onClick={share} aria-live="polite">
      {copied ? "Link copied" : children}
    </button>
  );
}

/**
 * Puts text on the clipboard. The modern way needs a secure page; the old
 * one (a hidden text box and the copy command) still works over plain http.
 */
async function copy(value: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      // Try the old way.
    }
  }
  const box = document.createElement("textarea");
  box.value = value;
  box.setAttribute("readonly", "");
  box.style.position = "fixed";
  box.style.opacity = "0";
  document.body.appendChild(box);
  box.select();
  try {
    return document.execCommand("copy");
  } catch {
    return false;
  } finally {
    box.remove();
  }
}
