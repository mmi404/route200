import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PALETTE } from "@/lib/design-tokens";

// Apple touch icon: a lighter, slightly richer treatment than the tab
// favicon (icon.tsx), since iOS renders this large on a home screen rather
// than tiny in a tab strip. Paper ground with the "200" mark in ok green and
// a river-blue rule underneath, the same accent pairing the wordmark uses.

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

const anekBangla700 = await readFile(
  join(process.cwd(), "app/_og-fonts/AnekBangla-Bold.woff"),
);

export default async function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "14px",
          background: PALETTE.paper,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Anek Bangla",
            fontWeight: 700,
            fontSize: 92,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: PALETTE.ok,
          }}
        >
          200
        </div>
        <div
          style={{
            width: "96px",
            height: "6px",
            background: PALETTE.river,
          }}
        />
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
      ],
    },
  );
}
