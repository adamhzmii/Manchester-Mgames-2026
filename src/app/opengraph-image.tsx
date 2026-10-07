import { OG_SIZE, ogCard } from "@/lib/og-card";

/**
 * The card for the site itself: the home page's header, as a picture. Next
 * renders it once at build time and serves it as a static PNG.
 */
export const size = OG_SIZE;
export const contentType = "image/png";
export const alt = "Manchester MGames 2026 — Saturday 24 October, Trinity, Sugden and Denmark Road";

export default function OpengraphImage() {
  return ogCard({
    kicker: "Malaysian Students’ Society Manchester",
    title: ["MANCHESTER", "MGAMES 2026"],
    goldLast: true,
    lines: ["Saturday 24 October 2026", "Trinity, Sugden & Denmark Road · 8 sports · live scores"],
  });
}
