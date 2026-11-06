import { Suspense } from "react";
import type { Metadata } from "next";
import { GroundView } from "./_components/GroundView";
import { getLocale, type Locale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { translations } from "@/lib/translations";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(translations.groundView.metaTitlePrefix, locale),
  };
}

type ZoneParams = Promise<{ zoneId: string }>;

/**
 * Ground View (PROGRESS.md, "Phase 3: Ground View," experimental): a
 * second, separate way to look at one zone, alongside the phase-2
 * /map/[zoneId] page rather than instead of it. Where that page drapes
 * real severity color on real elevation, this page is a stylized low-poly
 * walkthrough: a forest that thins, a clearing that opens, a road and a
 * house that appear, as the zone's real recorded history gets more severe.
 * Kept on its own route specifically so both can be judged independently.
 *
 * Same params-inside-Suspense pattern as /map/[zoneId]/page.tsx, for the
 * same Cache Components reason documented there.
 */
export default async function GroundPage({ params }: { params: ZoneParams }) {
  const locale = await getLocale();
  return (
    <Suspense fallback={<GroundLoadingShell locale={locale} />}>
      <GroundRoute params={params} locale={locale} />
    </Suspense>
  );
}

async function GroundRoute({ params, locale }: { params: ZoneParams; locale: Locale }) {
  const { zoneId } = await params;
  return <GroundView zoneId={zoneId} locale={locale} />;
}

function GroundLoadingShell({ locale }: { locale: Locale }) {
  return (
    <div className="flex h-[calc(100dvh-var(--spacing-header))] items-center justify-center bg-ink">
      <p className="type-small text-paper">{t(translations.groundView.loading, locale)}</p>
    </div>
  );
}
