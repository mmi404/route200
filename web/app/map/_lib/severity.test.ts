import { describe, expect, it } from "vitest";
import type { ChangeEvent, ZoneFeature } from "@/lib/types";
import {
  BAND_RANK,
  dateRangeOfEvents,
  dayIndexToIso,
  isoToDayIndex,
  latestEventInWindow,
  zoneEventHistory,
  zoneFeaturesBounds,
  zoneStatus,
} from "./severity";

function makeEvent(overrides: Partial<ChangeEvent>): ChangeEvent {
  return {
    id: "event-1",
    zoneId: "zone-a",
    dateRangeStart: "2026-01-01",
    dateRangeEnd: "2026-01-05",
    areaSqKm: 1.2,
    severity: 40,
    sourceScene: "Sentinel-1 GRD",
    detectedAt: "2026-01-06T00:00:00.000Z",
    ...overrides,
  };
}

function makeZoneFeature(overrides: Partial<ZoneFeature> = {}): ZoneFeature {
  return {
    type: "Feature",
    geometry: { type: "Polygon", coordinates: [[[89.0, 24.0], [89.1, 24.0], [89.1, 24.1], [89.0, 24.1], [89.0, 24.0]]] },
    properties: {
      id: "zone-a",
      name: "Test zone",
      kind: "erosion",
      center: { lat: 24.05, lng: 89.05 },
      district: "Sirajganj",
      upazila: "Kazipur",
      registeredAlertCount: 0,
    },
    ...overrides,
  };
}

describe("latestEventInWindow / zoneStatus", () => {
  it("returns nodata when a zone has no event overlapping the window, not a fabricated low", () => {
    const events = [
      makeEvent({ zoneId: "zone-a", dateRangeStart: "2026-01-01", dateRangeEnd: "2026-01-05", severity: 5 }),
    ];
    const window = { low: "2026-02-01", high: "2026-02-28" };

    expect(latestEventInWindow(events, "zone-a", window)).toBeUndefined();
    expect(zoneStatus(events, "zone-a", window)).toEqual({ band: "nodata" });
  });

  it("returns nodata for a zone with events only for a different zone id", () => {
    const events = [makeEvent({ zoneId: "zone-b" })];
    const window = { low: "2026-01-01", high: "2026-01-31" };

    expect(zoneStatus(events, "zone-a", window).band).toBe("nodata");
  });

  it("picks the most recent in-window event by dateRangeEnd, not by array order or severity", () => {
    const earlier = makeEvent({ id: "e1", dateRangeStart: "2026-01-01", dateRangeEnd: "2026-01-05", severity: 90 });
    const later = makeEvent({ id: "e2", dateRangeStart: "2026-01-10", dateRangeEnd: "2026-01-15", severity: 10 });
    const window = { low: "2026-01-01", high: "2026-01-31" };

    // `later` has lower severity but a more recent dateRangeEnd, and it is
    // listed first in the array: the function must pick it on date alone.
    const result = latestEventInWindow([later, earlier], "zone-a", window);
    expect(result?.id).toBe("e2");

    const status = zoneStatus([later, earlier], "zone-a", window);
    expect(status.event?.id).toBe("e2");
    expect(status.band).toBe("low");
  });

  it("includes an event whose range only partially overlaps the window at the boundary", () => {
    // Event spans Jan 1-10, window starts Jan 10: they touch at exactly one
    // day, which the inclusive overlap test should count as overlapping.
    const event = makeEvent({ dateRangeStart: "2026-01-01", dateRangeEnd: "2026-01-10" });
    const window = { low: "2026-01-10", high: "2026-01-20" };

    expect(latestEventInWindow([event], "zone-a", window)?.id).toBe("event-1");
  });

  it("excludes an event that ends the day before the window opens", () => {
    const event = makeEvent({ dateRangeStart: "2026-01-01", dateRangeEnd: "2026-01-09" });
    const window = { low: "2026-01-10", high: "2026-01-20" };

    expect(latestEventInWindow([event], "zone-a", window)).toBeUndefined();
  });

  it("excludes an event that starts the day after the window closes", () => {
    const event = makeEvent({ dateRangeStart: "2026-01-21", dateRangeEnd: "2026-01-25" });
    const window = { low: "2026-01-10", high: "2026-01-20" };

    expect(latestEventInWindow([event], "zone-a", window)).toBeUndefined();
  });
});

describe("BAND_RANK", () => {
  it("ranks severe highest and nodata lowest, in strictly descending order", () => {
    expect(BAND_RANK.severe).toBeGreaterThan(BAND_RANK.high);
    expect(BAND_RANK.high).toBeGreaterThan(BAND_RANK.moderate);
    expect(BAND_RANK.moderate).toBeGreaterThan(BAND_RANK.low);
    expect(BAND_RANK.low).toBeGreaterThan(BAND_RANK.nodata);
  });
});

