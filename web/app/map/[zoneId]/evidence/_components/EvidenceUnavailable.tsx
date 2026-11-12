"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { ButtonLink, SectionLabel } from "@/app/components";
import { ZONE_KIND_LABEL } from "@/lib/design-tokens";
import { format, t, zoneDisplayName } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import { useMapData } from "../../../_lib/useMapData";
import { EVIDENCE_ZONE_IDS } from "../_lib/available";

type EvidenceUnavailableProps = {
  zoneId: string;
  locale: Locale;
};

/**
 * Every zone without an evidence pack lands here: its real name from
 * /api/zones and a plain statement that nothing has been built for it
 * yet, with a way back to the map and over to a zone that does have one.
 * No placeholder imagery, no borrowed numbers from another zone.
 */
export function EvidenceUnavailable({ zoneId, locale }: EvidenceUnavailableProps) {
  const { zones, loading, error } = useMapData(locale);
  const copy = translations.zoneEvidence;

  if (error) {
    return (
      <UnavailableFrame locale={locale}>
        <p className="type-small text-ink-muted">{error}</p>
      </UnavailableFrame>
    );
  }

  if (loading || !zones) {
    return (
      <UnavailableFrame locale={locale}>
        <p className="type-small text-ink-subtle">{t(translations.common.loadingZoneDataEllipsis, locale)}</p>
      </UnavailableFrame>
    );
  }

  const zone = zones.features.find((feature) => feature.properties.id === zoneId);
  if (!zone) {
    return (
      <UnavailableFrame locale={locale}>
        <h1 className="type-h2">{t(translations.zoneExplore.notFoundHeading, locale)}</h1>
      </UnavailableFrame>
    );
  }

  const name = zoneDisplayName(zone.properties, locale);
  const withPack = zones.features.find(
    (feature) => feature.properties.id === EVIDENCE_ZONE_IDS[0],
  );

  return (
    <UnavailableFrame locale={locale} zoneId={zoneId}>
      <h1 className="type-h1">{name}</h1>
      <p className="type-meta text-ink-subtle">
        {zone.properties.upazila}, {zone.properties.district} ·{" "}
        {ZONE_KIND_LABEL[locale][zone.properties.kind]}
      </p>
      <div className="flex max-w-column flex-col gap-4 border-t-2 border-ink pt-4">
        <h2 className="type-h3">{t(copy.unavailableHeading, locale)}</h2>
        <p className="type-body text-ink-muted">
          {format(t(copy.unavailableBody, locale), { name })}
        </p>
      </div>
      {withPack && (
        <div>
          <ButtonLink href={`/map/${withPack.properties.id}/evidence`} variant="secondary">
            {format(t(copy.unavailableSeeOther, locale), {
              name: zoneDisplayName(withPack.properties, locale),
            })}
          </ButtonLink>
        </div>
      )}
    </UnavailableFrame>
  );
}

function UnavailableFrame({
  locale,
  zoneId,
  children,
}: {
  locale: Locale;
  zoneId?: string;
  children: ReactNode;
}) {
  return (
    <main className="frame flex flex-col gap-6 py-section-tight">
      <Link
        href={zoneId ? `/map?zone=${zoneId}` : "/map"}
        className="type-small self-start text-ink-muted hover:text-river"
      >
        {t(translations.zoneExplore.backToMap, locale)}
      </Link>
      <SectionLabel>{t(translations.zoneEvidence.title, locale)}</SectionLabel>
      {children}
    </main>
  );
}
