import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Semi_Condensed } from "next/font/google";

import { BottomNav } from "@/components/bottom-nav";
import { Pwa } from "@/components/pwa";
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

const SITE_URL = "https://manchester-mgames-2026.vercel.app";
const DESCRIPTION =
  "Live schedule, scores, venue maps and food for Manchester MGames 2026 — the Malaysian Students' Society of Manchester one-day multi-sport tournament, Saturday 24 October 2026.";

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
  // The header sits on the brand purple; matching the browser chrome to it
  // stops the status bar band showing a mismatched strip on mobile.
  themeColor: "#3c2a6e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${barlow.variable} ${barlowCondensed.variable}`}>
      <body>
        <SiteHeader />
        <main id="main">{children}</main>
        <BottomNav />
        <Pwa />
      </body>
    </html>
  );
}
