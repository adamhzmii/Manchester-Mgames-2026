import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

/**
 * The card people see when the link is dropped into WhatsApp, Instagram or a
 * group chat — which, before the event, is how most people will meet the site
 * at all.
 *
 * Generated rather than a flat file so the date and venues stay in one place;
 * Next renders it once at build time and serves it as a static PNG.
 */
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "MGames 2026 — Manchester, Saturday 24 October";

const PURPLE = "#3C2A6E";
const PURPLE_DEEP = "#2A1D52";
const GOLD = "#D4A93C";

export default async function OpengraphImage() {
  // Read from disk rather than fetching our own URL: at build time the site is
  // not yet serving, and a relative fetch has no origin to resolve against.
  const crest = await readFile(join(process.cwd(), "public/brand/logo-mark.png"));
  const crestSrc = `data:image/png;base64,${crest.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: `linear-gradient(135deg, ${PURPLE_DEEP} 0%, ${PURPLE} 55%, #4a357f 100%)`,
          color: "#ffffff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <img src={crestSrc} width={96} height={94} alt="" />
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 6,
              color: GOLD,
              textTransform: "uppercase",
            }}
          >
            Malaysian Students&rsquo; Society · Manchester
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 112, fontWeight: 800, lineHeight: 1.02 }}>
            MANCHESTER
          </div>
          <div style={{ display: "flex", fontSize: 112, fontWeight: 800, lineHeight: 1.02 }}>
            MGAMES&nbsp;<span style={{ color: GOLD }}>2026</span>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 32 }}>
          <div style={{ display: "flex", fontWeight: 700 }}>Sat 24 October</div>
          <div
            style={{
              display: "flex",
              width: 8,
              height: 8,
              borderRadius: 4,
              background: GOLD,
            }}
          />
          <div style={{ display: "flex", opacity: 0.85 }}>Trinity &amp; Sugden · 8 sports</div>
        </div>
      </div>
    ),
    size,
  );
}
