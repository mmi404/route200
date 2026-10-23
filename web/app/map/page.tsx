import { Suspense } from "react";
import type { Metadata } from "next";
import { MapExperience } from "./_components/MapExperience";
import { getLocale, type Locale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { translations } from "@/lib/translations";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = translations.mapPage;
  return {
    title: t(copy.metaTitle, locale),
    description: t(copy.metaDescription, locale),
  };
}

type MapSearchParams = Promise<{ view?: string | string[]; zone?: string | string[] }>;

export default async function MapPage({
  searchParams,
}: {
  searchParams: MapSearchParams;
}) {
  // Resolved once here (the server entry) and threaded down as a plain
  // prop through MapExperience to whichever client children need it,
  // since MapLibre needs the browser and those components must not call
  // cookies() themselves.
  const locale = await getLocale();

  return (
    <Suspense fallback={<MapLoadingShell locale={locale} />}>
      <MapRoute searchParams={searchParams} locale={locale} />
    </Suspense>
  );
}

/**
 * Reads the two handoff params this route supports:
 * - `view`: a named camera from lib/design-tokens.ts's MAP_STYLE, used by
 *   the landing page's map teaser (DESIGN_SPEC.md 7a: "/map?view=hill-tracts").
 * - `zone`: opens straight to that zone's inspect panel.
 *
 * This reads `searchParams` (a Next.js Request-time API), so it's wrapped
 * in Suspense; everything else in MapExperience is client-rendered anyway
 * (MapLibre needs the browser) and carries no server-rendering cost. The
 * route is already fully request-bound regardless, since the root layout
 * reads the locale cookie at its own top level.
 */
async function MapRoute({
  searchParams,
  locale,
}: {
  searchParams: MapSearchParams;
  locale: Locale;
}) {
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : undefined;
  const zone = typeof params.zone === "string" ? params.zone : undefined;
  return <MapExperience initialView={view} initialZoneId={zone} locale={locale} />;
}

function MapLoadingShell({ locale }: { locale: Locale }) {
  return (
    <div className="flex h-[calc(100dvh-var(--spacing-header))] items-center justify-center bg-paper">
      <p className="type-small text-ink-subtle">{t(translations.mapPage.loadingShell, locale)}</p>
    </div>
  );
}
