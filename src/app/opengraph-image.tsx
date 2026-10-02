import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The card people see when the link is dropped into WhatsApp, Instagram or a
 * group chat — which, before the event, is how most people will meet the site
 * at all.
 *
 * Generated rather than a flat file so the date and venues stay in one place;
 * Next renders it once at build time and serves it as a static PNG. Set in the
 * site's own Barlow Condensed, bundled from src/app/fonts (SIL OFL, licence
 * alongside), because the renderer cannot fetch web fonts and its default face
 * made the card look like a different event's.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MGames 2026 — Manchester, Saturday 24 October";

const NIGHT = "#160F29";
const NIGHT_3 = "#2E2550";
const GOLD = "#F2B630";
const MUTED = "#A59DC3";

export default async function OpengraphImage() {
  // Read from disk rather than fetching our own URL: at build time the site is
  // not yet serving, and a relative fetch has no origin to resolve against.
  const root = process.cwd();
  const [crest, bold, semi] = await Promise.all([
    readFile(join(root, "public/brand/logo-mark.png")),
    readFile(join(root, "src/app/fonts/barlow-condensed-800.woff")),
    readFile(join(root, "src/app/fonts/barlow-condensed-600.woff")),
  ]);
  const crestSrc = `data:image/png;base64,${crest.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: `linear-gradient(135deg, ${NIGHT} 0%, ${NIGHT} 50%, ${NIGHT_3} 100%)`,
          color: "#ffffff",
          fontFamily: "Barlow Condensed",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            flex: 1,
            minWidth: 0,
          }}
        >
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
            Malaysian Students&rsquo; Society of Manchester
          </div>

          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontSize: 150, fontWeight: 800, lineHeight: 0.86 }}>
              MGAMES&nbsp;<span style={{ color: GOLD }}>2026</span>
            </div>
            <div
              style={{
                display: "flex",
                marginTop: 18,
                fontSize: 46,
                fontWeight: 600,
                letterSpacing: 16,
                textTransform: "uppercase",
              }}
            >
              Manchester
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 36, fontWeight: 600 }}>
            <div style={{ display: "flex", textTransform: "uppercase", letterSpacing: 2 }}>
              Sat 24 October
            </div>
            <div style={{ display: "flex", width: 10, height: 10, borderRadius: 5, background: GOLD }} />
            <div style={{ display: "flex", color: MUTED }}>Trinity &amp; Sugden · 8 sports</div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", paddingLeft: 24 }}>
          <img src={crestSrc} width={230} height={225} alt="" />
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Barlow Condensed", data: bold, weight: 800, style: "normal" },
        { name: "Barlow Condensed", data: semi, weight: 600, style: "normal" },
      ],
    },
  );
}
