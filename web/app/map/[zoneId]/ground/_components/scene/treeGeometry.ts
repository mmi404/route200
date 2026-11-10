import * as THREE from "three";
import { LOOK } from "../../_lib/look";
import { createRng } from "../../_lib/terrain";
import {
  MeshBuilder,
  SUN,
  addBlade,
  addBlob,
  addTube,
  clamp,
  smooth,
  type Vec3,
} from "./meshBuilder";

/**
 * The scene's tree species, each one merged coloured geometry (trunk, limbs
 * and crown in a single mesh) with its base at the origin, +Y up, authored in
 * metres at scale 1. Two level-of-detail builds per species: `hi` for what
 * the visitor can walk up to, `lo` for the far ridge.
 *
 * Vertex colour carries the shading baked from the sun direction (lit crown
 * tops, dark crown undersides, a trunk darkening to the base); the per-
 * instance colour then tints each tree so neighbours differ.
 */

export type Lod = 0 | 1; // 0 = hi, 1 = lo

const col = (hex: string) => new THREE.Color(hex);
export const F = {
  deep: col(LOOK.foliage.deep),
  mid: col(LOOK.foliage.mid),
  bright: col(LOOK.foliage.bright),
  lime: col(LOOK.foliage.lime),
  palm: col(LOOK.foliage.palm),
  bamboo: col(LOOK.foliage.bamboo),
  under: col(LOOK.foliage.undergrowth),
  shadow: col(LOOK.foliage.shadow),
  sunlit: col(LOOK.foliage.sunlit),
  dry: col(LOOK.foliage.dry),
};
export const W = {
  dark: col(LOOK.wood.trunkDark),
  trunk: col(LOOK.wood.trunk),
  pale: col(LOOK.wood.trunkPale),
  cut: col(LOOK.wood.cut),
  weathered: col(LOOK.wood.weathered),
};

/** Crown/leaf colour at an outward direction: dark where it faces away from
 *  the sun and down, `base` in the middle, sunlit lime on top. */
export function crownColor(out: THREE.Color, base: THREE.Color, nx: number, ny: number, nz: number): THREE.Color {
  const lit = clamp(0.5 + 0.5 * (nx * SUN.x + ny * SUN.y + nz * SUN.z));
  const s = clamp(0.5 * lit + 0.5 * (ny * 0.5 + 0.5));
  if (s < 0.5) out.copy(F.shadow).lerp(base, 0.15 + (s / 0.5) * 0.85);
  else out.copy(base).lerp(F.sunlit, ((s - 0.5) / 0.5) * 0.7);
  return out;
}

/** Straight-trunk bark colour: dark at the root, paling up the stem, one flank
 *  catching the sun. `t` is the position along the tube, 0..1. */
function barkColor(low: THREE.Color, high: THREE.Color, rise: number) {
  return (out: THREE.Color, t: number, nx: number, _ny: number, nz: number): THREE.Color => {
    out.copy(low).lerp(high, smooth(t, 0, rise));
    return out.multiplyScalar(0.8 + 0.32 * clamp(nx * SUN.x + nz * SUN.z + 0.3));
  };
}

const blobTint = (rng: () => number, base: THREE.Color): THREE.Color => {
  const c = base.clone();
  const r = rng();
  if (r < 0.3) c.lerp(F.deep, 0.35);
  else if (r > 0.7) c.lerp(F.lime, 0.28);
  return c;
};

/** Tint family per species so crowns read differently from far away. */
const CROWN_BASE = {
  canopyA: F.mid,
  canopyB: F.deep.clone().lerp(F.mid, 0.6),
  midA: F.bright,
  midB: F.mid.clone().lerp(F.lime, 0.35),
};

// ---------------------------------------------------------------------------
// 1. Tall broadleaf canopy tree (garjan-like), nominal 14 m.
// ---------------------------------------------------------------------------

