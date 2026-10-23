import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { ZoneFeatureCollection } from "@/lib/types";
import { GET } from "./route";

function requestFor(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/zones${query}`);
}

describe("GET /api/zones", () => {
  it("returns every zone when no kind filter is given", async () => {
    const response = await GET(requestFor(""));
    expect(response.status).toBe(200);
    const body = (await response.json()) as ZoneFeatureCollection;

    expect(body.type).toBe("FeatureCollection");
    expect(body.features.length).toBeGreaterThan(0);
    // Sanity check this is the real mixed dataset, not an accidentally
    // pre-filtered one: both kinds should be present among all zones.
    const kinds = new Set(body.features.map((feature) => feature.properties.kind));
    expect(kinds.has("erosion")).toBe(true);
    expect(kinds.has("landslide")).toBe(true);
  });

  it("filters to only erosion zones when kind=erosion", async () => {
    const all = (await (await GET(requestFor(""))).json()) as ZoneFeatureCollection;
    const expectedIds = all.features
      .filter((feature) => feature.properties.kind === "erosion")
      .map((feature) => feature.properties.id)
      .sort();

    const response = await GET(requestFor("?kind=erosion"));
    const body = (await response.json()) as ZoneFeatureCollection;

    expect(response.status).toBe(200);
    expect(body.features.every((feature) => feature.properties.kind === "erosion")).toBe(true);
    expect(body.features.map((feature) => feature.properties.id).sort()).toEqual(expectedIds);
    // The filter must actually narrow the set, not silently pass everything
    // through: there are landslide zones in the full dataset too.
    expect(expectedIds.length).toBeLessThan(all.features.length);
  });

  it("filters to only landslide zones when kind=landslide", async () => {
    const response = await GET(requestFor("?kind=landslide"));
    const body = (await response.json()) as ZoneFeatureCollection;

    expect(response.status).toBe(200);
    expect(body.features.length).toBeGreaterThan(0);
    expect(body.features.every((feature) => feature.properties.kind === "landslide")).toBe(true);
  });

  it("rejects an unrecognized kind value with a 400, per docs/WEB_DATA_CONTRACT.md", async () => {
    const response = await GET(requestFor("?kind=flood"));
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toMatch(/erosion/);
    expect(body.error).toMatch(/landslide/);
  });
});
