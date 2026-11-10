import * as THREE from "three";
import { createRng } from "../../_lib/terrain";
import { F, W, crownColor } from "./treeGeometry";
import { MeshBuilder, SUN, addBlade, addBlob, addTube, clamp, smooth, type Vec3 } from "./meshBuilder";

/**
 * Small plants for the forest floor and the homestead. Same conventions as
 * the trees: base at the origin, metres at scale 1, vertex colour with baked
 * shading, one merged geometry per kind. Leaves are single-sided strips, so
 * these are drawn with a double-sided material.
 */

/** Sapling, nominal 4 m: a thin curved stem and two small leafy tufts. */
export function buildSapling(): THREE.BufferGeometry {
  const rng = createRng(5100);
  const b = new MeshBuilder();
  const a = rng() * Math.PI * 2;
  const at = (y: number): Vec3 => {
    const k = (y / 4) ** 2 * 0.5;
    return [Math.cos(a) * k, y, Math.sin(a) * k];
  };
  addTube(b, [0, 1, 2.2, 3.4].map(at), [0.07, 0.055, 0.04, 0.025], {
    sides: 4,
    colorAt: (out, t) => out.copy(W.trunk).lerp(W.pale, t * 0.5),
    capTop: W.trunk,
  });
  const top = at(3.4);
  const tint = F.bright.clone().lerp(F.mid, 0.4);
  const crown = (c: Vec3, r: Vec3) =>
    addBlob(b, [top[0] + c[0], c[1], top[2] + c[2]], r, rng, {
      detail: 0,
      lump: 0.3,
      flatBottom: 0.6,
      colorAt: (out, nx, ny, nz) => crownColor(out, tint, nx, ny, nz),
    });
  crown([0, 3.6, 0], [1.0, 0.95, 1.0]);
  crown([0.45, 2.6, -0.25], [0.8, 0.7, 0.8]);
  return b.build();
}

/** Fern, nominal 0.9 m: seven arching toothed fronds. */
export function buildFern(): THREE.BufferGeometry {
  const rng = createRng(5200);
  const b = new MeshBuilder();
  const n = 7;
  for (let k = 0; k < n; k++) {
    addBlade(b, [0, 0.04, 0], {
      length: 0.95 + rng() * 0.35,
      width: 0.17,
      segs: 3,
      lift: 0.75 - (k % 2) * 0.35,
      droop: 1.35,
      azimuth: (k / n) * Math.PI * 2 + rng() * 0.4,
      serrate: 0.4,
      colorAt: (out, t) => out.copy(F.shadow).lerp(F.under, smooth(t, 0, 0.35)).lerp(F.sunlit, smooth(t, 0.4, 1) * 0.55),
    });
  }
  return b.build();
}

/** Shrub, nominal 1.1 m: a dense mound of broad arching leaves around a dark core. */
export function buildShrub(): THREE.BufferGeometry {
  const rng = createRng(5300);
  const b = new MeshBuilder();
  const core = F.shadow.clone().lerp(F.under, 0.35);
  addBlob(b, [0, 0.38, 0], [0.38, 0.34, 0.38], rng, {
    detail: 0,
    lump: 0.25,
    flatBottom: 0.5,
    colorAt: (out) => out.copy(core),
  });
  const n = 11;
  for (let k = 0; k < n; k++) {
    addBlade(b, [0, 0.12 + (k % 3) * 0.1, 0], {
      length: 0.7 + rng() * 0.35,
      width: 0.26,
      segs: 2,
      lift: 0.3 + (k % 3) * 0.35,
      droop: 1.0,
      azimuth: (k / n) * Math.PI * 2 + rng() * 0.5,
      colorAt: (out, t) => out.copy(F.shadow).lerp(F.mid, 0.35 + t * 0.55).lerp(F.bright, smooth(t, 0.5, 1) * 0.4),
    });
  }
  return b.build();
}

