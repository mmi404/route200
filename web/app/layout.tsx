import type { Metadata, Viewport } from "next";
import {
  Anek_Bangla,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Noto_Sans_Bengali,
} from "next/font/google";
import "./globals.css";
import { SiteHeader } from "./_landing/SiteHeader";
import { getLocale } from "@/lib/locale";

/*
 * Font stack (see DESIGN_SPEC.md, "Type"):
 * - Anek Bangla: display and headings, both scripts. Width axis loaded so
 *   headlines can run semi-condensed like a newsroom headline face.
 * - IBM Plex Sans: Latin body, UI and stat numerals (width axis for the
 *   condensed stat figures, tabular numerals for count-ups).
 * - Noto Sans Bengali: Bangla body. Not preloaded: it is pulled in by
 *   unicode-range only when Bengali glyphs actually render.
 * - IBM Plex Mono: the data voice (dates, coordinates, scenes, sources).
 * The CSS variables below are consumed by the font tokens in globals.css.
 */
const anekBangla = Anek_Bangla({
  subsets: ["latin", "bengali"],
  axes: ["wdth"],
  variable: "--font-anek-bangla",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  style: ["normal", "italic"],
  variable: "--font-plex-sans",
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  variable: "--font-noto-bengali",
  display: "swap",
  preload: false,
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

// Update once the real production domain is live; this only affects how
// absolute URLs (the OG/Twitter images below) resolve, not local dev.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://route200.vercel.app";

// The root layout reads the locale cookie directly, with no <Suspense>
// boundary (there is no child to wrap: the cookie drives <html lang>
// itself, see the Cache Components migration guide's note on this exact
// case). That is deliberate: every route under this layout is meant to be
// request-bound now (PROGRESS.md), not a build-time gap to close. Without
// this, Next.js still fails to statically prerender its own implicit
// /_not-found shell (which composes this same layout with no request to
// read a cookie from), since that one page has no Suspense boundary to
// defer into. `instant = false` is the documented way to allow a layout
// to block rather than prerender.
export const instant = false;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Route200",
    template: "%s · Route200",
  },
  description:
    "Route200 turns satellite radar data into a warning that reaches your phone, not just a server.",
  applicationName: "Route200",
  openGraph: {
    title: "Route200",
    description:
      "From 404 to 200: Bangladesh's climate data finally has a route to you.",
    siteName: "Route200",
    locale: "en_US",
    alternateLocale: ["bn_BD"],
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#f5f0e6",
  colorScheme: "light",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Reads the route200-locale cookie so <html lang> is correct on first
  // paint, not applied after a client-side hydration flash: the whole
  // typography system in globals.css branches on :lang(bn) for
  // line-height/tracking/font-stretch. This read makes every route under
  // this layout request-bound instead of static; see PROGRESS.md for why
  // that trade-off is expected here, not a regression.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${anekBangla.variable} ${plexSans.variable} ${notoBengali.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <SiteHeader locale={locale} />
        {children}
      </body>
    </html>
  );
}