describe("dateRangeOfEvents", () => {
  it("returns today for both bounds when there are no events", () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(dateRangeOfEvents([])).toEqual({ low: today, high: today });
  });

  it("spans the earliest start and latest end across multiple events, not just the first/last array entry", () => {
    const events = [
      makeEvent({ dateRangeStart: "2026-03-10", dateRangeEnd: "2026-03-15" }),
      makeEvent({ dateRangeStart: "2026-01-05", dateRangeEnd: "2026-01-20" }),
      makeEvent({ dateRangeStart: "2026-02-01", dateRangeEnd: "2026-05-01" }),
    ];

    expect(dateRangeOfEvents(events)).toEqual({ low: "2026-01-05", high: "2026-05-01" });
  });
});

describe("zoneEventHistory", () => {
  it("returns only the requested zone's events, sorted chronologically by dateRangeEnd regardless of input order", () => {
    const events = [
      makeEvent({ id: "late", zoneId: "zone-a", dateRangeEnd: "2026-06-01" }),
      makeEvent({ id: "other-zone", zoneId: "zone-b", dateRangeEnd: "2026-01-01" }),
      makeEvent({ id: "early", zoneId: "zone-a", dateRangeEnd: "2026-01-01" }),
      makeEvent({ id: "middle", zoneId: "zone-a", dateRangeEnd: "2026-03-01" }),
    ];

    const history = zoneEventHistory(events, "zone-a");
    expect(history.map((event) => event.id)).toEqual(["early", "middle", "late"]);
  });

  it("returns an empty array for a zone with no events", () => {
    expect(zoneEventHistory([makeEvent({ zoneId: "zone-b" })], "zone-a")).toEqual([]);
  });
});

describe("isoToDayIndex / dayIndexToIso", () => {
  it("round-trips an arbitrary date through day-index and back", () => {
    const iso = "2026-10-23";
    expect(dayIndexToIso(isoToDayIndex(iso))).toBe(iso);
  });

  it("anchors day index 0 at the Unix epoch's UTC day, independent of local timezone", () => {
    expect(isoToDayIndex("1970-01-01")).toBe(0);
    expect(isoToDayIndex("1970-01-02")).toBe(1);
    expect(dayIndexToIso(0)).toBe("1970-01-01");
  });

  it("treats consecutive calendar dates as consecutive integer day indices", () => {
    const day1 = isoToDayIndex("2026-02-28");
    const day2 = isoToDayIndex("2026-03-01");
    // 2026 is not a leap year, so Feb 28 -> Mar 1 is exactly one day.
    expect(day2 - day1).toBe(1);
  });
});

describe("zoneFeaturesBounds", () => {
  it("returns null for an empty feature list", () => {
    expect(zoneFeaturesBounds([])).toBeNull();
  });

  it("returns the exact bounding box of a single Polygon feature", () => {
    const feature = makeZoneFeature({
      geometry: {
        type: "Polygon",
        coordinates: [[[89.0, 24.0], [89.2, 24.0], [89.2, 24.3], [89.0, 24.3], [89.0, 24.0]]],
      },
    });

    expect(zoneFeaturesBounds([feature])).toEqual([
      [89.0, 24.0],
      [89.2, 24.3],
    ]);
  });

  it("spans both parts of a MultiPolygon feature", () => {
    const feature = makeZoneFeature({
      geometry: {
        type: "MultiPolygon",
        coordinates: [
          [[[88.0, 20.0], [88.5, 20.0], [88.5, 20.5], [88.0, 20.5], [88.0, 20.0]]],
          [[[92.0, 22.0], [92.5, 22.0], [92.5, 22.5], [92.0, 22.5], [92.0, 22.0]]],
        ],
      },
    });

    expect(zoneFeaturesBounds([feature])).toEqual([
      [88.0, 20.0],
      [92.5, 22.5],
    ]);
  });

  it("combines bounds across several features, not just the first one", () => {
    const west = makeZoneFeature({
      properties: { ...makeZoneFeature().properties, id: "zone-west" },
      geometry: { type: "Polygon", coordinates: [[[88.0, 21.0], [88.1, 21.0], [88.1, 21.1], [88.0, 21.1], [88.0, 21.0]]] },
    });
    const east = makeZoneFeature({
      properties: { ...makeZoneFeature().properties, id: "zone-east" },
      geometry: { type: "Polygon", coordinates: [[[93.0, 25.0], [93.1, 25.0], [93.1, 25.1], [93.0, 25.1], [93.0, 25.0]]] },
    });

    expect(zoneFeaturesBounds([west, east])).toEqual([
      [88.0, 21.0],
      [93.1, 25.1],
    ]);
  });
});