export function buildCanopyTree(variant: 0 | 1, lod: Lod): THREE.BufferGeometry {
  const rng = createRng(1000 + variant * 977);
  const b = new MeshBuilder();
  const H = 14;
  const leanAngle = rng() * Math.PI * 2;
  const lean = 0.5 + rng() * 0.6;
  const trunkAt = (y: number): Vec3 => {
    const k = (y / H) ** 2 * lean * 3.2;
    const wiggle = Math.sin(y * 0.45 + variant * 2.1) * 0.12;
    return [Math.cos(leanAngle) * k + wiggle, y, Math.sin(leanAngle) * k + wiggle * 0.5];
  };
  const ys = lod === 0 ? [0, 0.3, 1.0, 2.4, 4.2, 6.2, 8.2, 10.4] : [0, 3.5, 7.5, 10.4];
  const radii = lod === 0 ? [0.56, 0.4, 0.33, 0.3, 0.27, 0.24, 0.19, 0.12] : [0.5, 0.3, 0.2, 0.12];
  addTube(
    b,
    ys.map(trunkAt),
    radii,
    {
      sides: lod === 0 ? 7 : 5,
      colorAt: barkColor(W.dark, W.pale, 0.35),
      capTop: W.trunk,
      roughness: lod === 0 ? 0.06 : 0,
      rng,
    },
  );
  const top = trunkAt(10.4);
  const base = variant === 0 ? CROWN_BASE.canopyA : CROWN_BASE.canopyB;

  if (lod === 0) {
    // Buttress fins: thin wedges flaring out of the root, two coincident
    // triangles back to back so they read from either side.
    const finCol = W.dark;
    for (let k = 0; k < 3; k++) {
      const a = rng() * Math.PI * 2 + k * 2.1;
      const dx = Math.cos(a);
      const dz = Math.sin(a);
      const up: Vec3 = [dx * 0.3, 1.5, dz * 0.3];
      const out: Vec3 = [dx * 0.85, -0.05, dz * 0.85];
      const root: Vec3 = [dx * 0.4, -0.05, dz * 0.4];
      b.tri(up, root, out, finCol, W.dark, W.dark);
      b.tri(up, out, root, finCol, W.dark, W.dark);
    }
  }

  const blob = (c: Vec3, r: Vec3, detail: 0 | 1, tint = blobTint(rng, base)) =>
    addBlob(b, [top[0] + c[0], c[1], top[2] + c[2]], r, rng, {
      detail,
      lump: 0.26,
      flatBottom: 0.7,
      colorAt: (out, nx, ny, nz) => crownColor(out, tint, nx, ny, nz),
    });

  if (lod === 0) {
    blob([0, 11.7, 0], [2.4, 1.9, 2.4], 1);
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2 + rng() * 0.7;
      const d = 1.8 + rng() * 0.9;
      const c: Vec3 = [Math.cos(a) * d, 9.5 + rng() * 1.3, Math.sin(a) * d];
      blob(c, [2.6 + rng() * 0.6, 1.7 + rng() * 0.4, 2.6 + rng() * 0.6], 1);
      const from = trunkAt(8.0 + k * 0.5);
      addTube(b, [from, [from[0] + c[0] * 0.5, from[1] + 0.9, from[2] + c[2] * 0.5], [top[0] + c[0], c[1] - 0.6, top[2] + c[2]]], [0.15, 0.1, 0.06], {
        sides: 4,
        colorAt: barkColor(W.trunk, W.pale, 0.5),
      });
    }
  } else {
    blob([0, 11.6, 0], [3.2, 2.4, 3.2], 0);
    blob([2.0, 9.6, 0.6], [2.6, 1.8, 2.6], 0);
    blob([-1.8, 9.9, -0.8], [2.6, 1.8, 2.6], 0);
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// 2. Mid-storey tree: short forked trunk, low wide crown, nominal 8 m.
// ---------------------------------------------------------------------------

export function buildMidTree(variant: 0 | 1, lod: Lod): THREE.BufferGeometry {
  const rng = createRng(2000 + variant * 733);
  const b = new MeshBuilder();
  const forkY = 2.7;
  const lean = (rng() * 2 - 1) * 0.35;
  const trunk: Vec3[] =
    lod === 0
      ? [[0, 0, 0], [0.02, 0.25, 0], [0.04 + lean * 0.1, 0.9, 0], [lean * 0.4, 1.8, 0.05], [lean * 0.7, forkY, 0.1]]
      : [[0, 0, 0], [lean * 0.4, 1.6, 0], [lean * 0.7, forkY, 0.1]];
  const trunkR = lod === 0 ? [0.46, 0.34, 0.28, 0.25, 0.22] : [0.4, 0.27, 0.22];
  addTube(b, trunk, trunkR, {
    sides: lod === 0 ? 7 : 5,
    colorAt: barkColor(W.dark, W.trunk, 0.5),
    capTop: W.trunk,
    roughness: lod === 0 ? 0.07 : 0,
    rng,
  });
  const fork = trunk[trunk.length - 1];
  const base = variant === 0 ? CROWN_BASE.midA : CROWN_BASE.midB;
  const limbs = lod === 0 ? 3 : 2;
  const a0 = rng() * Math.PI * 2;
  for (let k = 0; k < limbs; k++) {
    const a = a0 + (k / limbs) * Math.PI * 2 + (rng() - 0.5) * 0.5;
    const reach = 1.7 + rng() * 0.8;
    const endY = 4.6 + rng() * 1.0;
    const end: Vec3 = [fork[0] + Math.cos(a) * reach, endY, fork[2] + Math.sin(a) * reach];
    if (lod === 0) {
      addTube(b, [fork, [fork[0] + Math.cos(a) * reach * 0.35, forkY + 0.9, fork[2] + Math.sin(a) * reach * 0.35], end], [0.2, 0.14, 0.08], {
        sides: 5,
        colorAt: barkColor(W.trunk, W.pale, 0.6),
      });
    }
    const tint = blobTint(rng, base);
    addBlob(b, [end[0], end[1] + 0.9, end[2]], [2.2 + rng() * 0.4, 1.7 + rng() * 0.3, 2.2 + rng() * 0.4], rng, {
      detail: lod === 0 ? 1 : 0,
      lump: 0.24,
      flatBottom: 0.8,
      colorAt: (out, nx, ny, nz) => crownColor(out, tint, nx, ny, nz),
    });
  }
  const tint = blobTint(rng, base);
  addBlob(b, [fork[0], 6.3, fork[2]], [2.0, 1.7, 2.0], rng, {
    detail: lod === 0 ? 1 : 0,
    lump: 0.24,
    flatBottom: 0.8,
    colorAt: (out, nx, ny, nz) => crownColor(out, tint, nx, ny, nz),
  });
  return b.build();
}

// ---------------------------------------------------------------------------
// 3. Palm (betel / coconut-like): slim curved ringed trunk and a fronds rosette, ~10 m.
// ---------------------------------------------------------------------------

export function buildPalm(lod: Lod): THREE.BufferGeometry {
  const rng = createRng(3100);
  const b = new MeshBuilder();
  const H = 10;
  const bend = rng() * Math.PI * 2;
  const rings = lod === 0 ? 11 : 4;
  const at = (y: number): Vec3 => {
    const k = (y / H) ** 2 * 1.5;
    return [Math.cos(bend) * k, y, Math.sin(bend) * k];
  };
  const pts: Vec3[] = [];
  const radii: number[] = [];
  for (let i = 0; i < rings; i++) {
    const y = (i / (rings - 1)) * H;
    pts.push(at(y));
    radii.push(i === 0 ? 0.2 : 0.135 - 0.02 * (i / rings) + (i === rings - 1 ? 0.03 : 0));
  }
  addTube(b, pts, radii, {
    sides: lod === 0 ? 6 : 4,
    colorAt: (out, t, nx, _ny, nz) => {
      const band = Math.round(t * (rings - 1)) % 2;
      out.copy(W.pale).lerp(W.dark, 0.1 + (lod === 0 ? band * 0.3 : 0.15) + (1 - smooth(t, 0, 0.12)) * 0.3);
      return out.multiplyScalar(0.82 + 0.3 * clamp(nx * SUN.x + nz * SUN.z + 0.3));
    },
    capTop: F.shadow,
  });
  const top = at(H);
  const fronds = lod === 0 ? 10 : 6;
  for (let k = 0; k < fronds; k++) {
    const t = k / fronds;
    addBlade(b, [top[0], top[1] - 0.05, top[2]], {
      length: 3.0 + rng() * 0.9,
      width: lod === 0 ? 0.4 : 0.55,
      segs: lod === 0 ? 5 : 2,
      lift: 0.95 - (k % 3) * 0.5 + (rng() - 0.5) * 0.2,
      droop: 1.5 + rng() * 0.8,
      azimuth: t * Math.PI * 2 + rng() * 0.3,
      rib: lod === 0 ? 0.3 : 0,
      serrate: lod === 0 ? 0.45 : 0,
      colorAt: (out, tt, side) => {
        out.copy(F.shadow).lerp(F.palm, smooth(tt, 0, 0.3));
        out.lerp(F.sunlit, smooth(tt, 0.3, 1) * 0.5);
        return out.multiplyScalar(0.85 + 0.15 * Math.abs(side - 0.5) * 2);
      },
    });
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// 4. Bamboo clump: a fan of arching jointed culms with leaf tufts, ~8 m.
// ---------------------------------------------------------------------------

export function buildBamboo(lod: Lod): THREE.BufferGeometry {
  const rng = createRng(4200);
  const b = new MeshBuilder();
  const culms = lod === 0 ? 6 : 4;
  const nodeCount = lod === 0 ? 6 : 3;
  for (let k = 0; k < culms; k++) {
    const a = (k / culms) * Math.PI * 2 + rng() * 0.6;
    const baseR = 0.15 + rng() * 0.45;
    const bx = Math.cos(a) * baseR;
    const bz = Math.sin(a) * baseR;
    const height = 6.2 + rng() * 3.4;
    const bendAmount = 1.0 + rng() * 1.8;
    const pts: Vec3[] = [];
    const radii: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const t = i / (nodeCount - 1);
      const out = bendAmount * t ** 2.3;
      pts.push([bx + Math.cos(a) * out, height * t * (1 - 0.1 * t * t), bz + Math.sin(a) * out]);
      radii.push(0.05 * (1 - 0.5 * t));
    }
    addTube(b, pts, radii, {
      sides: lod === 0 ? 4 : 3,
      colorAt: (out, t, nx, _ny, nz) => {
        const node = Math.round(t * (nodeCount - 1)) % 2;
        out.copy(F.bamboo).lerp(F.dry, 0.25 * t);
        out.multiplyScalar(node ? 0.78 : 1);
        return out.multiplyScalar(0.85 + 0.25 * clamp(nx * SUN.x + nz * SUN.z + 0.3));
      },
      capTop: F.bamboo,
    });
    // Leaf tufts: at the tip and, on the high build, lower on the culm.
    const tufts: Array<[Vec3, number]> = [[pts[nodeCount - 1], 5]];
    if (lod === 0) tufts.push([pts[nodeCount - 2], 3]);
    for (const [p, n] of tufts) {
      for (let i = 0; i < n; i++) {
        addBlade(b, p, {
          length: 1.0 + rng() * 0.6,
          width: lod === 0 ? 0.13 : 0.2,
          segs: 2,
          lift: -0.2 + rng() * 0.8,
          droop: 1.0,
          azimuth: (i / n) * Math.PI * 2 + rng(),
          colorAt: (out, tt) => out.copy(F.mid).lerp(F.lime, smooth(tt, 0.2, 1) * 0.6),
        });
      }
    }
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Ridge tree: the cheapest tree (one lumpy blob on a stub), for the far slopes
// where only the skyline and the colour of the forest carry.
// ---------------------------------------------------------------------------

export function buildRidgeTree(seed: number, tintBase: THREE.Color): THREE.BufferGeometry {
  const rng = createRng(6000 + seed * 131);
  const b = new MeshBuilder();
  addTube(b, [[0, -0.5, 0], [0, 4.2, 0]], [0.5, 0.3], {
    sides: 4,
    colorAt: barkColor(W.dark, W.trunk, 1),
    capTop: W.trunk,
  });
  addBlob(b, [0, 7.6, 0], [3.4 + rng() * 0.6, 3.2 + rng() * 0.6, 3.4 + rng() * 0.6], rng, {
    detail: 0,
    lump: 0.22,
    flatBottom: 0.7,
    colorAt: (out, nx, ny, nz) => crownColor(out, tintBase, nx, ny, nz),
  });
  return b.build();
}

// ---------------------------------------------------------------------------
// Felling leftovers: stump and log.
// ---------------------------------------------------------------------------

/** A cut trunk base ~0.55 m tall at scale 1, root flare, pale cut top. */
export function buildStump(): THREE.BufferGeometry {
  const rng = createRng(555);
  const b = new MeshBuilder();
  const top = 0.55;
  const sides = 8;
  const radii = [0.44, 0.33, 0.3, 0.3];
  const ys = [-0.12, 0.1, 0.34, top];
  const pts: Vec3[] = ys.map((y) => [0, y, 0]);
  addTube(b, pts, radii, {
    sides,
    colorAt: barkColor(W.dark, W.trunk, 0.7),
    roughness: 0.08,
    rng,
  });
  // Cut face: pale rim, slightly darker heart (growth rings read as a two-tone disc).
  const rim = W.cut;
  const heart = W.cut.clone().multiplyScalar(0.82);
  const y = top + 0.001;
  for (let s = 0; s < sides; s++) {
    const a0 = (s / sides) * Math.PI * 2;
    const a1 = ((s + 1) / sides) * Math.PI * 2;
    const r = radii[3];
    const p0: Vec3 = [Math.cos(a0) * r, y, Math.sin(a0) * r];
    const p1: Vec3 = [Math.cos(a1) * r, y, Math.sin(a1) * r];
    const q0: Vec3 = [Math.cos(a0) * r * 0.45, y + 0.012, Math.sin(a0) * r * 0.45];
    const q1: Vec3 = [Math.cos(a1) * r * 0.45, y + 0.012, Math.sin(a1) * r * 0.45];
    b.quad(p1, p0, q0, q1, rim, rim, heart, heart);
    b.tri([0, y + 0.012, 0], q1, q0, heart);
  }
  return b.build();
}

/** A felled log lying along +X (centred, length 1, radius 1: scale non-uniformly). */
export function buildLog(): THREE.BufferGeometry {
  const rng = createRng(777);
  const b = new MeshBuilder();
  addTube(
    b,
    [[-0.5, 0, 0], [-0.15, 0, 0], [0.2, 0, 0], [0.5, 0, 0]],
    [0.95, 1, 0.98, 0.93],
    {
      sides: 7,
      colorAt: (out, _t, nx, ny, nz) => {
        out.copy(W.dark).lerp(W.trunk, 0.5 + 0.5 * clamp(ny * 0.6 + nx * SUN.x + nz * SUN.z));
        return out;
      },
      capTop: W.cut,
      capBottom: W.cut,
      roughness: 0.05,
      rng,
    },
  );
  return b.build();
}

// ---------------------------------------------------------------------------
// Species table
// ---------------------------------------------------------------------------

export interface TreeSpecies {
  name: string;
  hi: THREE.BufferGeometry;
  lo: THREE.BufferGeometry;
  /** Cheapest build, for the far ridge. */
  far: THREE.BufferGeometry;
  /** Needs a double-sided material (single-sided leaf cards). */
  doubleSided: boolean;
  /** Share of the stump radius vs. the standard stump. */
  stumpRadius: number;
  /** Whether it sways (height-weighted vertex shader) at all. */
  tall: boolean;
}

export function buildTreeSpecies(): TreeSpecies[] {
  const palmTint = F.palm.clone().lerp(F.bright, 0.3);
  const bambooTint = F.bamboo.clone().lerp(F.mid, 0.5);
  return [
    { name: "canopyA", hi: buildCanopyTree(0, 0), lo: buildCanopyTree(0, 1), far: buildRidgeTree(0, CROWN_BASE.canopyA), doubleSided: false, stumpRadius: 1, tall: true },
    { name: "canopyB", hi: buildCanopyTree(1, 0), lo: buildCanopyTree(1, 1), far: buildRidgeTree(1, CROWN_BASE.canopyB), doubleSided: false, stumpRadius: 1, tall: true },
    { name: "midA", hi: buildMidTree(0, 0), lo: buildMidTree(0, 1), far: buildRidgeTree(2, CROWN_BASE.midA), doubleSided: false, stumpRadius: 0.85, tall: true },
    { name: "midB", hi: buildMidTree(1, 0), lo: buildMidTree(1, 1), far: buildRidgeTree(3, CROWN_BASE.midB), doubleSided: false, stumpRadius: 0.85, tall: true },
    { name: "palm", hi: buildPalm(0), lo: buildPalm(1), far: buildRidgeTree(4, palmTint), doubleSided: true, stumpRadius: 0.5, tall: true },
    { name: "bamboo", hi: buildBamboo(0), lo: buildBamboo(1), far: buildRidgeTree(5, bambooTint), doubleSided: true, stumpRadius: 0.55, tall: true },
  ];
}
