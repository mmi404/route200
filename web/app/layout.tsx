import type { Metadata, Viewport } from "next";
import {
  Anek_Bangla,
  IBM_Plex_Mono,
  IBM_Plex_Sans,
  Noto_Sans_Bengali,
} from "next/font/google";
import "./globals.css";

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

export const metadata: Metadata = {
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${anekBangla.variable} ${plexSans.variable} ${notoBengali.variable} ${plexMono.variable} h-full`}
    >
      <body className="flex min-h-full flex-col bg-paper text-ink">
        {children}
      </body>
    </html>
  );
}
