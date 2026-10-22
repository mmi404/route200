import { NextRequest, NextResponse } from "next/server";
import changeEventsData from "@/lib/data/change-events.json";
import type { ChangeEvent } from "@/lib/types";

const changeEvents = changeEventsData as ChangeEvent[];

/**
 * GET /api/change-events
 *
 * Returns detected change events, each matching the ChangeEvent type in
 * lib/types.ts.
 *
 * Query params:
 * - zoneId: optional. Filters to events for a single zone id.
 * - minSeverity: optional, 0-100. Filters to events whose severity score
 *   is greater than or equal to this value. Invalid (non-numeric) values
 *   are ignored rather than rejected.
 *
 * This currently reads lib/data/change-events.json. Swapping in the real
 * engine's output is a matter of replacing the data source below with a
 * query against the production change_events table; the response shape
 * does not change. See docs/WEB_DATA_CONTRACT.md.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const zoneId = searchParams.get("zoneId");
  const minSeverityParam = searchParams.get("minSeverity");
  const minSeverity = minSeverityParam !== null ? Number(minSeverityParam) : null;

  let results = changeEvents;

  if (zoneId) {
    results = results.filter((event) => event.zoneId === zoneId);
  }

  if (minSeverity !== null && !Number.isNaN(minSeverity)) {
    results = results.filter((event) => event.severity >= minSeverity);
  }

  return NextResponse.json(results satisfies ChangeEvent[]);
}
