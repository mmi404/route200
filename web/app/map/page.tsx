import { Suspense } from "react";
import type { Metadata } from "next";
import { MapExperience } from "./_components/MapExperience";

export const metadata: Metadata = {
  title: "Risk map",
  description:
    "Jamuna corridor erosion and Chattogram Hill Tracts landslide zones, from satellite change detection.",
};

type MapSearchParams = Promise<{ view?: string | string[]; zone?: string | string[] }>;

export default function MapPage({
  searchParams,
}: {
  searchParams: MapSearchParams;
}) {
  return (
    <Suspense fallback={<MapLoadingShell />}>
      <MapRoute searchParams={searchParams} />
    </Suspense>
  );
}

/**
 * Reads the two handoff params this route supports:
 * - `view`: a named camera from lib/design-tokens.ts's MAP_STYLE, used by
 *   the landing page's map teaser (DESIGN_SPEC.md 7a: "/map?view=hill-tracts").
 * - `zone`: opens straight to that zone's inspect panel.
 *
 * This is the only part of the route that reads request data (`searchParams`,
 * a Next.js Request-time API), so it's the only part wrapped in Suspense;
 * everything else in MapExperience is client-rendered anyway (MapLibre
 * needs the browser) and carries no server-rendering cost.
 */
async function MapRoute({ searchParams }: { searchParams: MapSearchParams }) {
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : undefined;
  const zone = typeof params.zone === "string" ? params.zone : undefined;
  return <MapExperience initialView={view} initialZoneId={zone} />;
}

function MapLoadingShell() {
  return (
    <div className="flex h-dvh flex-col">
      <div className="flex h-header shrink-0 items-center border-b border-rule bg-paper px-gutter">
        <p className="type-h3 whitespace-nowrap">
          Route<span className="text-ok">200</span>
        </p>
      </div>
      <div className="flex flex-1 items-center justify-center bg-paper">
        <p className="type-small text-ink-subtle">Loading zone data…</p>
      </div>
    </div>
  );
}
