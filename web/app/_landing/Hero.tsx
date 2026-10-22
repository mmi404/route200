"use client";

import { useMemo } from "react";
import {
  ButtonLink,
  formatCitationDate,
  SectionLabel,
  SeverityBadge,
  SourceCitation,
} from "@/app/components";
import { useMapData } from "@/app/map/_lib/useMapData";
import { dateRangeOfEvents, zoneStatus } from "@/app/map/_lib/severity";
import type { ZoneFeature } from "@/lib/types";

/**
 * Hero (DESIGN_SPEC.md 7a#1). Columns 9-12 replace an illustration with a
 * live reading of the same data the map runs on: /api/zones and
 * /api/change-events, through the same zoneStatus()/dateRangeOfEvents()
 * helpers app/map/_lib/severity.ts already defines, so this can never
 * disagree with what /map itself shows for "current" severity.
 */
export function Hero() {
  const { zones, events, loading, error } = useMapData();

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

  return (
    <section className="frame flex flex-col pt-12 sm:pt-section-tight">
      <div className="grid grid-cols-4 gap-x-gutter gap-y-10 sm:grid-cols-12">
        <div className="col-span-4 flex flex-col gap-6 sm:col-span-8">
          <h1 className="type-display">
            From{" "}
            <span className="font-mono text-ink-subtle decoration-2 line-through">
              404
            </span>{" "}
            to <span className="text-ok">200</span>: Bangladesh&apos;s climate data
            finally has a route to you.
          </h1>
          <p className="type-lede max-w-column text-ink-muted">
            Route200 turns satellite radar data into a warning that reaches your
            phone, not just a server.
          </p>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
            <ButtonLink href="/map" size="lg">
              See the risk map
            </ButtonLink>
            <ButtonLink href="#alerts" variant="secondary" size="lg">
              Get alerts for your area
            </ButtonLink>
          </div>
        </div>

        <div className="col-span-4 flex flex-col gap-5 sm:col-span-4 sm:col-start-9">
          <SectionLabel>
            {loading
              ? "Loading zone data"
              : error
                ? "Zone data unavailable"
                : `Tracking ${totalZones} zones`}
          </SectionLabel>

          {grouped && (
            <>
              <div className="hidden flex-col gap-5 sm:flex">
                <ZoneGroup title="Jamuna corridor" zones={grouped.erosion} statusByZoneId={statusByZoneId} />
                <ZoneGroup
                  title="Chattogram Hill Tracts"
                  zones={grouped.landslide}
                  statusByZoneId={statusByZoneId}
                />
              </div>
              <p className="type-small text-ink-muted sm:hidden">
                {totalZones} zones tracked
                {severeCount ? ` · ${severeCount} severe` : ""}
              </p>
            </>
          )}

          {latestEvent && (
            <div className="hidden sm:block">
              <SourceCitation source={latestEvent.sourceScene} date={latestEvent.dateRangeEnd} />
            </div>
          )}
        </div>
      </div>

      <div className="mt-12 border-t border-ink pt-3 sm:mt-16">
        <p className="type-meta text-ink-subtle">
          Jamuna corridor 24.4–25.3°N <span aria-hidden="true">·</span> Chattogram
          Hill Tracts 21.5–22.2°N <span aria-hidden="true">·</span> Latest pass{" "}
          {latestEvent ? formatCitationDate(latestEvent.dateRangeEnd) : "loading"}
        </p>
      </div>
    </section>
  );
}

function ZoneGroup({
  title,
  zones,
  statusByZoneId,
}: {
  title: string;
  zones: ZoneFeature[];
  statusByZoneId: Map<string, ReturnType<typeof zoneStatus>>;
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
                <SeverityBadge band={status.band} />
              ) : (
                <span className="type-meta text-ink-subtle">No data</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
