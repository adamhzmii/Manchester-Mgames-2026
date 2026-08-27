import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Semi_Condensed, Fraunces } from "next/font/google";

import { BottomNav } from "@/components/bottom-nav";
import { SiteHeader } from "@/components/site-header";

import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const barlowCondensed = Barlow_Semi_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

// The editorial display face — currently used only on the home page masthead.
// Fraunces' optical-size axis is what makes it work at both a large headline
// size and small in-text use without looking like two different typefaces.
const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  weight: "variable",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: {
    default: "MGames 2026 · Manchester",
    template: "%s · MGames 2026",
  },
  description:
    "Live schedule, scores, venue maps and food for Manchester MGames 2026 — the Malaysian Students' Society of Manchester one-day multi-sport tournament, Saturday 24 October 2026.",
};

export const viewport: Viewport = {
  // The header sits on the brand purple; matching the browser chrome to it
  // stops the status bar band showing a mismatched strip on mobile.
  themeColor: "#3c2a6e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-GB"
      className={`${barlow.variable} ${barlowCondensed.variable} ${fraunces.variable}`}
    >
      <body>
        <SiteHeader />
        <main id="main">{children}</main>
        <BottomNav />
      </body>
    </html>
  );
}
