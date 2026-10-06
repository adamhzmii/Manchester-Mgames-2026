import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";

import { BottomNav } from "@/components/bottom-nav";
import { DelaysProvider } from "@/components/delays";
import { Pwa } from "@/components/pwa";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { ClockProvider } from "@/lib/clock";
import { clockOffsetMs } from "@/lib/demo";
import { LiveFeedProvider } from "@/lib/live-feed";

import "./globals.css";

const barlow = Barlow({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

/**
 * Full Condensed rather than the first version's Semi Condensed: scores,
 * kick-off times and team names are what this site is read for, and the
 * narrower cut fits a two-team scoreline across a phone at a size you can
 * read from arm's length courtside.
 */
const barlowCondensed = Barlow_Condensed({
  variable: "--font-barlow-condensed",
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

const SITE_URL = "https://manchestermgames.com";
const DESCRIPTION =
  "Live scores, schedule, standings and venue guide for Manchester MGames 2026 — the Malaysian Students' Society of Manchester's multi-sport tournament, Saturday 24 October 2026.";

export const metadata: Metadata = {
  // Without metadataBase, Next emits relative OG image URLs, and every scraper
  // (WhatsApp, Instagram, iMessage) needs an absolute one to fetch the card.
  metadataBase: new URL(SITE_URL),
  title: {
    default: "MGames 2026 · Manchester",
    template: "%s · MGames 2026",
  },
  description: DESCRIPTION,
  applicationName: "MGames 2026",
  openGraph: {
    type: "website",
    siteName: "MGames 2026",
    title: "MGames 2026 · Manchester",
    description: DESCRIPTION,
    url: SITE_URL,
    locale: "en_GB",
  },
  twitter: {
    card: "summary_large_image",
    title: "MGames 2026 · Manchester",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  // Matches the header band so the phone's status bar reads as part of it.
  themeColor: "#160f29",
  // Lets the bottom bar extend under the iPhone home indicator and pad itself
  // clear with env(safe-area-inset-bottom).
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        <ClockProvider offset={clockOffsetMs()}>
          <LiveFeedProvider>
            <DelaysProvider>
              <SiteHeader />
              <main id="main">{children}</main>
              <SiteFooter />
              <BottomNav />
              <Pwa />
            </DelaysProvider>
          </LiveFeedProvider>
        </ClockProvider>
      </body>
    </html>
  );
}
