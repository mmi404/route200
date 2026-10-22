/**
 * Pure helpers for turning raw change events into the per-zone severity
 * state the map, rail and inspect panel all read from. Keeping this logic
 * out of the components means MapCanvas, ZoneRail, MobileSheet and
 * InspectPanel can never disagree about what a zone's current severity is.
 *
 * A zone's displayed severity is its most recent change event's score
 * within the selected date window (DESIGN_SPEC.md, "Map experience"). A
 * zone with no event overlapping the window is "nodata", not "low": it was
 * not observed to change, which is a different claim than observed not to
 * have changed much.
 */
import type {
  ChangeEvent,
  SeverityBand,
  ZoneFeature,
  ZoneKind,
} from "@/lib/types";
import { severityToBand } from "@/lib/types";

export type KindFilter = "all" | ZoneKind;

/** Inclusive ISO date bounds, "YYYY-MM-DD". */
export interface DateWindow {
  low: string;
  high: string;
}

export interface ZoneStatus {
  /** The event behind the current band, when one falls in the window. */
  event?: ChangeEvent;
  band: SeverityBand | "nodata";
}

export interface ZoneListEntry {
  feature: ZoneFeature;
  status: ZoneStatus;
}

/** Zones (post-filter), ranked severe first, then nodata last. */
export const BAND_RANK: Record<SeverityBand | "nodata", number> = {
  severe: 4,
  high: 3,
  moderate: 2,
  low: 1,
  nodata: 0,
};

function overlapsWindow(event: ChangeEvent, window: DateWindow): boolean {
  return event.dateRangeEnd >= window.low && event.dateRangeStart <= window.high;
}

/** The full low/high span covered by a set of events, for the slider's
 *  outer bounds and the default (fully open) window. */
export function dateRangeOfEvents(events: ChangeEvent[]): DateWindow {
  if (events.length === 0) {
    const today = new Date().toISOString().slice(0, 10);
    return { low: today, high: today };
  }
  let low = events[0].dateRangeStart;
  let high = events[0].dateRangeEnd;
  for (const event of events) {
    if (event.dateRangeStart < low) low = event.dateRangeStart;
    if (event.dateRangeEnd > high) high = event.dateRangeEnd;
  }
  return { low, high };
}

/** The latest (by dateRangeEnd) event for a zone that overlaps the window. */
export function latestEventInWindow(
  events: ChangeEvent[],
  zoneId: string,
  window: DateWindow,
): ChangeEvent | undefined {
  let latest: ChangeEvent | undefined;
  for (const event of events) {
    if (event.zoneId !== zoneId || !overlapsWindow(event, window)) continue;
    if (!latest || event.dateRangeEnd > latest.dateRangeEnd) latest = event;
  }
  return latest;
}

export function zoneStatus(
  events: ChangeEvent[],
  zoneId: string,
  window: DateWindow,
): ZoneStatus {
  const event = latestEventInWindow(events, zoneId, window);
  if (!event) return { band: "nodata" };
  return { event, band: severityToBand(event.severity).band };
}

/** A zone's full event history, chronological, for the inspect panel's
 *  strip chart. Not filtered by the date window: the chart's job is to
 *  show the shift the window is cutting into, not just the slice. */
export function zoneEventHistory(
  events: ChangeEvent[],
  zoneId: string,
): ChangeEvent[] {
  return events
    .filter((event) => event.zoneId === zoneId)
    .sort((a, b) => (a.dateRangeEnd < b.dateRangeEnd ? -1 : a.dateRangeEnd > b.dateRangeEnd ? 1 : 0));
}

/**
 * Bounding box covering a set of zone features' own geometry, as
 * [[west, south], [east, north]], the shape MapLibre's fitBounds expects.
 * Used to reframe the camera when the kind filter changes which zones are
 * on screen (DESIGN_SPEC.md's `allZonesBounds` covers all zones; this
 * covers whatever subset is actually showing). Returns null for an empty
 * feature list, since there is nothing to frame.
 */
export function zoneFeaturesBounds(
  features: ZoneFeature[],
): [[number, number], [number, number]] | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;

  const visit = (lng: number, lat: number) => {
    if (lng < west) west = lng;
    if (lng > east) east = lng;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  };

  for (const feature of features) {
    const { geometry } = feature;
    if (geometry.type === "Polygon") {
      geometry.coordinates.forEach((ring) =>
        ring.forEach(([lng, lat]) => visit(lng, lat)),
      );
    } else {
      geometry.coordinates.forEach((polygon) =>
        polygon.forEach((ring) => ring.forEach(([lng, lat]) => visit(lng, lat))),
      );
    }
  }

  if (!Number.isFinite(west) || !Number.isFinite(south)) return null;
  return [
    [west, south],
    [east, north],
  ];
}

/** Whole-day index since the Unix epoch, for integer slider math. */
export function isoToDayIndex(iso: string): number {
  return Math.floor(Date.parse(`${iso}T00:00:00.000Z`) / 86_400_000);
}

export function dayIndexToIso(day: number): string {
  return new Date(day * 86_400_000).toISOString().slice(0, 10);
}
