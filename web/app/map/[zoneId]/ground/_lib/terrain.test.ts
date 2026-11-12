import { describe, expect, it } from "vitest";
import type { ChangeEvent } from "@/lib/types";
import { isoToDayIndex } from "../../../_lib/severity";
import type { Grid, RealTerrain } from "./realTerrain";
import {
  baseHeight,
  clearedAmount,
  FENCE_SLAT_SPACING,
  POLE_HEIGHT,
  generateDistantTreeSlots,
  generateLogSlots,
  generateTreeSlots,
  generateUndergrowthSlots,
  houseAppear,
  houseToWorld,
  isSeverityStatic,
  logAmount,
  realTerrainStops,
  roadAppear,
  roadInfo,
  roadWidth,
  sceneLayoutForZone,
  settlementObstacles,
  settlementPlan,
  severityAtDay,
  stumpAmount,
  terrainHeight,
  terrainHeightFromBase,
  treeVisibility,
  treeVisibilityFromCleared,
  UNDERGROWTH_KINDS,
  undergrowthVisibility,
} from "./terrain";

/** A small synthetic real-terrain fixture: a real pack would come from
 *  evidence/scripts/build_ground_terrain.py, but the rendering code only
 *  needs the Grid shape, so a hand-built one is enough to exercise the
 *  real-data branches without a network fetch. 9x9 cells, 10 m spacing,
 *  covering -40..40: a hill peaking at the origin, a disturbed disc of
 *  radius 15 around it, and zero tree density inside radius 20 vs. full
 *  density outside (so density weighting has something to grab onto). */
function makeRealTerrainFixture(): RealTerrain {
  const half = 40;
  const cell = 10;
  const n = Math.round((2 * half) / cell) + 1;
  const heights = new Float32Array(n * n);
  const density = new Float32Array(n * n);
  const disturbance = new Float32Array(n * n);
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      const x = -half + col * cell;
      const z = -half + row * cell;
      const dist = Math.hypot(x, z);
      const idx = row * n + col;
      heights[idx] = 20 - dist * 0.3;
      density[idx] = dist < 20 ? 0 : 1;
      disturbance[idx] = dist < 15 ? 1 : 0;
    }
  }
  const grid = (values: Float32Array): Grid => ({
    width: n,
    height: n,
    cellSize: cell,
    originX: -half,
    originZ: -half,
    values,
  });
  return {
    heights: grid(heights),
    density: grid(density),
    disturbance: grid(disturbance),
    referenceElevationM: 100,
    disturbanceComponentPx: 500,
    sarBeforeDate: "2026-05-04",
    sarAfterDate: "2026-11-05",
    densityTimeline: [],
  };
}

const ZONES = ["zone-cht-teknaf", "zone-jmn-sirajganj", "zone-x", "zone-cht-bandarban"];

function makeEvent(end: string, severity: number): ChangeEvent {
  return {
    id: `e-${end}`,
    zoneId: "zone-a",
    dateRangeStart: end,
    dateRangeEnd: end,
    areaSqKm: 1,
    severity,
    sourceScene: "Sentinel-1 GRD",
    detectedAt: `${end}T00:00:00.000Z`,
  };
}

