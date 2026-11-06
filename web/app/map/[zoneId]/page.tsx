import { Suspense } from "react";
import type { Metadata } from "next";
import { ZoneExplore } from "./_components/ZoneExplore";
import { getLocale, type Locale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { translations } from "@/lib/translations";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(translations.zoneExplore.metaTitlePrefix, locale),
  };
}

type ZoneParams = Promise<{ zoneId: string }>;

/**
 * The dedicated 3D zone page (PROGRESS.md, "Phase 2: 3D terrain explore"):
 * a low pitched flyover of one zone's real elevation, with a time scrub
 * slider over its recorded change history. Linked from /map's inspect
 * panel ("Explore in 3D"); /map itself is unaffected.
 *
 * `params` is read inside a component wrapped in <Suspense>, same pattern
 * as /map/page.tsx's own `searchParams` handling: this is a route without
 * generateStaticParams, so Cache Components treats the zoneId as runtime
 * data (see node_modules/next/dist/docs's migration guide, "Await params
 * inside Suspense"). The route is already fully request-bound regardless,
 * since the root layout reads the locale cookie at its own top level.
 */
export default async function ZoneExplorePage({
  params,
}: {
  params: ZoneParams;
}) {
  const locale = await getLocale();
  return (
    <Suspense fallback={<ExploreLoadingShell locale={locale} />}>
      <ZoneExploreRoute params={params} locale={locale} />
    </Suspense>
  );
}

async function ZoneExploreRoute({
  params,
  locale,
}: {
  params: ZoneParams;
  locale: Locale;
}) {
  const { zoneId } = await params;
  return <ZoneExplore zoneId={zoneId} locale={locale} />;
}

function ExploreLoadingShell({ locale }: { locale: Locale }) {
  return (
    <div className="flex h-[calc(100dvh-var(--spacing-header))] items-center justify-center bg-ink">
      <p className="type-small text-paper">{t(translations.zoneExplore.loading, locale)}</p>
    </div>
  );
}
