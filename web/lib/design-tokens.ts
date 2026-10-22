/**
 * Route200 design tokens for JavaScript consumers.
 *
 * CSS and Tailwind classes read tokens from app/globals.css. This file mirrors
 * the hex values for places that cannot read CSS variables, mainly MapLibre
 * paint properties and inline SVG charts. Keep the two in sync; the rationale
 * for every value is in web/DESIGN_SPEC.md.
 */

import { SEVERITY_BANDS, type SeverityBand, type ZoneKind } from "./types";

export const PALETTE = {
  paper: "#f5f0e6",
  surface: "#fbf8f1",
  well: "#ece5d8",
  rule: "#d9cfbe",
  ink: "#1c1a17",
  inkMuted: "#57514a",
  inkSubtle: "#6e665b",
  river: "#1d5b78",
  riverDeep: "#14445a",
  riverTint: "#dce7ea",
  ok: "#2e6b3e",
  okTint: "#dde8d9",
  paperMuted: "#a39a8c",
  riverLight: "#9cc3d5",
  okLight: "#8fc29b",
  nodata: "#c9c0b0",
} as const;

/** Ordered lowest to highest. Iterate this, never Object.keys(). */
export const SEVERITY_ORDER: readonly SeverityBand[] = [
  "low",
  "moderate",
  "high",
  "severe",
];

/** Area fills: map polygons, swatches, chart bars. Not for text. */
export const SEVERITY_FILL: Record<SeverityBand, string> = {
  low: "#ebcb6b",
  moderate: "#e08a3a",
  high: "#b2442a",
  severe: "#6b1d32",
};

/** Text-safe variants, all at least 5.6:1 on paper. */
export const SEVERITY_INK: Record<SeverityBand, string> = {
  low: "#7a5800",
  moderate: "#99460f",
  high: "#a63b1f",
  severe: "#6b1d32",
};

/** Text color to use ON a solid severity fill (solid badge, map label). */
export const SEVERITY_ON_FILL: Record<SeverityBand, string> = {
  low: PALETTE.ink,
  moderate: PALETTE.ink,
  high: PALETTE.paper,
  severe: PALETTE.paper,
};

export const SEVERITY_SHORT_LABEL: Record<
  "en" | "bn",
  Record<SeverityBand, string>
> = {
  en: { low: "Low", moderate: "Moderate", high: "High", severe: "Severe" },
  bn: { low: "কম", moderate: "মাঝারি", high: "উচ্চ", severe: "তীব্র" },
};

export const ZONE_KIND_LABEL: Record<"en" | "bn", Record<ZoneKind, string>> = {
  en: { erosion: "River erosion", landslide: "Hill landslide" },
  bn: { erosion: "নদীভাঙন", landslide: "পাহাড়ধস" },
};

export interface SeverityRange {
  band: SeverityBand;
  /** Inclusive lower bound on the integer 0-100 scale. */
  min: number;
  /** Inclusive upper bound on the 0-100 scale. */
  max: number;
}

/** Band ranges for legends, derived from SEVERITY_BANDS in lib/types.ts. */
export const SEVERITY_RANGES: readonly SeverityRange[] = SEVERITY_BANDS.map(
  (definition, index) => ({
    band: definition.band,
    min: index === 0 ? 0 : SEVERITY_BANDS[index - 1].max + 1,
    max: definition.max,
  }),
);

/**
 * Score above which the engine places SMS and voice alerts. Matches the
 * "Severe: alert threshold crossed" band definition in lib/types.ts.
 */
export const ALERT_THRESHOLD =
  SEVERITY_BANDS[SEVERITY_BANDS.length - 2]?.max ?? 75;

/** A MapLibre style expression. Cast to maplibre-gl's
 *  ExpressionSpecification at the call site. */
export type MapExpression = [string, ...unknown[]];

/**
 * MapLibre color expression that maps a numeric 0-100 feature property to
 * its severity color, with exactly the same cut points as severityToBand().
 * Features missing the property render in the no-data color.
 *
 *   map.addLayer({ type: "fill", paint: {
 *     "fill-color": severityColorExpression() as ExpressionSpecification,
 *   }})
 */
export function severityColorExpression(
  property = "severity",
  colors: Record<SeverityBand, string> = SEVERITY_FILL,
): MapExpression {
  const value = ["to-number", ["get", property]];
  const branches: unknown[] = [];
  SEVERITY_BANDS.slice(0, -1).forEach((definition) => {
    branches.push(["<=", value, definition.max], colors[definition.band]);
  });
  const last = SEVERITY_BANDS[SEVERITY_BANDS.length - 1];
  return [
    "case",
    ["!", ["has", property]],
    PALETTE.nodata,
    ...branches,
    colors[last.band],
  ];
}

/** Map styling constants shared by the landing teaser map and /map, so the
 *  teaser hands off to the full map without a visual jump. */
export const MAP_STYLE = {
  baseStyleUrl: "https://tiles.openfreemap.org/styles/liberty",
  /** Basemap overrides applied after style load to quiet the basemap. */
  background: PALETTE.paper,
  water: "#c8d5d9",
  fillOpacity: 0.55,
  fillOpacityHover: 0.72,
  /** Outline width by band; severe reads heavier, not just darker. */
  lineWidth: { low: 1, moderate: 1.25, high: 1.75, severe: 2.5 } as Record<
    SeverityBand,
    number
  >,
  /** Erosion outlines are solid, landslide outlines dashed. */
  lineDash: { erosion: null, landslide: [2, 1.5] } as Record<
    ZoneKind,
    number[] | null
  >,
  selectedLine: PALETTE.ink,
  selectedLineWidth: 3,
  labelHalo: PALETTE.paper,
  /** Opening camera for /map and the landing teaser: both tracks in view. */
  initialView: { center: [90.95, 23.4] as [number, number], zoom: 6.4 },
  /** fitBounds target covering all 12 zones, [[west, south], [east, north]]. */
  allZonesBounds: [
    [89.3, 21.2],
    [92.7, 25.5],
  ] as [[number, number], [number, number]],
  jamunaView: { center: [89.64, 24.85] as [number, number], zoom: 8.6 },
  hillTractsView: { center: [92.18, 21.85] as [number, number], zoom: 8.6 },
} as const;

export const MOTION = {
  /** Matches --ease-editorial. */
  ease: (t: number) => 1 - Math.pow(1 - t, 4),
  fastMs: 150,
  baseMs: 280,
  mapCrossfadeMs: 600,
  mapFlyMs: 1600,
  countMs: 1200,
} as const;

/** True when the visitor asked for reduced motion. Safe on the server. */
export function prefersReducedMotion(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return true;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}
