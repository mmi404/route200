import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import type { ChangeEvent } from "@/lib/types";
import { GET } from "./route";

function requestFor(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/change-events${query}`);
}

describe("GET /api/change-events", () => {
  it("returns every event when no filters are given", async () => {
    const response = await GET(requestFor(""));
    expect(response.status).toBe(200);
    const body = (await response.json()) as ChangeEvent[];
    expect(body.length).toBeGreaterThan(0);
  });

  it("filters to a single zone's events when zoneId is given", async () => {
    const all = (await (await GET(requestFor(""))).json()) as ChangeEvent[];
    const targetZoneId = all[0].zoneId;
    const expectedIds = all
      .filter((event) => event.zoneId === targetZoneId)
      .map((event) => event.id)
      .sort();

    const response = await GET(requestFor(`?zoneId=${targetZoneId}`));
    const body = (await response.json()) as ChangeEvent[];

    expect(body.every((event) => event.zoneId === targetZoneId)).toBe(true);
    expect(body.map((event) => event.id).sort()).toEqual(expectedIds);
  });

  it("returns an empty array for a zoneId that matches nothing", async () => {
    const response = await GET(requestFor("?zoneId=zone-does-not-exist"));
    const body = (await response.json()) as ChangeEvent[];
    expect(body).toEqual([]);
  });

  it("filters to events at or above minSeverity, inclusive", async () => {
    const all = (await (await GET(requestFor(""))).json()) as ChangeEvent[];
    const threshold = 50;
    const expectedIds = all
      .filter((event) => event.severity >= threshold)
      .map((event) => event.id)
      .sort();

    const response = await GET(requestFor(`?minSeverity=${threshold}`));
    const body = (await response.json()) as ChangeEvent[];

    expect(body.every((event) => event.severity >= threshold)).toBe(true);
    expect(body.map((event) => event.id).sort()).toEqual(expectedIds);
    // The threshold must actually exclude something, or this test can't
    // distinguish "filtered correctly" from "filter is a no-op".
    expect(expectedIds.length).toBeLessThan(all.length);
  });

  it("ignores a non-numeric minSeverity rather than rejecting the request, per docs/WEB_DATA_CONTRACT.md", async () => {
    const all = (await (await GET(requestFor(""))).json()) as ChangeEvent[];

    const response = await GET(requestFor("?minSeverity=not-a-number"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as ChangeEvent[];
    expect(body.length).toBe(all.length);
  });

  it("combines zoneId and minSeverity filters", async () => {
    const all = (await (await GET(requestFor(""))).json()) as ChangeEvent[];
    const targetZoneId = all[0].zoneId;
    const threshold = 30;
    const expectedIds = all
      .filter((event) => event.zoneId === targetZoneId && event.severity >= threshold)
      .map((event) => event.id)
      .sort();

    const response = await GET(requestFor(`?zoneId=${targetZoneId}&minSeverity=${threshold}`));
    const body = (await response.json()) as ChangeEvent[];

    expect(body.every((event) => event.zoneId === targetZoneId && event.severity >= threshold)).toBe(
      true,
    );
    expect(body.map((event) => event.id).sort()).toEqual(expectedIds);
  });
});
