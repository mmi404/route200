import { describe, expect, it } from "vitest";
import type * as THREE from "three";
import { buildLog, buildStump, buildTreeSpecies } from "./treeGeometry";
import { UNDERGROWTH_BUILDERS, buildBanana } from "./plantGeometry";

function triangles(geo: THREE.BufferGeometry): number {
  return geo.attributes.position.count / 3;
}

function assertSound(geo: THREE.BufferGeometry, maxHeight: number): void {
  const pos = geo.attributes.position.array;
  for (let i = 0; i < pos.length; i++) expect(Number.isFinite(pos[i])).toBe(true);
  const col = geo.attributes.color.array;
  for (let i = 0; i < col.length; i++) expect(Number.isFinite(col[i])).toBe(true);
  geo.computeBoundingBox();
  const box = geo.boundingBox as THREE.Box3;
  expect(box.max.y).toBeLessThan(maxHeight);
  expect(box.min.y).toBeGreaterThan(-1);
}

describe("vegetation geometry", () => {
  const species = buildTreeSpecies();

  it("builds finite, upright geometry for every species and detail level", () => {
    const heights = [18, 18, 12, 12, 13, 12];
    species.forEach((s, i) => {
      assertSound(s.hi, heights[i]);
      assertSound(s.lo, heights[i]);
      assertSound(s.far, 13);
      expect(triangles(s.far)).toBeLessThan(triangles(s.lo) + 1);
      expect(triangles(s.lo)).toBeLessThan(triangles(s.hi));
    });
  });

  it("keeps trunk bases near the collision radius", () => {
    // The widest point within the first 0.2 m is the root flare; it should
    // sit within 0.3 to 0.9 m of the axis for the two big species.
    for (const s of species.slice(0, 4)) {
      const pos = s.hi.attributes.position;
      let widest = 0;
      for (let i = 0; i < pos.count; i++) {
        if (pos.getY(i) < 0.2) widest = Math.max(widest, Math.hypot(pos.getX(i), pos.getZ(i)));
      }
      expect(widest).toBeGreaterThan(0.25);
      expect(widest).toBeLessThan(0.95);
    }
  });

  it("faces the stump's cut top and the log's cut ends outward", () => {
    const stump = buildStump();
    const pos = stump.attributes.position;
    const nrm = stump.attributes.normal;
    let capTriangles = 0;
    for (let i = 0; i < pos.count; i += 3) {
      if (pos.getY(i) > 0.54 && pos.getY(i + 1) > 0.54 && pos.getY(i + 2) > 0.54) {
        capTriangles++;
        expect(nrm.getY(i)).toBeGreaterThan(0.9);
      }
    }
    expect(capTriangles).toBeGreaterThan(8);
    const log = buildLog();
    const lp = log.attributes.position;
    const ln = log.attributes.normal;
    let ends = 0;
    for (let i = 0; i < lp.count; i += 3) {
      const x0 = lp.getX(i);
      if (Math.abs(x0) > 0.499 && Math.abs(lp.getX(i + 1)) > 0.499 && Math.abs(lp.getX(i + 2)) > 0.499) {
        ends++;
        expect(ln.getX(i) * Math.sign(x0)).toBeGreaterThan(0.9);
      }
    }
    expect(ends).toBeGreaterThan(10);
  });

  it("stays inside the triangle budget per instance", () => {
    const counts = species.map((s) => ({ name: s.name, hi: triangles(s.hi), lo: triangles(s.lo), far: triangles(s.far) }));
    // Logged so the budget is easy to read when tuning.
    console.info("tree triangles", JSON.stringify(counts));
    const plants = UNDERGROWTH_BUILDERS.map((build) => triangles(build()));
    console.info("undergrowth triangles", JSON.stringify(plants), "stump", triangles(buildStump()), "log", triangles(buildLog()), "banana", triangles(buildBanana()));
    for (const c of counts) expect(c.hi).toBeLessThan(900);
    for (const t of plants) expect(t).toBeLessThan(130);
  });
});