describe("sceneLayoutForZone", () => {
  it("is deterministic per zone id and differs between zones", () => {
    const a = sceneLayoutForZone("zone-cht-teknaf");
    const b = sceneLayoutForZone("zone-cht-teknaf");
    expect(b).toEqual(a);
    expect(sceneLayoutForZone("zone-other").scarCenter).not.toEqual(a.scarCenter);
    for (const [x, z] of [[3, 4], [-20, 11], [40.5, -7]]) {
      expect(baseHeight(x, z, b)).toBe(baseHeight(x, z, a));
      expect(terrainHeight(x, z, b, 0.7)).toBe(terrainHeight(x, z, a, 0.7));
    }
  });

  it.each(ZONES)("%s has a sane layout", (zone) => {
    const layout = sceneLayoutForZone(zone);
    expect(layout.walkRadius).toBeCloseTo(52, 0);
    expect(layout.worldRadius).toBeCloseTo(120, 0);
    const scarR = Math.hypot(layout.scarCenter.x, layout.scarCenter.z);
    expect(scarR).toBeGreaterThanOrEqual(10);
    expect(scarR).toBeLessThanOrEqual(18);
    expect(roadWidth).toBeCloseTo(4.2, 1);

    // Road: 20-40 samples from the rim to beside the house.
    expect(layout.road.length).toBeGreaterThanOrEqual(20);
    expect(layout.road.length).toBeLessThanOrEqual(40);
    const first = layout.road[0];
    expect(Math.hypot(first.x, first.z)).toBeGreaterThan(layout.walkRadius + 15);
    const last = layout.road[layout.road.length - 1];
    expect(Math.hypot(last.x - layout.house.x, last.z - layout.house.z)).toBeLessThan(9);
  });

  it.each(ZONES)("%s: spawn is walkable, in bounds, facing the scar", (zone) => {
    const layout = sceneLayoutForZone(zone);
    const { spawn, scarCenter } = layout;
    const dist = Math.hypot(spawn.x - scarCenter.x, spawn.z - scarCenter.z);
    expect(dist).toBeGreaterThanOrEqual(28);
    expect(dist).toBeLessThanOrEqual(35);
    expect(Math.hypot(spawn.x, spawn.z)).toBeLessThan(layout.walkRadius);

    // Slope under 25 degrees, at the start and fully cleared.
    for (const sev of [0, 1]) {
      const e = 1;
      const gx = (terrainHeight(spawn.x + e, spawn.z, layout, sev) - terrainHeight(spawn.x - e, spawn.z, layout, sev)) / 2;
      const gz = (terrainHeight(spawn.x, spawn.z + e, layout, sev) - terrainHeight(spawn.x, spawn.z - e, layout, sev)) / 2;
      expect(Math.atan(Math.hypot(gx, gz))).toBeLessThan((25 * Math.PI) / 180);
    }

    // Forward at yaw (-sin, -cos) points at the scar centre.
    const fx = -Math.sin(spawn.yaw);
    const fz = -Math.cos(spawn.yaw);
    const toScar = Math.hypot(scarCenter.x - spawn.x, scarCenter.z - spawn.z);
    expect(fx * ((scarCenter.x - spawn.x) / toScar) + fz * ((scarCenter.z - spawn.z) / toScar)).toBeGreaterThan(0.999);
  });

  it.each(ZONES)("%s: ground rises into a steep ridge past the walkable disc", (zone) => {
    const layout = sceneLayoutForZone(zone);
    let steepest = 0;
    for (let a = 0; a < Math.PI * 2; a += 0.1) {
      const inner = baseHeight(Math.cos(a) * 40, Math.sin(a) * 40, layout);
      const rim = baseHeight(Math.cos(a) * 80, Math.sin(a) * 80, layout);
      expect(rim - inner).toBeGreaterThan(12);
      const r = layout.walkRadius + 8;
      const h1 = baseHeight(Math.cos(a) * (r + 1), Math.sin(a) * (r + 1), layout);
      const h0 = baseHeight(Math.cos(a) * (r - 1), Math.sin(a) * (r - 1), layout);
      steepest = Math.max(steepest, Math.atan((h1 - h0) / 2));
    }
    // Somewhere around the ring the wall is beyond what the player can climb.
    expect(steepest).toBeGreaterThan((38 * Math.PI) / 180);
  });
});

