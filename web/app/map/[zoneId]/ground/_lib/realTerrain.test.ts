import { describe, expect, it } from "vitest";
import {
  capGrid,
  densityTimelineRange,
  hasRealTerrain,
  nearestDensitySample,
  sampleGrid,
  type DensitySample,
  type Grid,
} from "./realTerrain";

/** 3x3 grid, 10 m cells, centred on the origin: values rise by 1 per cell
 *  along x and 10 per cell along z, so bilinear interpolation is easy to
 *  check by hand. */
function makeGrid(): Grid {
  // row-major: values[row * 3 + col], row = z index, col = x index.
  const values = new Float32Array([
    0, 1, 2, // z = -10
    10, 11, 12, // z = 0
    20, 21, 22, // z = 10
  ]);
  return { width: 3, height: 3, cellSize: 10, originX: -10, originZ: -10, values };
}

describe("sampleGrid", () => {
  it("returns exact values at grid nodes", () => {
    const grid = makeGrid();
    expect(sampleGrid(grid, -10, -10)).toBe(0);
    expect(sampleGrid(grid, 0, 0)).toBe(11);
    expect(sampleGrid(grid, 10, 10)).toBe(22);
  });

  it("interpolates linearly between nodes", () => {
    const grid = makeGrid();
    expect(sampleGrid(grid, -5, -10)).toBeCloseTo(0.5, 5);
    expect(sampleGrid(grid, 0, -10)).toBeCloseTo(1, 5);
    expect(sampleGrid(grid, -10, -5)).toBeCloseTo(5, 5);
    // Bilinear at the cell centre is the average of all four corners.
    expect(sampleGrid(grid, -5, -5)).toBeCloseTo((0 + 1 + 10 + 11) / 4, 5);
  });

  it("clamps to the nearest edge value beyond the grid's extent", () => {
    const grid = makeGrid();
    expect(sampleGrid(grid, -1000, -10)).toBe(0);
    expect(sampleGrid(grid, 1000, -10)).toBe(2);
    expect(sampleGrid(grid, -10, 1000)).toBe(20);
    expect(sampleGrid(grid, 1000, 1000)).toBe(22);
  });
});

describe("hasRealTerrain", () => {
  it("is true only for a zone with a real ground terrain pack", () => {
    expect(hasRealTerrain("zone-cht-teknaf")).toBe(true);
    expect(hasRealTerrain("zone-cht-lama")).toBe(false);
    expect(hasRealTerrain("zone-jamuna-kazipur")).toBe(false);
  });
});

function makeSample(date: string): DensitySample {
  return { date, grid: makeGrid() };
}

describe("nearestDensitySample", () => {
  const timeline = [makeSample("2000-01-01"), makeSample("2020-01-01"), makeSample("2026-07-01")];

  it("returns null for an empty timeline", () => {
    expect(nearestDensitySample([], "2026-01-01")).toBeNull();
  });

  it("snaps to the nearest real sample rather than interpolating", () => {
    expect(nearestDensitySample(timeline, "2000-01-01")).toBe(timeline[0]);
    expect(nearestDensitySample(timeline, "2010-06-01")).toBe(timeline[1]);
    expect(nearestDensitySample(timeline, "2026-12-31")).toBe(timeline[2]);
  });
});

describe("capGrid", () => {
  it("takes the element-wise minimum, so a healthy-NDVI cell on bare land-cover stays capped", () => {
    const ndvi: Grid = { width: 2, height: 1, cellSize: 10, originX: 0, originZ: 0, values: new Float32Array([0.9, 0.2]) };
    const landCover: Grid = { width: 2, height: 1, cellSize: 10, originX: 0, originZ: 0, values: new Float32Array([0.15, 0.95]) };
    const capped = capGrid(ndvi, landCover);
    expect(capped.values[0]).toBeCloseTo(0.15, 5);
    expect(capped.values[1]).toBeCloseTo(0.2, 5);
    // Shape/axes carried over from the first argument.
    expect(capped.width).toBe(2);
    expect(capped.cellSize).toBe(10);
  });
});

describe("densityTimelineRange", () => {
  it("is null for an empty timeline", () => {
    expect(densityTimelineRange([])).toBeNull();
  });

  it("spans the earliest to the latest real sample regardless of input order", () => {
    const timeline = [makeSample("2020-01-01"), makeSample("1990-01-01"), makeSample("2026-07-01")];
    expect(densityTimelineRange(timeline)).toEqual({ minIso: "1990-01-01", maxIso: "2026-07-01" });
  });
});
