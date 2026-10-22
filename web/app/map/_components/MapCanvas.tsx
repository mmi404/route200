"use client";

import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import * as maplibregl from "maplibre-gl";
import type { AddLayerObject, Map as MapInstance } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { SEVERITY_BANDS } from "@/lib/types";
import type { ZoneFeature, ZoneProperties } from "@/lib/types";
import { MAP_STYLE, MOTION, PALETTE, severityColorExpression } from "@/lib/design-tokens";

// maplibre-gl constructs its tile-parsing worker from a path relative to
// its own module location. Under Next.js/Turbopack that relative URL does
// not resolve to a servable file (the worker fails to load and the map
// never paints), so this points it at a static copy instead. That copy is
// kept in sync with the installed version by the "postinstall" script in
// package.json, which runs on every `npm install`.
if (typeof window !== "undefined") {
  maplibregl.setWorkerUrl("/maplibre-gl-worker.mjs");
}

/** A rendered zone feature plus the severity the current date window
 *  resolved for it. `severity` is absent for a "nodata" zone, which the
 *  color expression (lib/design-tokens.ts) already renders in PALETTE.nodata. */
export interface StyledZoneProperties extends ZoneProperties {
  severity?: number;
}
export interface StyledZoneFeature extends Omit<ZoneFeature, "properties"> {
  properties: StyledZoneProperties;
}
export interface StyledZoneFeatureCollection {
  type: "FeatureCollection";
  features: StyledZoneFeature[];
}

export type CameraTarget =
  | { kind: "bounds"; bounds: [[number, number], [number, number]] }
  | { kind: "point"; center: [number, number]; zoom: number };

export interface MapCanvasHandle {
  zoomIn: () => void;
  zoomOut: () => void;
}

type MapCanvasProps = {
  zones: StyledZoneFeatureCollection;
  selectedZoneId?: string | null;
  selectedZoneCenter?: { lat: number; lng: number } | null;
  hoveredZoneId?: string | null;
  onHoverZone?: (id: string | null) => void;
  onSelectZone?: (id: string) => void;
  initialCamera: CameraTarget;
  reducedMotion: boolean;
  /**
   * False for the landing page's map teaser (DESIGN_SPEC.md 7a#4): no
   * scroll-zoom, drag, click or hover handling, so the page scrolls
   * normally over the map instead of the map capturing the gesture. The
   * camera is then driven externally via `externalCamera` rather than by
   * zone selection. Defaults to true (the full /map experience).
   */
  interactive?: boolean;
  /**
   * Non-interactive mode only: whenever this changes, the camera flies (or
   * jumps, under reduced motion) here, independent of zone selection. Used
   * by the map teaser's scroll-driven camera handoff between corridor
   * views. Ignored once `interactive` is true.
   */
  externalCamera?: CameraTarget | null;
};

const SOURCE_ID = "zones";
const FILL_LAYER_ID = "zones-fill";
const EROSION_LINE_LAYER_ID = "zones-line-erosion";
const LANDSLIDE_LINE_LAYER_ID = "zones-line-landslide";
const LABEL_LAYER_ID = "zones-label";
const SELECTED_LAYER_ID = "zones-selected";

// Types the maplibre-gl package itself doesn't export at the top level
// (they live in its private style-spec dependency). Deriving them from the
// methods that use them keeps this exact without importing that package
// directly.
type SourceSpec = Parameters<MapInstance["addSource"]>[1];
type FilterExpr = Parameters<MapInstance["setFilter"]>[1];
type FeatureRef = Parameters<MapInstance["setFeatureState"]>[0];

/** Numeric line-width-by-band expression, same cut points and shape as
 *  severityColorExpression() in lib/design-tokens.ts, but returning the
 *  stroke widths instead of fill colors (severe reads heavier, not just
 *  darker, per DESIGN_SPEC.md). */
function severityLineWidthExpression(): unknown[] {
  const value = ["to-number", ["get", "severity"]];
  const branches: unknown[] = [];
  SEVERITY_BANDS.slice(0, -1).forEach((definition) => {
    branches.push(["<=", value, definition.max], MAP_STYLE.lineWidth[definition.band]);
  });
  const last = SEVERITY_BANDS[SEVERITY_BANDS.length - 1];
  return [
    "case",
    ["!", ["has", "severity"]],
    MAP_STYLE.lineWidth.low,
    ...branches,
    MAP_STYLE.lineWidth[last.band],
  ];
}

/** Quiets the OpenFreeMap liberty basemap after it loads: paper background,
 *  muted water, POI labels off (DESIGN_SPEC.md 7b). Matches by layer type
 *  and id pattern rather than hardcoded liberty layer ids, so it keeps
 *  working if the upstream style is revised. */
