import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PALETTE } from "@/lib/design-tokens";

// Favicon: the "200" mark alone, in the brand's ok green on ink. The full
// "Route200" wordmark does not read at 16-32px, so this keeps only the part
// of the identity that still does. See DESIGN_SPEC.md section 2.

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

const anekBangla700 = await readFile(
  join(process.cwd(), "app/_og-fonts/AnekBangla-Bold.woff"),
);

export default async function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: PALETTE.ink,
        }}
      >
        <div
          style={{
            display: "flex",
            fontFamily: "Anek Bangla",
            fontWeight: 700,
            fontSize: 20,
            lineHeight: 1,
            letterSpacing: "-0.02em",
            color: PALETTE.ok,
          }}
        >
          200
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
      ],
    },
  );
}
