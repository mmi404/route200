"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { SeverityBadge, SourceCitation } from "@/app/components";
import { ZONE_KIND_LABEL, prefersReducedMotion } from "@/lib/design-tokens";
import { format, t, zoneDisplayName } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import type { ChangeEvent } from "@/lib/types";
import { useMapData } from "../../_lib/useMapData";
import { isoToDayIndex, zoneEventHistory } from "../../_lib/severity";
import { TerrainCanvas } from "./TerrainCanvas";
import { ExploreScrubber } from "./ExploreScrubber";

type ZoneExploreProps = {
  zoneId: string;
  locale: Locale;
};

/**
 * Client orchestrator for the /map/[zoneId] 3D terrain page. Fetches the
 * same /api/zones + /api/change-events data the 2D map uses (useMapData,
 * shared), finds the one zone this route is for, and drives the scrub
 * slider's "which recorded state is current" logic. TerrainCanvas owns the
 * actual MapLibre instance; this component only ever hands it a zone
 * feature and a severity number, the same shape the 2D map's styled
 * features already carry (MapCanvas.tsx's StyledZoneProperties).
 */
export function ZoneExplore({ zoneId, locale }: ZoneExploreProps) {
  const { zones, events, loading, error } = useMapData(locale);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const zone = zones?.features.find((feature) => feature.properties.id === zoneId) ?? null;
  const history = useMemo(() => zoneEventHistory(events, zoneId), [events, zoneId]);

  // Opens on the zone's most recently recorded state ("now"), not its
  // oldest, so the scrub slider starts at the end of the track, not the
  // start.
  const defaultDay = history.length
    ? isoToDayIndex(history[history.length - 1].dateRangeEnd)
    : isoToDayIndex(new Date().toISOString().slice(0, 10));
  const day = selectedDay ?? defaultDay;

  // The most recent event whose observed range ended at or before the
  // scrubbed day. Before the first recorded event there is nothing to
  // show yet, which renders as the same "nodata" state the 2D map uses
  // for the same reason: not observed, not "low".
  const currentEvent: ChangeEvent | undefined = useMemo(() => {
    let latest: ChangeEvent | undefined;
    for (const event of history) {
      if (isoToDayIndex(event.dateRangeEnd) > day) continue;
      if (!latest || event.dateRangeEnd > latest.dateRangeEnd) latest = event;
    }
    return latest;
  }, [history, day]);

  if (error) {
    return (
      <ExploreMessage locale={locale}>
        <p className="type-small text-paper">{error}</p>
      </ExploreMessage>
    );
  }

  // page.tsx's own <Suspense> fallback already covers the very first load;
  // this just avoids a flash of the not-found message while data is still
  // in flight.
  if (loading || !zones) return null;

  if (!zone) {
    return (
      <ExploreMessage locale={locale}>
        <p className="type-small text-paper">
          {t(translations.zoneExplore.notFoundHeading, locale)}
        </p>
      </ExploreMessage>
    );
  }

  const name = zoneDisplayName(zone.properties, locale);
  const kindLabel = ZONE_KIND_LABEL[locale][zone.properties.kind];

  return (
    <div className="relative h-[calc(100dvh-var(--spacing-header))] overflow-hidden bg-ink">
      <TerrainCanvas
        zone={zone}
        severity={currentEvent?.severity}
        reducedMotion={reducedMotion}
      />

      <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-col gap-2 rounded-xs bg-surface/95 px-4 py-3 shadow-map">
        <Link href="/map" className="type-small self-start text-ink-muted hover:text-river">
          {t(translations.zoneExplore.backToMap, locale)}
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="type-h3">{name}</h1>
          {currentEvent ? (
            <SeverityBadge score={currentEvent.severity} showScore lang={locale} />
          ) : (
            <span className="type-meta inline-flex h-6 items-center gap-2 rounded-xs bg-nodata px-2 font-medium text-ink">
              {t(translations.common.noData, locale)}
            </span>
          )}
        </div>
        <p className="type-meta text-ink-subtle">
          {zone.properties.upazila}, {zone.properties.district} · {kindLabel}
        </p>
      </div>

      <div className="absolute inset-x-4 bottom-4 z-10 flex flex-col gap-3 rounded-xs bg-surface/95 px-4 py-4 shadow-map sm:inset-x-4 sm:mx-auto sm:max-w-xl">
        <p className="type-small text-ink-muted">
          {format(t(translations.zoneExplore.flyoverCaption, locale), { name })}
        </p>

        {history.length === 0 ? (
          <p className="type-meta text-ink-subtle">
            {t(translations.zoneExplore.noHistory, locale)}
          </p>
        ) : (
          <ExploreScrubber
            locale={locale}
            history={history}
            day={day}
            onChangeAction={setSelectedDay}
          />
        )}

        {currentEvent && (
          <SourceCitation
            source={currentEvent.sourceScene}
            date={currentEvent.dateRangeStart}
            dateEnd={currentEvent.dateRangeEnd}
            lang={locale}
          />
        )}
      </div>
    </div>
  );
}

function ExploreMessage({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-var(--spacing-header))] flex-col items-center justify-center gap-4 bg-ink px-gutter text-center">
      {children}
      <Link href="/map" className="type-small text-paper underline">
        {t(translations.zoneExplore.backToMap, locale)}
      </Link>
    </div>
  );
}
