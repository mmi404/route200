"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ZoneFeature } from "@/lib/types";
import { MAP_STYLE, prefersReducedMotion } from "@/lib/design-tokens";
import { useMapData } from "../_lib/useMapData";
import {
  BAND_RANK,
  dateRangeOfEvents,
  zoneEventHistory,
  zoneFeaturesBounds,
  zoneStatus,
  type DateWindow,
  type KindFilter,
  type ZoneListEntry,
  type ZoneStatus,
} from "../_lib/severity";
import {
  MapCanvas,
  type CameraTarget,
  type MapCanvasHandle,
  type StyledZoneFeatureCollection,
} from "./MapCanvas";
import { FloatingControls } from "./FloatingControls";
import { ZoneRail } from "./ZoneRail";
import { MobileSheet, type SheetSnap } from "./MobileSheet";

type SeverityCounts = Partial<Record<"low" | "moderate" | "high" | "severe", number>>;

/** Named camera views from the landing page's map teaser handoff
 *  (DESIGN_SPEC.md 7a: "/map?view=hill-tracts"). */
const VIEW_PARAMS: Record<string, { center: [number, number]; zoom: number }> = {
  jamuna: MAP_STYLE.jamunaView,
  "hill-tracts": MAP_STYLE.hillTractsView,
};

type MapExperienceProps = {
  initialView?: string;
  initialZoneId?: string;
};

