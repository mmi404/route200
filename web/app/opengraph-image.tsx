import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PALETTE } from "@/lib/design-tokens";

// Share card: the Route200 wordmark and the landing hero's subhead on the
// paper ground, with a restrained river-contour line standing in for the
// decoration DESIGN_SPEC.md otherwise rules out (no gradients, no icons in
// circles, no stock art). Built from the real design tokens and the real
// brand type, not a hand-drawn bitmap.

export const alt =
  "Route200: satellite radar data on Bangladesh's rivers and hillsides, routed to a public map and to SMS and Bangla voice alerts.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const [anekBangla700, plexSans400, plexSans600] = await Promise.all([
  readFile(join(process.cwd(), "app/_og-fonts/AnekBangla-Bold.woff")),
  readFile(join(process.cwd(), "app/_og-fonts/IBMPlexSans-Regular.woff")),
  readFile(join(process.cwd(), "app/_og-fonts/IBMPlexSans-SemiBold.woff")),
]);

// A single gentle contour line, the same restrained motif a river or
// hillside line reading on the map would use. Rendered once as a data URI
// so it passes through ImageResponse as an <img>, the reliable path for
// inline vector art in satori.
const riverLine = `<svg width="1200" height="64" viewBox="0 0 1200 64" xmlns="http://www.w3.org/2000/svg"><path d="M0 32 C 140 6, 280 58, 420 32 C 560 6, 700 58, 840 32 C 940 14, 1060 50, 1200 26" fill="none" stroke="${PALETTE.river}" stroke-width="3" stroke-linecap="round"/></svg>`;
const riverLineSrc = `data:image/svg+xml;base64,${Buffer.from(riverLine).toString("base64")}`;

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "88px",
          background: PALETTE.paper,
          position: "relative",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={riverLineSrc}
          alt=""
          width={1200}
          height={64}
          style={{
            position: "absolute",
            left: 0,
            bottom: 150,
            opacity: 0.55,
          }}
        />

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "28px",
          }}
        >
          <div
            style={{
              display: "flex",
              fontFamily: "Anek Bangla",
              fontWeight: 700,
              fontSize: 104,
              lineHeight: 1,
              letterSpacing: "-0.03em",
            }}
          >
            <span style={{ color: PALETTE.ink }}>Route</span>
            <span style={{ color: PALETTE.ok }}>200</span>
          </div>
          <div
            style={{
              display: "flex",
              fontFamily: "IBM Plex Sans",
              fontWeight: 400,
              fontSize: 34,
              lineHeight: 1.45,
              color: PALETTE.inkMuted,
              maxWidth: "840px",
            }}
          >
            Route200 turns satellite radar data into a warning that reaches
            your phone, not just a server.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "18px",
          }}
        >
          <div
            style={{
              width: "100%",
              height: "2px",
              background: PALETTE.ink,
            }}
          />
          <div
            style={{
              display: "flex",
              fontFamily: "IBM Plex Sans",
              fontWeight: 400,
              fontSize: 22,
              color: PALETTE.inkSubtle,
            }}
          >
            Built by team{" "}
            <span
              style={{
                fontFamily: "IBM Plex Sans",
                fontWeight: 600,
                color: PALETTE.ink,
                margin: "0 8px",
              }}
            >
              CUET_404
            </span>{" "}
            for NASA Space Apps Challenge 2026.
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        {
          name: "Anek Bangla",
          data: anekBangla700,
          style: "normal",
          weight: 700,
        },
        {
          name: "IBM Plex Sans",
          data: plexSans400,
          style: "normal",
          weight: 400,
        },
        {
          name: "IBM Plex Sans",
          data: plexSans600,
          style: "normal",
          weight: 600,
        },
      ],
    },
  );
}