describe("terrainHeight", () => {
  it.each(ZONES.slice(0, 2))("%s: is continuous at every severity (0.5 m steps inside walkRadius)", (zone) => {
    const layout = sceneLayoutForZone(zone);
    const step = 0.5;
    const n = Math.round((layout.walkRadius * 2) / step) + 1;
    const at = (i: number) => -layout.walkRadius + i * step;
    for (const sev of [0, 0.5, 0.83, 1]) {
      const grid = new Float64Array(n * n);
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) grid[i * n + j] = terrainHeight(at(i), at(j), layout, sev);
      }
      let worst = 0;
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          if (Math.hypot(at(i), at(j)) >= layout.walkRadius) continue;
          if (i + 1 < n && Math.hypot(at(i + 1), at(j)) < layout.walkRadius) {
            worst = Math.max(worst, Math.abs(grid[(i + 1) * n + j] - grid[i * n + j]));
          }
          if (j + 1 < n && Math.hypot(at(i), at(j + 1)) < layout.walkRadius) {
            worst = Math.max(worst, Math.abs(grid[i * n + j + 1] - grid[i * n + j]));
          }
        }
      }
      expect(worst).toBeLessThan(0.6);
    }
  });

  it("terrainHeightFromBase agrees with terrainHeight", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf");
    for (const [x, z] of [[0, 0], [layout.scarCenter.x, layout.scarCenter.z], [20, -30]]) {
      expect(terrainHeightFromBase(baseHeight(x, z, layout), x, z, layout, 0.9)).toBe(
        terrainHeight(x, z, layout, 0.9),
      );
    }
  });

  it("cuts the hill down by several metres at the scar centre at full severity", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf");
    const { x, z } = layout.scarCenter;
    expect(terrainHeight(x, z, layout, 0)).toBe(baseHeight(x, z, layout));
    expect(baseHeight(x, z, layout) - terrainHeight(x, z, layout, 1)).toBeGreaterThan(3);
  });

  it("levels the road bed across its width and the pad under the house", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf");
    const mid = layout.road[Math.floor(layout.road.length / 3)];
    const bed = roadInfo(mid.x, mid.z, layout).bed;
    expect(terrainHeight(mid.x, mid.z, layout, 1)).toBeCloseTo(bed, 5);
    const { x, z } = layout.house;
    const a = terrainHeight(x + 2, z, layout, 1);
    const b = terrainHeight(x - 2, z, layout, 1);
    expect(Math.abs(a - b)).toBeLessThan(0.05);
  });
});

