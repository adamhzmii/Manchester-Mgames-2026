/* eslint-disable @next/next/no-img-element -- the image renderer draws plain <img>; next/image means nothing to it */
import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The card WhatsApp, Instagram and iMessage show when a link to the site is
 * dropped into a chat — how most people will meet it before the day. One
 * design for every page: the hall photograph darkened like the home page's
 * header, the event's name, and what this particular link is about.
 *
 * Set in the site's own Barlow Condensed, bundled from src/app/fonts (SIL
 * OFL, licence alongside): the renderer cannot fetch web fonts. Files are
 * read from disk, not fetched from our own URL, which has no origin at build
 * time.
 */
export const OG_SIZE = { width: 1200, height: 630 };

const NIGHT = "#160F29";
const GOLD = "#F2B630";
const MUTED = "#C9C2E0";
const LIVE = "#FF6B6F";

type Card = {
  /** Small gold line at the top. */
  kicker: string;
  /** The big line or two. */
  title: string[];
  /** Under the title: when and where. */
  lines: string[];
  /** A red "LIVE" or gold "FULL TIME" tag beside the kicker. */
  badge?: { text: string; live: boolean } | null;
  /** Gold the last word of the last title line ("2026"). */
  goldLast?: boolean;
};

async function assets() {
  const root = process.cwd();
  const [photo, crest, bold, semi] = await Promise.all([
    // A small copy, scaled up: soft enough to keep the card well under the
    // size WhatsApp will show.
    readFile(join(root, "public/brand/og-photo.jpg")),
    readFile(join(root, "public/brand/logo-mark.png")),
    readFile(join(root, "src/app/fonts/barlow-condensed-800.woff")),
    readFile(join(root, "src/app/fonts/barlow-condensed-600.woff")),
  ]);
  return {
    photo: `data:image/jpeg;base64,${photo.toString("base64")}`,
    crest: `data:image/png;base64,${crest.toString("base64")}`,
    bold,
    semi,
  };
}

export async function ogCard({ kicker, title, lines, badge = null, goldLast = false }: Card) {
  const { photo, crest, bold, semi } = await assets();
  // Long team names need a smaller title to stay on two lines.
  const longest = Math.max(...title.map((t) => t.length));
  const titleSize = longest > 22 ? 84 : longest > 16 ? 100 : 128;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: NIGHT,
          color: "#ffffff",
          fontFamily: "Barlow Condensed",
        }}
      >
        <img
          src={photo}
          width={1200}
          height={630}
          alt=""
          style={{ position: "absolute", top: 0, left: 0, width: 1200, height: 630, objectFit: "cover" }}
        />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            background:
              "linear-gradient(180deg, rgba(22,15,41,0.70) 0%, rgba(22,15,41,0.86) 55%, rgba(22,15,41,0.97) 100%)",
          }}
        />

        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            padding: "56px 64px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div
                style={{
                  display: "flex",
                  fontSize: 30,
                  fontWeight: 600,
                  letterSpacing: 5,
                  color: GOLD,
                  textTransform: "uppercase",
                }}
              >
                {kicker}
              </div>
              {badge ? (
                <div
                  style={{
                    display: "flex",
                    padding: "4px 14px",
                    borderRadius: 8,
                    fontSize: 26,
                    fontWeight: 800,
                    letterSpacing: 3,
                    color: badge.live ? "#ffffff" : NIGHT,
                    background: badge.live ? LIVE : GOLD,
                  }}
                >
                  {badge.text}
                </div>
              ) : null}
            </div>
            <img src={crest} width={96} height={94} alt="" />
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            {title.map((line, i) => {
              const last = i === title.length - 1;
              if (goldLast && last && line.includes(" ")) {
                const cut = line.lastIndexOf(" ");
                return (
                  <div key={i} style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 0.92 }}>
                    {line.slice(0, cut)}&nbsp;<span style={{ color: GOLD }}>{line.slice(cut + 1)}</span>
                  </div>
                );
              }
              return (
                <div key={i} style={{ display: "flex", fontSize: titleSize, fontWeight: 800, lineHeight: 0.92 }}>
                  {line}
                </div>
              );
            })}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {lines.map((line, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  fontSize: i === 0 ? 40 : 32,
                  fontWeight: 600,
                  color: i === 0 ? "#ffffff" : MUTED,
                }}
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "Barlow Condensed", data: bold, weight: 800, style: "normal" },
        { name: "Barlow Condensed", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
}
