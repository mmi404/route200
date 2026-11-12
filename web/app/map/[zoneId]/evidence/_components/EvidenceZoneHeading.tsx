"use client";

import { ZONE_KIND_LABEL } from "@/lib/design-tokens";
import { t, zoneDisplayName } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import { useMapData } from "../../../_lib/useMapData";

type EvidenceZoneHeadingProps = {
  zoneId: string;
  locale: Locale;
};

/**
 * The evidence page's h1: the zone's real display name and place line,
 * from the same /api/zones data every other zone page uses (useMapData),
 * so the Bangla name and the district/kind labels can never disagree with
 * /map. The rest of the evidence page is server-rendered from the
 * manifest and does not wait on this.
 */
export function EvidenceZoneHeading({ zoneId, locale }: EvidenceZoneHeadingProps) {
  const { zones, loading, error } = useMapData(locale);
  const zone = zones?.features.find((feature) => feature.properties.id === zoneId) ?? null;

  if (error || (!loading && !zone)) {
    return (
      <>
        <h1 className="type-h1">{t(translations.zoneEvidence.title, locale)}</h1>
        <p className="type-meta text-ink-subtle">{error ?? " "}</p>
      </>
    );
  }

  if (!zone) {
    // Holds the heading's line height so nothing below jumps when the
    // name arrives.
    return (
      <>
        <h1 className="type-h1" aria-busy="true">
          <span className="text-ink-subtle">{t(translations.common.loadingZoneDataEllipsis, locale)}</span>
        </h1>
        <p className="type-meta text-ink-subtle">&nbsp;</p>
      </>
    );
  }

  return (
    <>
      <h1 className="type-h1">{zoneDisplayName(zone.properties, locale)}</h1>
      <p className="type-meta text-ink-subtle">
        {zone.properties.upazila}, {zone.properties.district} ·{" "}
        {ZONE_KIND_LABEL[locale][zone.properties.kind]}
      </p>
    </>
  );
}
