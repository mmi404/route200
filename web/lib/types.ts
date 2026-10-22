/**
 * Shared types for Route200's data layer.
 *
 * These mirror the shape described in docs/ARCHITECTURE.md's data-layer
 * section (`zones` and `change_events`, Postgres/Supabase-backed in
 * production). The mock data under lib/data/ and the route handlers under
 * app/api/ are built against this exact contract, so that pointing the
 * route handlers at a real database later is a data-source change only.
 * See docs/WEB_DATA_CONTRACT.md for the full description aimed at the
 * engineers who will build that real engine.
 */

export type ZoneKind = "erosion" | "landslide";

export interface ZoneCenter {
  lat: number;
  lng: number;
}

/** Minimal GeoJSON geometry types, kept local so this file has no external
 *  dependency. A zone's geometry is always in WGS84 (lon, lat) order, as
 *  GeoJSON requires. */
export interface PolygonGeometry {
  type: "Polygon";
  coordinates: number[][][];
}

export interface MultiPolygonGeometry {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

export type ZoneGeometry = PolygonGeometry | MultiPolygonGeometry;

/** Properties carried on a Zone, independent of its geometry. */
export interface ZoneProperties {
  id: string;
  name: string;
  /**
   * Natural Bangla name for this zone, for the Bangla UI (map labels, the
   * alert signup form's area select, the SMS preview sentence). Written as
   * a native speaker would actually refer to the place, not a literal
   * transliteration of `name`. Optional only because older mock data
   * predates this field; every zone in lib/data/zones.geojson has one.
   */
  nameBn?: string;
  kind: ZoneKind;
  center: ZoneCenter;
  /** District the zone falls in, e.g. "Sirajganj" or "Bandarban". */
  district: string;
  /** Upazila (sub-district) the zone falls in, e.g. "Kazipur". */
  upazila: string;
  /**
   * Placeholder count of registered alert contacts (households/numbers)
   * within this zone. In production this count is derived from the alert
   * delivery track's contact table (see ARCHITECTURE.md section 5), not
   * stored directly on the zone row; it is included here so the web
   * experience can show it without a second round trip.
   */
  registeredAlertCount: number;
}

/** A single named risk zone. */
export interface Zone extends ZoneProperties {
  geometry: ZoneGeometry;
}

/** A GeoJSON Feature wrapping a Zone, as stored in lib/data/zones.geojson
 *  and returned by GET /api/zones. */
export interface ZoneFeature {
  type: "Feature";
  geometry: ZoneGeometry;
  properties: ZoneProperties;
}

export interface ZoneFeatureCollection {
  type: "FeatureCollection";
  features: ZoneFeature[];
}

/** Numeric severity score emitted by the change-detection engine: 0 (no
 *  detected change) to 100 (most severe). This is the value stored on a
 *  change_events row; the band below is derived from it, never stored. */
export type SeverityScore = number;

/** Human-facing severity band derived from a SeverityScore. */
export type SeverityBand = "low" | "moderate" | "high" | "severe";

export interface SeverityInfo {
  score: SeverityScore;
  band: SeverityBand;
  label: string;
}

export interface SeverityBandDefinition {
  /** Inclusive upper bound of this band on the 0-100 scale. */
  max: number;
  band: SeverityBand;
  label: string;
}

/** Exported (read-only use) so the map's color expression and the legend in
 *  lib/design-tokens.ts derive their cut points from this one table. */
export const SEVERITY_BANDS: readonly SeverityBandDefinition[] = [
  {
    max: 25,
    band: "low",
    label: "Low: minor change, within normal seasonal variation",
  },
  {
    max: 50,
    band: "moderate",
    label: "Moderate: notable change, worth monitoring",
  },
  {
    max: 75,
    band: "high",
    label: "High: significant change, approaching alert threshold",
  },
  {
    max: 100,
    band: "severe",
    label: "Severe: rapid or large-scale change, alert threshold crossed",
  },
];

/**
 * Maps a 0-100 severity score to its band and a short human label.
 *
 * This threshold logic is intentionally kept in one place. The real engine
 * (ARCHITECTURE.md section 2) will apply its own thresholding to produce
 * the numeric score in the first place; this function only governs how the
 * web experience labels a score it already has, and is the function that
 * should change if the band cut points are ever revisited.
 */
export function severityToBand(score: SeverityScore): SeverityInfo {
  const clamped = Math.max(0, Math.min(100, score));
  const match =
    SEVERITY_BANDS.find((candidate) => clamped <= candidate.max) ??
    SEVERITY_BANDS[SEVERITY_BANDS.length - 1];
  return { score: clamped, band: match.band, label: match.label };
}

/**
 * Source scene types a change event can be attributed to. "Sentinel-1 GRD"
 * is the development/validation rail (deep archive, available today);
 * "NISAR GCOV" is the primary source once its archive is deep enough to
 * rely on (see ML_Data_Sources_DRAFT.md). Both are real product names;
 * nothing here invents a scene type that doesn't exist.
 */
export type SourceScene = "Sentinel-1 GRD" | "NISAR GCOV";

/** A single detected change event for one zone, as returned by
 *  GET /api/change-events. Mirrors a change_events row. */
export interface ChangeEvent {
  id: string;
  zoneId: string;
  /** ISO 8601 date (YYYY-MM-DD), start of the observed date range. */
  dateRangeStart: string;
  /** ISO 8601 date (YYYY-MM-DD), end of the observed date range. */
  dateRangeEnd: string;
  areaSqKm: number;
  severity: SeverityScore;
  sourceScene: SourceScene;
  /** ISO 8601 timestamp of when the engine emitted this event. */
  detectedAt: string;
}