describe("clearedAmount", () => {
  it.each(ZONES)("%s: is 0 everywhere at severity 0 and ~1 at the scar centre at 1", (zone) => {
    const layout = sceneLayoutForZone(zone);
    for (let x = -120; x <= 120; x += 9) {
      for (let z = -120; z <= 120; z += 9) {
        expect(clearedAmount(x, z, layout, 0)).toBe(0);
      }
    }
    expect(clearedAmount(layout.scarCenter.x, layout.scarCenter.z, layout, 1)).toBeGreaterThan(0.98);
  });

  it("grows outward irregularly and stays within 0..1", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf");
    const { x, z } = layout.scarCenter;
    const radiiAt = (sev: number) => {
      const radii: number[] = [];
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 8) {
        let r = 0;
        while (r < 60 && clearedAmount(x + Math.cos(a) * r, z + Math.sin(a) * r, layout, sev) > 0.5) r += 0.5;
        radii.push(r);
      }
      return radii;
    };
    // Below 0.55 the road has not appeared, so this measures the scar alone.
    const mid = radiiAt(0.3);
    const full = radiiAt(0.5);
    expect(Math.max(...full)).toBeGreaterThan(Math.max(...mid));
    expect(Math.max(...full)).toBeLessThan(layout.scarMaxRadius * 1.3);
    expect(Math.max(...mid)).toBeGreaterThan(2);
    expect(Math.max(...full) - Math.min(...full)).toBeGreaterThan(1);
    for (const sev of [0.2, 0.6, 1]) {
      const c = clearedAmount(x + 7, z - 3, layout, sev);
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it.each(ZONES)("%s: every road point inside walkRadius is cleared once the road appears", (zone) => {
    const layout = sceneLayoutForZone(zone);
    for (const p of layout.road) {
      if (Math.hypot(p.x, p.z) >= layout.walkRadius) continue;
      expect(clearedAmount(p.x, p.z, layout, 0.83)).toBeGreaterThan(0.97);
    }
  });
});

describe("appear curves", () => {
  it("road and house are absent below 0.55 and fully present at the real max of 0.83", () => {
    expect(roadAppear(0.5)).toBe(0);
    expect(houseAppear(0.5)).toBe(0);
    expect(roadAppear(0.83)).toBe(1);
    expect(houseAppear(0.83)).toBe(1);
    expect(roadAppear(0.7)).toBeGreaterThan(0);
    expect(roadAppear(0.7)).toBeLessThan(1);
  });
});

describe("trees", () => {
  const layout = sceneLayoutForZone("zone-cht-teknaf");
  const slots = generateTreeSlots(layout, 1400);

  it("scatters the requested count inside the world, denser near the walkable area", () => {
    expect(slots).toHaveLength(1400);
    expect(slots.every((s) => Math.hypot(s.x, s.z) <= layout.worldRadius + 1e-6)).toBe(true);
    expect(slots.every((s) => s.variant >= 0 && s.variant <= 3 && Number.isInteger(s.variant))).toBe(true);
    expect(slots.every((s) => s.jitter >= 0 && s.jitter <= 1)).toBe(true);
    const inner = slots.filter((s) => Math.hypot(s.x, s.z) < layout.walkRadius + 20).length;
    expect(inner / slots.length).toBeGreaterThan(0.6);
    expect(generateTreeSlots(layout, 1400)).toEqual(slots);
  });

  it("are all present at severity 0, gone in the cleared scar and on the road, thinning between", () => {
    expect(slots.every((s) => treeVisibility(s, layout, 0) === 1)).toBe(true);
    for (const s of slots) {
      const cleared = clearedAmount(s.x, s.z, layout, 1);
      const v = treeVisibility(s, layout, 1);
      if (cleared > 0.9) expect(v).toBe(0);
      if (roadInfo(s.x, s.z, layout).dist < roadWidth / 2) expect(v).toBe(0);
    }
    const mid = slots.map((s) => treeVisibility(s, layout, 0.83));
    expect(mid.some((v) => v > 0 && v < 1)).toBe(true);
    expect(mid.filter((v) => v === 1).length).toBeGreaterThan(slots.length / 2);
  });

  it("keeps the spawn clear of trunks", () => {
    for (const s of slots) {
      expect(Math.hypot(s.x - layout.spawn.x, s.z - layout.spawn.z)).toBeGreaterThanOrEqual(2.5);
    }
  });
});

describe("severityAtDay", () => {
  const history = [makeEvent("2026-06-25", 20), makeEvent("2026-07-25", 60), makeEvent("2026-09-26", 83)];
  const day = (iso: string) => isoToDayIndex(iso);

  it("is 0 before the lead-in and ramps up to the first reading", () => {
    expect(severityAtDay([], day("2026-06-25"))).toBe(0);
    expect(severityAtDay(history, day("2026-06-25") - 20)).toBe(0);
    expect(severityAtDay(history, day("2026-06-25") - 100)).toBe(0);
    expect(severityAtDay(history, day("2026-06-25") - 10)).toBeCloseTo(10, 5);
    expect(severityAtDay(history, day("2026-06-25"))).toBe(20);
  });

  it("interpolates between recorded events", () => {
    const a = day("2026-06-25");
    const b = day("2026-07-25");
    expect(severityAtDay(history, (a + b) / 2)).toBeCloseTo(40, 5);
    expect(severityAtDay(history, b)).toBe(60);
  });

  it("stays flat at the latest reading after the last event", () => {
    expect(severityAtDay(history, day("2026-09-26"))).toBe(83);
    expect(severityAtDay(history, day("2027-03-01"))).toBe(83);
  });
});

describe("vegetation layers", () => {
  const layout = sceneLayoutForZone("zone-cht-teknaf");
  const half = roadWidth / 2;

  it("treeVisibilityFromCleared matches treeVisibility", () => {
    const slots = generateTreeSlots(layout, 200);
    for (const sev of [0, 0.4, 0.7, 0.83, 1]) {
      for (const s of slots) {
        const cleared = clearedAmount(s.x, s.z, layout, sev);
        expect(treeVisibilityFromCleared(s, cleared, layout, sev)).toBeCloseTo(treeVisibility(s, layout, sev), 10);
      }
    }
  });

  it("scatters distant trees outside the walkable disc, deterministically", () => {
    const far = generateDistantTreeSlots(layout, 300);
    expect(far).toHaveLength(300);
    for (const s of far) {
      expect(Math.hypot(s.x, s.z)).toBeGreaterThanOrEqual(layout.walkRadius + 4 - 1e-6);
      expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(layout.worldRadius + 1e-6);
    }
    expect(generateDistantTreeSlots(layout, 300)).toEqual(far);
  });

  it("generates seeded undergrowth of every kind inside the walkable area and margin", () => {
    const slots = generateUndergrowthSlots(layout, 3000);
    expect(slots).toHaveLength(3000);
    expect(generateUndergrowthSlots(layout, 3000)).toEqual(slots);
    const counts = UNDERGROWTH_KINDS.map((_, k) => slots.filter((s) => s.kind === k).length);
    for (const c of counts) expect(c).toBeGreaterThan(150);
    for (const s of slots) expect(Math.hypot(s.x, s.z)).toBeLessThanOrEqual(layout.walkRadius + 14 + 1e-6);
    for (const s of slots) expect(Math.hypot(s.x - layout.spawn.x, s.z - layout.spawn.z)).toBeGreaterThanOrEqual(3);
  });

  it("removes undergrowth with clearing and never leaves it on the road bed or house pad", () => {
    const slots = generateUndergrowthSlots(layout, 3000);
    expect(slots.every((s) => undergrowthVisibility(s, 0) === 1)).toBe(true);
    for (const s of slots) {
      const v = undergrowthVisibility(s, clearedAmount(s.x, s.z, layout, 1));
      if (roadInfo(s.x, s.z, layout).dist < half) expect(v).toBe(0);
      if (Math.hypot(s.x - layout.house.x, s.z - layout.house.z) < 5) expect(v).toBe(0);
    }
  });

  it("classifies spots no severity can change as static, and trees there really never change", () => {
    const slots = generateTreeSlots(layout, 600);
    for (const s of slots) {
      if (!isSeverityStatic(s.x, s.z, layout)) continue;
      expect(treeVisibility(s, layout, 1)).toBe(1);
      expect(terrainHeight(s.x, s.z, layout, 1)).toBeCloseTo(terrainHeight(s.x, s.z, layout, 0), 9);
    }
    expect(slots.some((s) => isSeverityStatic(s.x, s.z, layout))).toBe(true);
    expect(slots.some((s) => !isSeverityStatic(s.x, s.z, layout))).toBe(true);
  });

  it("leaves stumps where trees were felled, but not while they stand, nor on the road bed or house pad", () => {
    const slots = generateTreeSlots(layout, 1400);
    expect(slots.every((s) => stumpAmount(s, treeVisibility(s, layout, 0), layout, 0) === 0)).toBe(true);
    let stumps = 0;
    for (const s of slots) {
      const vis = treeVisibility(s, layout, 1);
      const amount = stumpAmount(s, vis, layout, 1);
      if (vis > 0.55) expect(amount).toBe(0);
      if (amount > 0.5) stumps++;
      if (roadInfo(s.x, s.z, layout).dist < half + 0.6) expect(amount).toBe(0);
      if (Math.hypot(s.x - layout.house.x, s.z - layout.house.z) < 5.5) expect(amount).toBe(0);
    }
    expect(stumps).toBeGreaterThan(10);
  });

  it("places felled logs only on cleared ground away from road and house, appearing with the clearing", () => {
    const logs = generateLogSlots(layout, 22);
    expect(logs.length).toBeGreaterThan(5);
    for (const l of logs) {
      expect(clearedAmount(l.x, l.z, layout, 1)).toBeGreaterThanOrEqual(0.9);
      expect(roadInfo(l.x, l.z, layout).dist).toBeGreaterThan(half);
      expect(logAmount(l, layout, 0)).toBe(0);
      expect(logAmount(l, layout, 1)).toBeGreaterThan(0.9);
    }
  });
});

describe("settlement plan", () => {
  it("is stable per layout and puts poles beside the road, not on it", () => {
    for (const zone of ZONES) {
      const layout = sceneLayoutForZone(zone);
      const plan = settlementPlan(layout);
      expect(settlementPlan(layout)).toBe(plan);
      expect(plan.poles.length).toBeGreaterThanOrEqual(2);
      for (const pole of plan.poles) {
        expect(roadInfo(pole.x, pole.z, layout).dist).toBeGreaterThanOrEqual(roadWidth / 2);
        expect(Math.hypot(pole.x, pole.z)).toBeLessThanOrEqual(layout.walkRadius + 32 + 1e-6);
      }
    }
  });

  it("keeps the homestead out of the road and gives obstacles only when built", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf");
    const plan = settlementPlan(layout);
    expect(settlementObstacles(layout, 0)).toHaveLength(0);
    const full = settlementObstacles(layout, 1);
    expect(full.length).toBeGreaterThan(plan.poles.length);
    for (const o of full) expect(o.r).toBeGreaterThan(0);
    const homestead = [
      ...plan.fence.map((p) => houseToWorld(layout, p.lx, p.lz)),
      houseToWorld(layout, plan.shed.lx, plan.shed.lz),
      houseToWorld(layout, plan.logStack.lx, plan.logStack.lz),
      ...plan.bananas.map((b) => houseToWorld(layout, b.lx, b.lz)),
    ];
    for (const p of homestead) expect(roadInfo(p.x, p.z, layout).dist).toBeGreaterThan(roadWidth / 2);
    expect(POLE_HEIGHT).toBeGreaterThan(6);
    expect(FENCE_SLAT_SPACING).toBeGreaterThan(0);
  });

  it("maps house-local points to world coordinates the way the scene rotates them", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf");
    const front = houseToWorld(layout, 0, 5);
    // Local +Z is the door side, which points at the road end.
    expect(front.x - layout.house.x).toBeCloseTo(Math.sin(layout.house.yaw) * 5, 9);
    expect(front.z - layout.house.z).toBeCloseTo(Math.cos(layout.house.yaw) * 5, 9);
  });
});

