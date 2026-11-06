"use client";

import { useEffect, useRef } from "react";
import * as maplibregl from "maplibre-gl";
import type { AddLayerObject, Map as MapInstance } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { ZoneFeature, ZoneProperties } from "@/lib/types";
import { MAP_STYLE, MOTION, severityColorExpression } from "@/lib/design-tokens";
// Importing this also runs MapCanvas.tsx's module-level
// maplibregl.setWorkerUrl() fix (see that file's own comment): without it
// Turbopack's dev bundler cannot resolve maplibre-gl's tile worker and the
// map never paints. Both map-owning components need the same fix, so it
// is one shared source rather than a second copy of the workaround.
import { quietBasemap } from "../../_components/MapCanvas";

/** A zone feature plus the severity to drape on it, mirroring MapCanvas's
 *  own StyledZoneProperties shape so both map components agree on what
 *  "a zone with a severity for right now" looks like. */
interface DrapedZoneProperties extends ZoneProperties {
  severity?: number;
}
interface DrapedZoneFeature extends Omit<ZoneFeature, "properties"> {
  properties: DrapedZoneProperties;
}

type TerrainCanvasProps = {
  zone: ZoneFeature;
  /** Undefined renders the same "not yet observed" color
   *  severityColorExpression() gives the 2D map for a nodata zone. */
  severity?: number;
  reducedMotion: boolean;
};

type SourceSpec = Parameters<MapInstance["addSource"]>[1];

const DEM_SOURCE_ID = "explore-terrain-dem";
const ZONE_SOURCE_ID = "explore-zone";
const DRAPE_LAYER_ID = "explore-zone-drape";
const OUTLINE_LAYER_ID = "explore-zone-outline";
const HILLSHADE_LAYER_ID = "explore-hillshade";

// AWS Open Data "Terrain Tiles" (elevation-tiles-prod), Terrarium PNG
// encoding, CC-BY 4.0. Free, no API key, same "no key needed" posture as
// the OpenFreeMap basemap (PROGRESS.md, "Phase 2" decisions log).
const TERRAIN_TILE_URL =
  "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png";
const TERRAIN_ATTRIBUTION =
  '<a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener noreferrer">Terrain tiles, AWS Open Data (CC-BY 4.0)</a>';
const TERRAIN_EXAGGERATION = 1.3;
/** Degrees of bearing drift per animation frame, roughly 3 deg/s at 60fps:
 *  slow enough to read as "looking around a place", not a spin. */
const DRIFT_DEG_PER_SECOND = 3;

function drapedFeature(zone: ZoneFeature, severity: number | undefined): DrapedZoneFeature {
  return { ...zone, properties: { ...zone.properties, severity } };
}

/**
 * The 3D terrain instance for /map/[zoneId] (PROGRESS.md, "Phase 2: 3D
 * terrain explore", M10). A second, separate MapLibre instance from the
 * 2D map's MapCanvas.tsx: same basemap, same severity color expression,
 * same design tokens, but with real terrain and a single zone's drape
 * instead of all twelve zones flat. Kept separate rather than extending
 * MapCanvas with a "terrain mode" flag, since the two have little in
 * common beyond styling (no hover/selection/kind-filter state here, a
 * fixed one-zone source instead of the full zones collection, and a
 * continuously drifting camera the 2D map never needs).
 */