function quietBasemap(map: MapInstance) {
  const layers = map.getStyle()?.layers ?? [];
  layers.forEach((layer) => {
    if (layer.type === "background") {
      map.setPaintProperty(layer.id, "background-color", MAP_STYLE.background);
    } else if (layer.type === "fill" && /water/i.test(layer.id)) {
      map.setPaintProperty(layer.id, "fill-color", MAP_STYLE.water);
    } else if (layer.type === "symbol" && /poi/i.test(layer.id)) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  });
}

function addZoneLayers(map: MapInstance, reducedMotion: boolean) {
  const source: SourceSpec = {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
    promoteId: "id",
  };
  map.addSource(SOURCE_ID, source);

  const fadeMs = reducedMotion ? 0 : MOTION.mapCrossfadeMs;

  map.addLayer({
    id: FILL_LAYER_ID,
    type: "fill",
    source: SOURCE_ID,
    paint: {
      "fill-color": severityColorExpression(),
      "fill-opacity": [
        "case",
        ["boolean", ["feature-state", "hover"], false],
        MAP_STYLE.fillOpacityHover,
        MAP_STYLE.fillOpacity,
      ],
      "fill-opacity-transition": { duration: fadeMs, delay: 0 },
    },
  } as unknown as AddLayerObject);

  map.addLayer({
    id: EROSION_LINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "kind"], "erosion"],
    paint: {
      "line-color": severityColorExpression(),
      "line-width": severityLineWidthExpression(),
      "line-color-transition": { duration: fadeMs, delay: 0 },
    },
  } as unknown as AddLayerObject);

  map.addLayer({
    id: LANDSLIDE_LINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "kind"], "landslide"],
    paint: {
      "line-color": severityColorExpression(),
      "line-width": severityLineWidthExpression(),
      "line-dasharray": MAP_STYLE.lineDash.landslide ?? [2, 1.5],
      "line-color-transition": { duration: fadeMs, delay: 0 },
    },
  } as unknown as AddLayerObject);

  map.addLayer({
    id: SELECTED_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["get", "id"], "__none__"],
    paint: {
      "line-color": MAP_STYLE.selectedLine,
      "line-width": MAP_STYLE.selectedLineWidth,
    },
  } as unknown as AddLayerObject);

  // Zone labels drawn on the canvas are Latin-only (MapLibre's GL renderer
  // cannot shape Bengali glyphs): `name` in the mock data is already Latin
  // script. Bangla zone names belong only in the rail/panel HTML.
  map.addLayer({
    id: LABEL_LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    layout: {
      "text-field": ["get", "name"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 12,
      "symbol-placement": "point",
    },
    paint: {
      "text-color": PALETTE.ink,
      "text-halo-color": MAP_STYLE.labelHalo,
      "text-halo-width": 1.4,
    },
  } as unknown as AddLayerObject);
}

function applySelectedFilter(map: MapInstance, id: string | null) {
  if (!map.getLayer(SELECTED_LAYER_ID)) return;
  const filter: FilterExpr = ["==", ["get", "id"], id ?? "__none__"];
  map.setFilter(SELECTED_LAYER_ID, filter);
}

