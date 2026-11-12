/**
 * Real-data terrain grids for Ground View (evidence/scripts/
 * build_ground_terrain.py writes these into public/ground-data/<slug>/).
 *
 * Kept apart from terrain.ts's synthetic generation on purpose, the same
 * way evidence/_lib/available.ts is kept apart from packs.ts: only Teknaf
 * has real grids today, and every other zone must keep resolving instantly
 * to `null` with no network request, no behaviour change, and no added
 * wait, exactly as before this feature existed.
 */

export const GROUND_REAL_ZONE_IDS = ["zone-cht-teknaf"] as const;

export type GroundRealZoneId = (typeof GROUND_REAL_ZONE_IDS)[number];

export function hasRealTerrain(zoneId: string): zoneId is GroundRealZoneId {
  return (GROUND_REAL_ZONE_IDS as readonly string[]).includes(zoneId);
}

const SLUG_BY_ZONE_ID: Record<GroundRealZoneId, string> = {
  "zone-cht-teknaf": "teknaf",
};

/** A regular grid of values in world metres, row-major (index = row * width
 *  + col), where cell (row, col) sits at world x = originX + col * cellSize,
 *  z = originZ + row * cellSize. */
export interface Grid {
  width: number;
  height: number;
  cellSize: number;
  originX: number;
  originZ: number;
  values: Float32Array;
}

/** Bilinear sample at world (x, z). Clamped to the grid's own edge beyond
 *  its extent (no cliff, no NaN), since the grid is built wide enough to
 *  cover the whole walkable world and its skirt already falls away out of
 *  sight past worldRadius regardless of the height sampled there. */
export function sampleGrid(grid: Grid, x: number, z: number): number {
  const fx = clamp((x - grid.originX) / grid.cellSize, 0, grid.width - 1);
  const fz = clamp((z - grid.originZ) / grid.cellSize, 0, grid.height - 1);
  const x0 = Math.floor(fx);
  const z0 = Math.floor(fz);
  const x1 = Math.min(x0 + 1, grid.width - 1);
  const z1 = Math.min(z0 + 1, grid.height - 1);
  const tx = fx - x0;
  const tz = fz - z0;
  const v00 = grid.values[z0 * grid.width + x0];
  const v10 = grid.values[z0 * grid.width + x1];
  const v01 = grid.values[z1 * grid.width + x0];
  const v11 = grid.values[z1 * grid.width + x1];
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return a + (b - a) * tz;
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, value));
}

export interface RealTerrain {
  heights: Grid;
  density: Grid;
  disturbance: Grid;
  referenceElevationM: number;
  /** Pixel count of the real disturbance component the reference point was
   *  centred on, and the real SAR before/after dates, for in-scene captions
   *  that cite the actual measurement rather than a rounded summary. */
  disturbanceComponentPx: number;
  sarBeforeDate: string;
  sarAfterDate: string;
}

interface GroundDataMeta {
  reference_elevation_m: number;
  reference_disturbance_component_px: number;
  sar_before_date: string;
  sar_after_date: string;
  grids: Record<
    "heightmap" | "density" | "disturbance",
    { file: string; width: number; height: number; cellSize: number; originX: number; originZ: number }
  >;
}

function toGrid(meta: GroundDataMeta["grids"][keyof GroundDataMeta["grids"]], buffer: ArrayBuffer): Grid {
  return {
    width: meta.width,
    height: meta.height,
    cellSize: meta.cellSize,
    originX: meta.originX,
    originZ: meta.originZ,
    values: new Float32Array(buffer),
  };
}

/** Fetches the real terrain grids for a zone, or resolves to `null`
 *  immediately (no request made) for any zone without one. */
export async function loadRealTerrain(zoneId: string): Promise<RealTerrain | null> {
  if (!hasRealTerrain(zoneId)) return null;
  const base = `/ground-data/${SLUG_BY_ZONE_ID[zoneId]}`;
  const meta: GroundDataMeta = await fetch(`${base}/meta.json`).then((r) => r.json());
  const [heights, density, disturbance] = await Promise.all(
    (["heightmap", "density", "disturbance"] as const).map((key) =>
      fetch(`${base}/${meta.grids[key].file}`).then((r) => r.arrayBuffer()),
    ),
  );
  return {
    heights: toGrid(meta.grids.heightmap, heights),
    density: toGrid(meta.grids.density, density),
    disturbance: toGrid(meta.grids.disturbance, disturbance),
    referenceElevationM: meta.reference_elevation_m,
    disturbanceComponentPx: meta.reference_disturbance_component_px,
    sarBeforeDate: meta.sar_before_date,
    sarAfterDate: meta.sar_after_date,
  };
}
