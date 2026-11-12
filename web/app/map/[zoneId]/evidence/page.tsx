import { Suspense } from "react";
import type { Metadata } from "next";
import { EvidenceReport } from "./_components/EvidenceReport";
import { EvidenceUnavailable } from "./_components/EvidenceUnavailable";
import { getEvidencePack } from "./_lib/packs";
import { getLocale, type Locale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { translations } from "@/lib/translations";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return {
    title: t(translations.zoneEvidence.title, locale),
  };
}

type ZoneParams = Promise<{ zoneId: string }>;

/**
 * Real satellite evidence for one zone: a Sentinel-1 before/after pair and
 * its difference map, the July 2026 event as radar passes plus daily
 * optical and rainfall tiles, and a clearly separated concept preview of
 * where a trained risk model would fit. Everything in the real sections
 * is read from the zone's public/evidence/<zone>/manifest.json (see
 * _lib/packs.ts). Only Teknaf has a pack so far; every other zone gets an
 * honest "not built yet" state instead of a 404 or made-up content.
 *
 * Same params-inside-Suspense pattern as /map/[zoneId]/page.tsx, for the
 * same Cache Components reason documented there.
 */
export default async function ZoneEvidencePage({ params }: { params: ZoneParams }) {
  const locale = await getLocale();
  return (
    <Suspense fallback={<EvidenceLoadingShell locale={locale} />}>
      <ZoneEvidenceRoute params={params} locale={locale} />
    </Suspense>
  );
}

async function ZoneEvidenceRoute({
  params,
  locale,
}: {
  params: ZoneParams;
  locale: Locale;
}) {
  const { zoneId } = await params;
  const pack = getEvidencePack(zoneId);
  return pack ? (
    <EvidenceReport zoneId={zoneId} pack={pack} locale={locale} />
  ) : (
    <EvidenceUnavailable zoneId={zoneId} locale={locale} />
  );
}

function EvidenceLoadingShell({ locale }: { locale: Locale }) {
  return (
    <main className="frame py-section-tight">
      <p className="type-small text-ink-subtle">{t(translations.zoneEvidence.loading, locale)}</p>
    </main>
  );
}