/** Grass tuft, nominal 0.7 m: a bundle of thin bent blades. */
export function buildGrass(): THREE.BufferGeometry {
  const rng = createRng(5400);
  const b = new MeshBuilder();
  const n = 8;
  for (let k = 0; k < n; k++) {
    const dryBlade = rng() < 0.2;
    addBlade(b, [(rng() - 0.5) * 0.12, 0, (rng() - 0.5) * 0.12], {
      length: 0.55 + rng() * 0.35,
      width: 0.05,
      segs: 2,
      lift: 1.15 + (rng() - 0.5) * 0.3,
      droop: 0.9 + rng() * 0.6,
      azimuth: rng() * Math.PI * 2,
      profile: (t) => 1 - t * 0.92,
      colorAt: (out, t) => out.copy(F.under).lerp(dryBlade ? F.dry : F.lime, smooth(t, 0, 1) * 0.8),
    });
  }
  return b.build();
}

/** Big-leaf plant (ginger / taro-like), nominal 1.5 m: paddle leaves on stems. */
export function buildPaddle(): THREE.BufferGeometry {
  const rng = createRng(5500);
  const b = new MeshBuilder();
  const n = 4;
  for (let k = 0; k < n; k++) {
    addBlade(b, [0, 0.05, 0], {
      length: 1.5 + rng() * 0.3,
      width: 0.42,
      segs: 4,
      lift: 1.0 - (k % 2) * 0.3,
      droop: 1.5,
      azimuth: (k / n) * Math.PI * 2 + rng() * 0.8,
      rib: 0.25,
      // A narrow stalk for the first third, then the broad blade.
      profile: (t) => (t < 0.3 ? 0.06 : Math.pow(Math.sin(Math.PI * (0.3 + 0.7 * ((t - 0.3) / 0.7) * 0.97)), 0.7)),
      colorAt: (out, t, side) => {
        out.copy(F.shadow).lerp(F.palm, smooth(t, 0.1, 0.5)).lerp(F.bright, smooth(t, 0.5, 1) * 0.6);
        return out.multiplyScalar(0.88 + 0.12 * (1 - Math.abs(side - 0.5) * 2));
      },
    });
  }
  return b.build();
}

/** Banana plant, nominal 3 m: a pseudostem with a crown of arching paddle leaves. */
export function buildBanana(): THREE.BufferGeometry {
  const rng = createRng(5600);
  const b = new MeshBuilder();
  addTube(b, [[0, 0, 0], [0.03, 1.0, 0], [0.06, 2.0, 0.03], [0.07, 2.4, 0.03]], [0.15, 0.13, 0.1, 0.07], {
    sides: 6,
    colorAt: (out, t, nx, _ny, nz) => {
      out.copy(F.under).lerp(F.bamboo, 0.45 + 0.4 * t);
      return out.multiplyScalar(0.8 + 0.3 * clamp(nx * SUN.x + nz * SUN.z + 0.3));
    },
    capTop: F.shadow,
  });
  const n = 7;
  for (let k = 0; k < n; k++) {
    addBlade(b, [0.07, 2.35, 0.03], {
      length: 1.9 + rng() * 0.4,
      width: 0.5,
      segs: 4,
      lift: 1.0 - (k % 3) * 0.3,
      droop: 1.6 + rng() * 0.4,
      azimuth: k * 2.4 + rng() * 0.3,
      rib: 0.28,
      colorAt: (out, t, side) => {
        out.copy(F.shadow).lerp(F.palm, smooth(t, 0, 0.3)).lerp(F.bright, smooth(t, 0.3, 1) * 0.6);
        if (k % 3 === 0) out.lerp(F.dry, smooth(t, 0.55, 1) * 0.6);
        return out.multiplyScalar(0.9 + 0.1 * (1 - Math.abs(side - 0.5) * 2));
      },
    });
  }
  return b.build();
}

export const UNDERGROWTH_BUILDERS: Array<() => THREE.BufferGeometry> = [
  buildFern,
  buildShrub,
  buildGrass,
  buildPaddle,
  buildSapling,
];