export function MapExperience({ initialView, initialZoneId }: MapExperienceProps) {
  const { zones, events, loading, error } = useMapData();
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [selectedZoneId, setSelectedZoneId] = useState<string | null>(
    initialZoneId ?? null,
  );
  // The id of the zone selected via keyboard (Enter on a focused row), if
  // the current selection came from one. Drives autofocus into the inspect
  // panel below; a mouse selection leaves this null so focus isn't stolen
  // from someone who didn't ask for it.
  const [keyboardSelectedZoneId, setKeyboardSelectedZoneId] = useState<
    string | null
  >(null);
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null);
  // The user's own drag of the date slider, if any. Until they touch it,
  // the window simply tracks the full range of the loaded data (below),
  // so there is nothing to synchronize once that data arrives and no
  // effect needed to seed it.
  const [dateWindowOverride, setDateWindowOverride] = useState<DateWindow | null>(null);
  const [sheetSnap, setSheetSnap] = useState<SheetSnap>(
    initialZoneId ? "half" : "peek",
  );
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());

  const mapCanvasRef = useRef<MapCanvasHandle | null>(null);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const dataRange = useMemo(
    () => (events.length ? dateRangeOfEvents(events) : null),
    [events],
  );
  const dateWindow = dateWindowOverride ?? dataRange;

  // A deep-linked zone that doesn't match any loaded zone simply renders as
  // "no zone selected" below (selectedZone resolves to null), so there is
  // nothing to clear here.

  const zonesById = useMemo(() => {
    const map = new Map<string, ZoneFeature>();
    zones?.features.forEach((feature) => map.set(feature.properties.id, feature));
    return map;
  }, [zones]);

  const statusByZoneId = useMemo(() => {
    const map = new Map<string, ZoneStatus>();
    if (!zones || !dateWindow) return map;
    zones.features.forEach((feature) => {
      map.set(
        feature.properties.id,
        zoneStatus(events, feature.properties.id, dateWindow),
      );
    });
    return map;
  }, [zones, events, dateWindow]);

  const filteredFeatures = useMemo(() => {
    if (!zones) return [];
    return zones.features.filter(
      (feature) => kindFilter === "all" || feature.properties.kind === kindFilter,
    );
  }, [zones, kindFilter]);

  const sortedEntries: ZoneListEntry[] = useMemo(() => {
    return filteredFeatures
      .map((feature) => ({
        feature,
        status: statusByZoneId.get(feature.properties.id) ?? { band: "nodata" as const },
      }))
      .sort((a, b) => {
        const rankDiff = BAND_RANK[b.status.band] - BAND_RANK[a.status.band];
        if (rankDiff !== 0) return rankDiff;
        const scoreDiff = (b.status.event?.severity ?? -1) - (a.status.event?.severity ?? -1);
        if (scoreDiff !== 0) return scoreDiff;
        return a.feature.properties.name.localeCompare(b.feature.properties.name);
      });
  }, [filteredFeatures, statusByZoneId]);

  const counts: SeverityCounts = useMemo(() => {
    const result: SeverityCounts = { low: 0, moderate: 0, high: 0, severe: 0 };
    sortedEntries.forEach(({ status }) => {
      if (status.band !== "nodata") {
        result[status.band] = (result[status.band] ?? 0) + 1;
      }
    });
    return result;
  }, [sortedEntries]);

  const styledZones: StyledZoneFeatureCollection | null = useMemo(() => {
    if (!zones) return null;
    return {
      type: "FeatureCollection",
      features: filteredFeatures.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          severity: statusByZoneId.get(feature.properties.id)?.event?.severity,
        },
      })),
    };
  }, [zones, filteredFeatures, statusByZoneId]);

  const freshness = useMemo(() => {
    if (!events.length) return null;
    return events.reduce(
      (latest, event) => (event.dateRangeEnd > latest ? event.dateRangeEnd : latest),
      events[0].dateRangeEnd,
    );
  }, [events]);

  const summary = useMemo(() => {
    const severeCount = counts.severe ?? 0;
    const zoneWord = sortedEntries.length === 1 ? "zone" : "zones";
    return `${sortedEntries.length} ${zoneWord} tracked${
      severeCount ? ` · ${severeCount} severe` : ""
    }`;
  }, [sortedEntries.length, counts.severe]);

  const selectedZone = selectedZoneId ? zonesById.get(selectedZoneId) ?? null : null;
  const selectedStatus = selectedZoneId
    ? statusByZoneId.get(selectedZoneId) ?? { band: "nodata" as const }
    : null;
  const selectedHistory = useMemo(
    () => (selectedZoneId ? zoneEventHistory(events, selectedZoneId) : []),
    [events, selectedZoneId],
  );
  const selectedZoneCenter = selectedZone?.properties.center ?? null;

  const initialCamera = useMemo(() => {
    if (initialView && VIEW_PARAMS[initialView]) {
      return { kind: "point" as const, ...VIEW_PARAMS[initialView] };
    }
    return { kind: "bounds" as const, bounds: MAP_STYLE.allZonesBounds };
    // Deliberately only depends on the initial query param: this feeds the
    // map's one-time constructor camera. A deep-linked zone's camera is
    // instead applied by MapCanvas's selection effect once its center is
    // known, see MapCanvas.tsx.
  }, [initialView]);

  const handleSelectZone = useCallback((id: string, viaKeyboard?: boolean) => {
    setSelectedZoneId(id);
    setKeyboardSelectedZoneId(viaKeyboard ? id : null);
    setSheetSnap((prev) => (prev === "peek" ? "half" : prev));
  }, []);

  const handleBack = useCallback(() => setSelectedZoneId(null), []);

  // Reframe the camera to the zones the kind filter actually leaves on
  // screen, so switching filters while zoomed into one corridor can't leave
  // the canvas blank (e.g. flown into the Hill Tracts, then filtering to
  // "River erosion", whose zones are all in the Jamuna corridor). Computed
  // during render (React's documented "adjust state while rendering"
  // pattern, not an effect: https://react.dev/learn/you-might-not-need-an-effect)
  // so the initial mount (filter already matches its own default) doesn't
  // fly anywhere, and only an actual filter change triggers a move, with no
  // extra render-after-commit round trip.
  const [renderedKindFilter, setRenderedKindFilter] = useState(kindFilter);
  const [filterCamera, setFilterCamera] = useState<CameraTarget | null>(null);
  if (kindFilter !== renderedKindFilter) {
    setRenderedKindFilter(kindFilter);
    const bounds = zoneFeaturesBounds(filteredFeatures);
    setFilterCamera(bounds ? { kind: "bounds", bounds } : null);
  }

  if (error) {
    return (
      <div className="flex h-[calc(100dvh-var(--spacing-header))] flex-col items-center justify-center gap-2 bg-paper px-gutter text-center">
        <p className="type-small text-ink">Could not load zone data.</p>
        <p className="type-meta text-ink-subtle">{error}</p>
      </div>
    );
  }

  if (loading || !zones || !dateWindow || !styledZones) {
    return (
      <div className="flex h-[calc(100dvh-var(--spacing-header))] items-center justify-center bg-paper">
        <p className="type-small text-ink-subtle">Loading zone data…</p>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100dvh-var(--spacing-header))] flex-col">
      <div className="relative flex flex-1 overflow-hidden">
        <ZoneRail
          className="hidden lg:flex"
          freshness={freshness}
          kindFilter={kindFilter}
          onKindFilterChangeAction={setKindFilter}
          dataRange={dataRange ?? dateWindow}
          dateWindow={dateWindow}
          onDateWindowChangeAction={setDateWindowOverride}
          counts={counts}
          entries={sortedEntries}
          hoveredZoneId={hoveredZoneId}
          onHoverZoneAction={setHoveredZoneId}
          onSelectZoneAction={handleSelectZone}
          selectedZone={selectedZone}
          selectedStatus={selectedStatus}
          selectedHistory={selectedHistory}
          selectedZoneAutoFocus={
            selectedZoneId !== null && selectedZoneId === keyboardSelectedZoneId
          }
          onBackAction={handleBack}
        />
        <div className="relative flex-1">
          <MapCanvas
            ref={mapCanvasRef}
            zones={styledZones}
            selectedZoneId={selectedZoneId}
            selectedZoneCenter={selectedZoneCenter}
            hoveredZoneId={hoveredZoneId}
            onHoverZone={setHoveredZoneId}
            onSelectZone={handleSelectZone}
            initialCamera={initialCamera}
            externalCamera={filterCamera}
            reducedMotion={reducedMotion}
          />
          <FloatingControls
            onZoomInAction={() => mapCanvasRef.current?.zoomIn()}
            onZoomOutAction={() => mapCanvasRef.current?.zoomOut()}
          />
        </div>
      </div>
      <MobileSheet
        snap={sheetSnap}
        onSnapChangeAction={setSheetSnap}
        summary={summary}
        kindFilter={kindFilter}
        onKindFilterChangeAction={setKindFilter}
        dataRange={dataRange ?? dateWindow}
        dateWindow={dateWindow}
        onDateWindowChangeAction={setDateWindowOverride}
        counts={counts}
        entries={sortedEntries}
        hoveredZoneId={hoveredZoneId}
        onHoverZoneAction={setHoveredZoneId}
        onSelectZoneAction={handleSelectZone}
        selectedZone={selectedZone}
        selectedStatus={selectedStatus}
        selectedHistory={selectedHistory}
        selectedZoneAutoFocus={
          selectedZoneId !== null && selectedZoneId === keyboardSelectedZoneId
        }
        onBackAction={handleBack}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}
