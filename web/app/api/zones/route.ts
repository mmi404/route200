import { readFileSync } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import type { ZoneFeatureCollection, ZoneKind } from "@/lib/types";

// Read with fs rather than `import ... from "*.geojson"`: the .geojson
// extension isn't a module type either TypeScript or the bundler
// recognizes out of the box, and this is also the one line that changes
// when this route starts reading from Postgres/Supabase instead (see
// docs/WEB_DATA_CONTRACT.md).
function loadZones(): ZoneFeatureCollection {
  const filePath = path.join(process.cwd(), "lib", "data", "zones.geojson");
  return JSON.parse(readFileSync(filePath, "utf-8")) as ZoneFeatureCollection;
}

/**
 * GET /api/zones
 *
 * Returns the full set of risk zones as a GeoJSON FeatureCollection, each
 * feature's properties matching the Zone type in lib/types.ts.
 *
 * Query params:
 * - kind: optional, "erosion" | "landslide". Filters the returned
 *   features to that kind when present; returns all zones otherwise.
 *
 * This currently reads lib/data/zones.geojson. Swapping in the real
 * engine's output is a matter of replacing the data source below with a
 * query against the production zones table; the response shape does not
 * change. See docs/WEB_DATA_CONTRACT.md.
 */
export async function GET(request: NextRequest) {
  const kind = request.nextUrl.searchParams.get("kind") as ZoneKind | null;

  if (kind && kind !== "erosion" && kind !== "landslide") {
    return NextResponse.json(
      { error: 'kind must be "erosion" or "landslide"' },
      { status: 400 }
    );
  }

  const zones = loadZones();
  const features = kind
    ? zones.features.filter((feature) => feature.properties.kind === kind)
    : zones.features;

  return NextResponse.json({
    type: "FeatureCollection",
    features,
  } satisfies ZoneFeatureCollection);
}
