"use client";

import { useMemo } from "react";
import {
  ButtonLink,
  formatCitationDate,
  formatStatNumber,
  SectionLabel,
  SeverityBadge,
  SourceCitation,
} from "@/app/components";
import { useMapData } from "@/app/map/_lib/useMapData";
import { dateRangeOfEvents, zoneStatus } from "@/app/map/_lib/severity";
import { format, t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import type { ZoneFeature } from "@/lib/types";

type HeroProps = {
  locale: Locale;
};

/**
 * Splits a headline string around its literal "404" and "200" tokens so
 * they can carry their own styling (struck-through mono / ok-accent)
 * regardless of locale. Both tokens are kept as Latin digits in both
 * languages (translations.ts: literal brand/code tokens, not translated
 * prose), so this split works the same way on either string.
 */
function renderHeadline(text: string) {
  const [before404, after404] = text.split("404");
  const [between, after200] = after404.split("200");
  return (
    <>
      {before404}
      <span className="font-mono text-ink-subtle decoration-2 line-through">
        404
      </span>
      {between}
      <span className="text-ok">200</span>
      {after200}
    </>
  );
}

/**
 * Hero (DESIGN_SPEC.md 7a#1). Columns 9-12 replace an illustration with a
 * live reading of the same data the map runs on: /api/zones and
 * /api/change-events, through the same zoneStatus()/dateRangeOfEvents()
 * helpers app/map/_lib/severity.ts already defines, so this can never
 * disagree with what /map itself shows for "current" severity.
 *
 * `locale` is resolved once in app/page.tsx (a server component) and
 * passed down, since this is a Client Component (it fetches its own data)
 * and must not call cookies() itself.
 */
export function Hero({ locale }: HeroProps) {
  const { zones, events, loading, error } = useMapData(locale);
  const copy = translations.hero;

  const dateWindow = useMemo(
    () => (events.length ? dateRangeOfEvents(events) : null),
    [events],
  );

  const grouped = useMemo(() => {
    if (!zones) return null;
    return {
      erosion: zones.features.filter((f) => f.properties.kind === "erosion"),
      landslide: zones.features.filter((f) => f.properties.kind === "landslide"),
    };
  }, [zones]);

  const statusByZoneId = useMemo(() => {
    const map = new Map<string, ReturnType<typeof zoneStatus>>();
    if (!zones || !dateWindow) return map;
    zones.features.forEach((feature) => {
      map.set(feature.properties.id, zoneStatus(events, feature.properties.id, dateWindow));
    });
    return map;
  }, [zones, events, dateWindow]);

  const severeCount = useMemo(() => {
    let count = 0;
    statusByZoneId.forEach((status) => {
      if (status.band === "severe") count += 1;
    });
    return count;
  }, [statusByZoneId]);

  const latestEvent = useMemo(() => {
    if (!events.length) return null;
    return events.reduce((latest, event) =>
      event.dateRangeEnd > latest.dateRangeEnd ? event : latest,
    );
  }, [events]);

  const totalZones = zones?.features.length ?? 0;

  const zonesLabel = loading
    ? t(copy.sectionLabelLoading, locale)
    : error
      ? t(copy.sectionLabelError, locale)
      : format(t(copy.sectionLabelTracking, locale), {
          count: formatStatNumber(totalZones, { grouping: false, locale }),
        });

  const mobileSummary =
    format(t(copy.mobileSummaryZonesTracked, locale), {
      count: formatStatNumber(totalZones, { grouping: false, locale }),
    }) +
    (severeCount
      ? format(t(copy.mobileSummarySevereSuffix, locale), {
          count: formatStatNumber(severeCount, { grouping: false, locale }),
        })
      : "");

  return (
    <section className="frame flex flex-col pt-12 sm:pt-section-tight">
      <div className="grid grid-cols-4 gap-x-gutter gap-y-10 sm:grid-cols-12">
        <div className="col-span-4 flex flex-col gap-6 sm:col-span-8">
          <h1 className="type-display">{renderHeadline(t(copy.headline, locale))}</h1>
          <p className="type-lede max-w-column text-ink-muted">{t(copy.subhead, locale)}</p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <ButtonLink href="/map" size="lg">
              {t(copy.ctaPrimary, locale)}
            </ButtonLink>
            <ButtonLink href="#alerts" variant="secondary" size="lg">
              {t(copy.ctaSecondary, locale)}
            </ButtonLink>
          </div>
        </div>

        <div className="col-span-4 flex flex-col gap-5 sm:col-span-4 sm:col-start-9">
          <SectionLabel>{zonesLabel}</SectionLabel>

          {grouped && (
            <>
              <div className="hidden flex-col gap-5 sm:flex">
                <ZoneGroup
                  title={t(copy.zoneGroupJamuna, locale)}
                  zones={grouped.erosion}
                  statusByZoneId={statusByZoneId}
                  locale={locale}
                  noDataLabel={t(copy.noData, locale)}
                />
                <ZoneGroup
                  title={t(copy.zoneGroupHillTracts, locale)}
                  zones={grouped.landslide}
                  statusByZoneId={statusByZoneId}
                  locale={locale}
                  noDataLabel={t(copy.noData, locale)}
                />
              </div>
              <p className="type-small text-ink-muted sm:hidden">{mobileSummary}</p>
            </>
          )}

          {latestEvent && (
            <div className="hidden sm:block">
              <SourceCitation
                source={latestEvent.sourceScene}
                date={latestEvent.dateRangeEnd}
                lang={locale}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 border-t border-ink pt-3 sm:mt-16">
        <p className="type-meta text-ink-subtle">
          {t(copy.datelineJamuna, locale)} <span aria-hidden="true">·</span>{" "}
          {t(copy.datelineHillTracts, locale)} <span aria-hidden="true">·</span>{" "}
          {format(t(copy.datelineLatestPass, locale), {
            date: latestEvent
              ? formatCitationDate(latestEvent.dateRangeEnd)
              : t(copy.datelineLoading, locale),
          })}
        </p>
      </div>
    </section>
  );
}

function ZoneGroup({
  title,
  zones,
  statusByZoneId,
  locale,
  noDataLabel,
}: {
  title: string;
  zones: ZoneFeature[];
  statusByZoneId: Map<string, ReturnType<typeof zoneStatus>>;
  locale: Locale;
  noDataLabel: string;
}) {
  return (
    <div>
      <p className="type-small font-medium text-ink">{title}</p>
      <ul className="mt-2 flex flex-col">
        {zones.map((zone) => {
          const status = statusByZoneId.get(zone.properties.id);
          return (
            <li
              key={zone.properties.id}
              className="flex items-center justify-between gap-3 border-t border-rule py-1.5 first:border-t-0"
            >
              <span className="type-small text-ink-muted">{zone.properties.upazila}</span>
              {status && status.band !== "nodata" ? (
                <SeverityBadge band={status.band} lang={locale} />
              ) : (
                <span className="type-meta text-ink-subtle">{noDataLabel}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