export const MapCanvas = forwardRef<MapCanvasHandle, MapCanvasProps>(
  function MapCanvas(
    {
      zones,
      selectedZoneId = null,
      selectedZoneCenter = null,
      hoveredZoneId = null,
      onHoverZone,
      onSelectZone,
      initialCamera,
      reducedMotion,
      interactive = true,
      externalCamera = null,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const mapRef = useRef<MapInstance | null>(null);
    const loadedRef = useRef(false);
    const zonesRef = useRef(zones);
    const hoveredRef = useRef<string | null>(null);
    const firstSelectionSyncRef = useRef(true);
    const lastExternalCameraRef = useRef<string | null>(null);

    zonesRef.current = zones;

    useImperativeHandle(
      ref,
      () => ({
        zoomIn: () => mapRef.current?.zoomIn({ duration: reducedMotion ? 0 : MOTION.fastMs }),
        zoomOut: () => mapRef.current?.zoomOut({ duration: reducedMotion ? 0 : MOTION.fastMs }),
      }),
      [reducedMotion],
    );

    // Created once. Data, selection and hover are kept in sync by the
    // effects below rather than by recreating the map.
    useEffect(() => {
      if (!containerRef.current) return;

      const map = new maplibregl.Map({
        container: containerRef.current,
        style: MAP_STYLE.baseStyleUrl,
        attributionControl: { compact: true },
        ...(initialCamera.kind === "bounds"
          ? { bounds: initialCamera.bounds, fitBoundsOptions: { padding: 48 } }
          : { center: initialCamera.center, zoom: initialCamera.zoom }),
      });
      mapRef.current = map;

      if (!interactive) {
        map.scrollZoom.disable();
        map.boxZoom.disable();
        map.dragRotate.disable();
        map.dragPan.disable();
        map.keyboard.disable();
        map.doubleClickZoom.disable();
        map.touchZoomRotate.disable();
      }

      map.on("load", () => {
        quietBasemap(map);
        addZoneLayers(map, reducedMotion);
        const source = map.getSource(SOURCE_ID);
        if (source && "setData" in source) {
          (source as maplibregl.GeoJSONSource).setData(
            zonesRef.current as unknown as GeoJSON.GeoJSON,
          );
        }
        applySelectedFilter(map, selectedZoneId);
        loadedRef.current = true;
      });

      if (interactive) {
        map.on("mousemove", FILL_LAYER_ID, (event) => {
          const feature = event.features?.[0];
          const id = (feature?.properties as { id?: string } | undefined)?.id ?? null;
          if (id !== hoveredRef.current) onHoverZone?.(id);
          map.getCanvas().style.cursor = id ? "pointer" : "";
        });
        map.on("mouseleave", FILL_LAYER_ID, () => {
          onHoverZone?.(null);
          map.getCanvas().style.cursor = "";
        });
        map.on("click", FILL_LAYER_ID, (event) => {
          const id = (event.features?.[0]?.properties as { id?: string } | undefined)?.id;
          if (id) onSelectZone?.(id);
        });
      }

      return () => {
        map.remove();
        mapRef.current = null;
        loadedRef.current = false;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally created once; updates flow through the effects below.
    }, []);

    // Keep the rendered zones (and their severity for the current date
    // window / kind filter) in sync with the source.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !loadedRef.current) return;
      const source = map.getSource(SOURCE_ID);
      if (source && "setData" in source) {
        (source as maplibregl.GeoJSONSource).setData(zones as unknown as GeoJSON.GeoJSON);
      }
    }, [zones]);

    // Selection: outline the selected zone and fly the camera to it, except
    // on the very first run, where the constructor's own camera (view
    // param, all-zones bounds, or nothing yet if a deep-linked zone hasn't
    // resolved) already applies.
    useEffect(() => {
      const map = mapRef.current;
      if (!map) return;
      applySelectedFilter(map, selectedZoneId);

      if (firstSelectionSyncRef.current) {
        firstSelectionSyncRef.current = false;
        return;
      }
      if (selectedZoneId && selectedZoneCenter) {
        const target = {
          center: [selectedZoneCenter.lng, selectedZoneCenter.lat] as [number, number],
          zoom: Math.max(map.getZoom(), 9.5),
        };
        if (reducedMotion) {
          map.jumpTo(target);
        } else {
          map.flyTo({ ...target, duration: MOTION.mapFlyMs, easing: MOTION.ease });
        }
      }
    }, [selectedZoneId, selectedZoneCenter, reducedMotion]);

    // Non-interactive mode's externally driven camera (the map teaser's
    // scroll-driven handoff between corridor views). Guarded by a
    // stringified last-applied value so a re-render that passes an
    // equivalent-but-new object literal doesn't re-trigger flyTo, and by
    // loadedRef so this never fires before the style has finished loading.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !loadedRef.current || !externalCamera) return;
      const key = JSON.stringify(externalCamera);
      if (key === lastExternalCameraRef.current) return;
      lastExternalCameraRef.current = key;

      if (externalCamera.kind === "point") {
        const target = { center: externalCamera.center, zoom: externalCamera.zoom };
        if (reducedMotion) {
          map.jumpTo(target);
        } else {
          map.flyTo({ ...target, duration: MOTION.mapFlyMs, easing: MOTION.ease });
        }
      } else {
        map.fitBounds(externalCamera.bounds, {
          padding: 48,
          duration: reducedMotion ? 0 : MOTION.mapFlyMs,
        });
      }
    }, [externalCamera, reducedMotion]);

    // Hover feature-state, for the fill opacity bump on the layer paint.
    useEffect(() => {
      const map = mapRef.current;
      if (!map || !loadedRef.current) return;
      if (hoveredRef.current && hoveredRef.current !== hoveredZoneId) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredRef.current } as FeatureRef,
          { hover: false },
        );
      }
      if (hoveredZoneId) {
        map.setFeatureState(
          { source: SOURCE_ID, id: hoveredZoneId } as FeatureRef,
          { hover: true },
        );
      }
      hoveredRef.current = hoveredZoneId;
    }, [hoveredZoneId]);

    return <div ref={containerRef} className="h-full w-full" />;
  },
);