export function TerrainCanvas({ zone, severity, reducedMotion }: TerrainCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapInstance | null>(null);
  const loadedRef = useRef(false);
  const zoneRef = useRef(zone);
  const severityRef = useRef(severity);
  const driftFrameRef = useRef<number | null>(null);
  const driftPausedRef = useRef(false);
  const lastFrameTimeRef = useRef<number | null>(null);

  // Kept current via an effect (not a render-time assignment) so the
  // one-time 'load' handler below can read whichever zone/severity was
  // most recent by the time tiles actually finish loading, however many
  // re-renders that took.
  useEffect(() => {
    zoneRef.current = zone;
    severityRef.current = severity;
  }, [zone, severity]);

  // Created once per mount, same posture as MapCanvas.tsx's own main
  // effect: this route is dedicated to a single zone, so a different zone
  // id means a different page visit (a fresh mount), not a prop update to
  // react to here. Severity updates flow through the second effect below
  // via setData, without recreating the map.
  useEffect(() => {
    if (!containerRef.current) return;
    const { lat, lng } = zone.properties.center;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: MAP_STYLE.baseStyleUrl,
      attributionControl: { compact: true },
      center: [lng, lat],
      zoom: 13.2,
      pitch: 66,
      bearing: 0,
      maxPitch: 80,
    });
    mapRef.current = map;

    function stepDrift(now: number) {
      if (lastFrameTimeRef.current === null) lastFrameTimeRef.current = now;
      const deltaSeconds = (now - lastFrameTimeRef.current) / 1000;
      lastFrameTimeRef.current = now;
      if (!driftPausedRef.current) {
        map.setBearing((map.getBearing() + DRIFT_DEG_PER_SECOND * deltaSeconds) % 360);
      }
      driftFrameRef.current = requestAnimationFrame(stepDrift);
    }

    function startDrift() {
      if (reducedMotion || driftFrameRef.current !== null) return;
      driftFrameRef.current = requestAnimationFrame(stepDrift);
    }

    // Pausing on user interaction (rather than fighting the drag/rotate
    // gesture with a competing setBearing call every frame) and resuming
    // shortly after release keeps manual looking-around and the idle
    // drift from ever fighting each other.
    function pauseDrift() {
      driftPausedRef.current = true;
    }
    function resumeDriftSoon() {
      window.setTimeout(() => {
        driftPausedRef.current = false;
      }, 1200);
    }

    map.on("load", () => {
      quietBasemap(map);

      map.addSource(DEM_SOURCE_ID, {
        type: "raster-dem",
        tiles: [TERRAIN_TILE_URL],
        tileSize: 256,
        encoding: "terrarium",
        maxzoom: 15,
        attribution: TERRAIN_ATTRIBUTION,
      } as SourceSpec);

      map.setTerrain({ source: DEM_SOURCE_ID, exaggeration: TERRAIN_EXAGGERATION });

      const firstNonBackgroundId = map
        .getStyle()
        ?.layers?.find((layer) => layer.type !== "background")?.id;
      map.addLayer(
        {
          id: HILLSHADE_LAYER_ID,
          type: "hillshade",
          source: DEM_SOURCE_ID,
          paint: {
            "hillshade-exaggeration": 0.5,
            "hillshade-shadow-color": "#2a2420",
          },
        } as unknown as AddLayerObject,
        firstNonBackgroundId,
      );

      map.addSource(ZONE_SOURCE_ID, {
        type: "geojson",
        data: drapedFeature(
          zoneRef.current,
          severityRef.current,
        ) as unknown as GeoJSON.GeoJSON,
      });

      const fadeMs = reducedMotion ? 0 : MOTION.mapCrossfadeMs;
      map.addLayer({
        id: DRAPE_LAYER_ID,
        type: "fill",
        source: ZONE_SOURCE_ID,
        paint: {
          "fill-color": severityColorExpression(),
          "fill-opacity": 0.62,
          "fill-opacity-transition": { duration: fadeMs, delay: 0 },
          "fill-color-transition": { duration: fadeMs, delay: 0 },
        },
      } as unknown as AddLayerObject);

      map.addLayer({
        id: OUTLINE_LAYER_ID,
        type: "line",
        source: ZONE_SOURCE_ID,
        paint: {
          "line-color": severityColorExpression(),
          "line-width": 2.5,
          "line-color-transition": { duration: fadeMs, delay: 0 },
        },
      } as unknown as AddLayerObject);

      loadedRef.current = true;
      startDrift();
    });

    map.on("dragstart", pauseDrift);
    map.on("rotatestart", pauseDrift);
    map.on("zoomstart", pauseDrift);
    map.on("dragend", resumeDriftSoon);
    map.on("rotateend", resumeDriftSoon);
    map.on("zoomend", resumeDriftSoon);

    return () => {
      if (driftFrameRef.current !== null) cancelAnimationFrame(driftFrameRef.current);
      map.remove();
      mapRef.current = null;
      loadedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally created once per mount; see the comment above the effect.
  }, []);

  // Keep the drape's severity in sync without recreating the map or its
  // terrain/hillshade sources.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !loadedRef.current) return;
    const source = map.getSource(ZONE_SOURCE_ID);
    if (source && "setData" in source) {
      (source as maplibregl.GeoJSONSource).setData(
        drapedFeature(zone, severity) as unknown as GeoJSON.GeoJSON,
      );
    }
  }, [zone, severity]);

  return <div ref={containerRef} className="h-full w-full" />;
}