describe("real terrain", () => {
  it("omitting realTerrain leaves a zone's layout exactly as before this feature", () => {
    expect(sceneLayoutForZone("zone-cht-teknaf").realTerrain).toBeUndefined();
  });

  it("baseHeight follows the real grid's macro shape, centred on the reference point", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf", makeRealTerrainFixture());
    expect(layout.scarCenter).toEqual({ x: 0, z: 0 });
    // The fixture's hill peaks at 20 m at the origin; fine texture noise is
    // at most 0.9 m, so this should land close to 20, nowhere near the
    // unrelated synthetic hillHeight of 11.
    expect(baseHeight(0, 0, layout)).toBeGreaterThan(18);
    expect(baseHeight(0, 0, layout)).toBeLessThan(21);
    // Falls off with distance, matching the fixture's -0.3 m/m slope.
    expect(baseHeight(0, 0, layout)).toBeGreaterThan(baseHeight(30, 0, layout));
  });

  it("clearedAmount follows the real disturbance grid's shape, not a synthetic blob", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf", makeRealTerrainFixture());
    // Below the road/house appear threshold (0.55), so this isolates the
    // scar/disturbance term alone, wherever this seed happens to place the
    // road and house.
    const severity = 0.3;
    // Inside the fixture's disturbed disc (radius 15).
    expect(clearedAmount(0, 0, layout, severity)).toBeGreaterThan(0);
    // Outside it, but still well inside the walkable disc.
    expect(clearedAmount(35, 0, layout, severity)).toBe(0);
    // Still fades in with severity exactly as the synthetic scar does.
    expect(clearedAmount(0, 0, layout, 0)).toBe(0);
  });

  it("generateTreeSlots is pulled toward the grid's denser real areas, and its total scales with mean density", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf", makeRealTerrainFixture());
    const slots = generateTreeSlots(layout, 3000);
    // The fixture's 81-node grid has 9 zero-density nodes (radius < 20) and
    // 72 full-density ones, mean 72/81: the overall quota scales down from
    // 3000 by that mean, on top of (not instead of) the per-position
    // rejection below, since a grid that is uniformly sparse everywhere
    // has nothing for the per-position rejection alone to reduce.
    expect(slots).toHaveLength(Math.round(3000 * (72 / 81)));
    expect(generateTreeSlots(layout, 3000)).toEqual(slots); // still deterministic
    const nearFraction = slots.filter((s) => Math.hypot(s.x, s.z) < 18).length / slots.length;
    // Sampling is area-uniform inside the walkable disc's near band, so with
    // no density weighting roughly (18/72)^2 =~ 6% of trees would land
    // within radius 18. The fixture's density there is 0 (below the 0.08
    // floor only), so the real fraction should sit well under that.
    expect(nearFraction).toBeLessThan(0.03);
  });

  it("generateTreeSlots' total also drops when density is uniformly low, not just spatially varying", () => {
    // A real density timeline sample can read sparse across the *whole*
    // local window (e.g. the reference point measured as cleared or
    // flooded on one real date), with no spatial contrast for the
    // per-position rejection above to redistribute around. Only scaling
    // the quota itself catches that case.
    const base = makeRealTerrainFixture();
    const flooded = {
      ...base,
      density: { ...base.density, values: new Float32Array(base.density.values.length).fill(0.1) },
    };
    const layout = sceneLayoutForZone("zone-cht-teknaf", flooded);
    const slots = generateTreeSlots(layout, 3000);
    expect(slots).toHaveLength(300); // 3000 * max(0.08 floor, 0.1 mean density)
  });

  it("generateUndergrowthSlots is also pulled toward the denser real areas", () => {
    const layout = sceneLayoutForZone("zone-cht-teknaf", makeRealTerrainFixture());
    const slots = generateUndergrowthSlots(layout, 6000);
    const nearFraction = slots.filter((s) => Math.hypot(s.x, s.z) < 18).length / slots.length;
    // Unweighted, roughly 6% of slots would land within radius 18 (area
    // proportion of the sampling disc); the fixture's density there is 0
    // (floor-rate only), so the real fraction should sit clearly under that.
    expect(nearFraction).toBeLessThan(0.05);
  });

  it("realTerrainStops is empty without real terrain, and centred on the reference point with it", () => {
    const synthetic = sceneLayoutForZone("zone-cht-teknaf");
    expect(realTerrainStops(synthetic)).toEqual([]);

    const real = sceneLayoutForZone("zone-cht-teknaf", makeRealTerrainFixture());
    const stops = realTerrainStops(real);
    expect(stops.length).toBeGreaterThanOrEqual(1);
    expect(stops[0]).toEqual({ x: 0, z: 0, kind: "disturbance" });
    expect(realTerrainStops(real)).toEqual(stops); // cached, not re-derived each call
    const heights = real.realTerrain!.heights;
    for (const stop of stops) {
      expect(Math.hypot(stop.x, stop.z)).toBeLessThan(heights.width * heights.cellSize);
    }
  });
});
