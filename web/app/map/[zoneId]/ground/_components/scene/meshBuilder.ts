import * as THREE from "three";
import { SUN_DIRECTION } from "../../_lib/look";

/**
 * A tiny procedural-mesh toolkit for the scene's vegetation and props: every
 * shape is assembled in code from triangles with per-vertex colour, so the
 * scene needs no model or texture files. Output geometry is non-indexed with
 * flat face normals (the stylised faceted look) and a `color` attribute that
 * the instance colour then tints.
 */

export type Vec3 = readonly [number, number, number];

export const SUN = new THREE.Vector3(...SUN_DIRECTION).normalize();

export function clamp(value: number, lo = 0, hi = 1): number {
  return Math.max(lo, Math.min(hi, value));
}

export function smooth(value: number, a: number, b: number): number {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
}

/** Scratch colours so builders never allocate per vertex. */
const scratch = Array.from({ length: 6 }, () => new THREE.Color());
export function tmpColor(i = 0): THREE.Color {
  return scratch[i];
}

export class MeshBuilder {
  private readonly pos: number[] = [];
  private readonly col: number[] = [];

  get triangleCount(): number {
    return this.pos.length / 9;
  }

  tri(a: Vec3, b: Vec3, c: Vec3, ca: THREE.Color, cb: THREE.Color = ca, cc: THREE.Color = ca): void {
    this.pos.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
  }

  /** Counter-clockwise quad a, b, c, d (outward normal by the right-hand rule). */
  quad(
    a: Vec3,
    b: Vec3,
    c: Vec3,
    d: Vec3,
    ca: THREE.Color,
    cb: THREE.Color = ca,
    cc: THREE.Color = ca,
    cd: THREE.Color = ca,
  ): void {
    this.tri(a, b, c, ca, cb, cc);
    this.tri(a, c, d, ca, cc, cd);
  }

  build(): THREE.BufferGeometry {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(this.pos, 3));
    geo.setAttribute("color", new THREE.Float32BufferAttribute(this.col, 3));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }
}

function norm(v: [number, number, number]): [number, number, number] {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

function cross(a: Vec3, b: Vec3): [number, number, number] {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

// ---------------------------------------------------------------------------
// Tube: a tapered, optionally curved, optionally closed prism along a path.
// Used for trunks, limbs, culms, poles, logs.
// ---------------------------------------------------------------------------

export interface TubeOptions {
  sides: number;
  /** Colour of ring `ring` (0..1 along the path) at outward direction n. */
  colorAt: (out: THREE.Color, t: number, nx: number, ny: number, nz: number) => THREE.Color;
  /** Colour of a flat cap on the top end; omit for an open end. */
  capTop?: THREE.Color;
  /** Colour of the cap on the bottom end; omit for an open end. */
  capBottom?: THREE.Color;
  /** 0..1 random wobble of each ring vertex's radius (rough bark, splintered tops). */
  roughness?: number;
  rng?: () => number;
}

const REF: Vec3 = [0.31, 0.12, 0.94];

export function addTube(b: MeshBuilder, pts: Vec3[], radii: number[], opts: TubeOptions): void {
  const { sides } = opts;
  const rings: Array<{ p: Vec3; u: [number, number, number]; v: [number, number, number]; r: number[] }> = [];
  for (let i = 0; i < pts.length; i++) {
    const prev = pts[Math.max(0, i - 1)];
    const next = pts[Math.min(pts.length - 1, i + 1)];
    const t = norm([next[0] - prev[0], next[1] - prev[1], next[2] - prev[2]]);
    let ref: Vec3 = REF;
    if (Math.abs(t[0] * REF[0] + t[1] * REF[1] + t[2] * REF[2]) > 0.95) ref = [0, 1, 0];
    const u = norm(cross(ref, t));
    const v = cross(t, u) as [number, number, number];
    const rr: number[] = [];
    for (let s = 0; s < sides; s++) {
      const wobble = opts.roughness && opts.rng ? 1 + (opts.rng() * 2 - 1) * opts.roughness : 1;
      rr.push(radii[i] * wobble);
    }
    rings.push({ p: pts[i], u, v, r: rr });
  }
  const vert = (ring: (typeof rings)[number], s: number): [number, number, number] => {
    const a = (s / sides) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const r = ring.r[s % sides];
    return [
      ring.p[0] + (ring.u[0] * c + ring.v[0] * sn) * r,
      ring.p[1] + (ring.u[1] * c + ring.v[1] * sn) * r,
      ring.p[2] + (ring.u[2] * c + ring.v[2] * sn) * r,
    ];
  };
  const normalAt = (ring: (typeof rings)[number], s: number): [number, number, number] => {
    const a = (s / sides) * Math.PI * 2;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return [ring.u[0] * c + ring.v[0] * sn, ring.u[1] * c + ring.v[1] * sn, ring.u[2] * c + ring.v[2] * sn];
  };
  const last = rings.length - 1;
  const cols = Array.from({ length: 4 }, () => new THREE.Color());
  for (let i = 0; i < last; i++) {
    const t0 = i / last;
    const t1 = (i + 1) / last;
    for (let s = 0; s < sides; s++) {
      const n0 = normalAt(rings[i], s);
      const n1 = normalAt(rings[i], s + 1);
      opts.colorAt(cols[0], t0, n0[0], n0[1], n0[2]);
      opts.colorAt(cols[1], t0, n1[0], n1[1], n1[2]);
      const m0 = normalAt(rings[i + 1], s);
      const m1 = normalAt(rings[i + 1], s + 1);
      opts.colorAt(cols[2], t1, m1[0], m1[1], m1[2]);
      opts.colorAt(cols[3], t1, m0[0], m0[1], m0[2]);
      b.quad(
        vert(rings[i], s),
        vert(rings[i], s + 1),
        vert(rings[i + 1], s + 1),
        vert(rings[i + 1], s),
        cols[0],
        cols[1],
        cols[2],
        cols[3],
      );
    }
  }
  if (opts.capTop) {
    const ring = rings[last];
    for (let s = 0; s < sides; s++) b.tri(ring.p, vert(ring, s), vert(ring, s + 1), opts.capTop);
  }
  if (opts.capBottom) {
    const ring = rings[0];
    for (let s = 0; s < sides; s++) b.tri(ring.p, vert(ring, s + 1), vert(ring, s), opts.capBottom);
  }
}

// ---------------------------------------------------------------------------
// Blob: a lumpy low-poly ellipsoid, the building block of crowns, shrubs, rocks.
// ---------------------------------------------------------------------------

const icoCache = new Map<number, Float32Array>();
function icoPositions(detail: number): Float32Array {
  const cached = icoCache.get(detail);
  if (cached) return cached;
  let geo: THREE.BufferGeometry = new THREE.IcosahedronGeometry(1, detail);
  if (geo.index) geo = geo.toNonIndexed();
  const arr = Float32Array.from(geo.attributes.position.array as ArrayLike<number>);
  geo.dispose();
  icoCache.set(detail, arr);
  return arr;
}

export interface BlobOptions {
  detail: 0 | 1;
  /** Surface lumpiness, 0 (smooth ellipsoid) .. ~0.4. */
  lump: number;
  /** Colour at a vertex given its outward unit direction. */
  colorAt: (out: THREE.Color, nx: number, ny: number, nz: number) => THREE.Color;
  /** Multiplies the lower hemisphere's vertical radius (1 = round, <1 = flat bottom). */
  flatBottom?: number;
}

export function addBlob(b: MeshBuilder, center: Vec3, radii: Vec3, rng: () => number, opts: BlobOptions): void {
  const src = icoPositions(opts.detail);
  const ph = [rng() * 6.28, rng() * 6.28, rng() * 6.28, rng() * 6.28];
  const fb = opts.flatBottom ?? 1;
  const verts: Array<[number, number, number]> = [];
  const cols = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  for (let i = 0; i < src.length; i += 9) {
    verts.length = 0;
    for (let k = 0; k < 3; k++) {
      const x = src[i + k * 3];
      const y = src[i + k * 3 + 1];
      const z = src[i + k * 3 + 2];
      const len = Math.hypot(x, y, z);
      const nx = x / len;
      const ny = y / len;
      const nz = z / len;
      const d =
        1 +
        opts.lump *
          (Math.sin(nx * 3.1 + ph[0]) * Math.sin(ny * 2.7 + ph[1]) +
            0.7 * Math.sin(nz * 3.9 + ph[2]) * Math.cos(nx * 2.3 + ph[3]));
      verts.push([
        center[0] + nx * radii[0] * d,
        center[1] + ny * radii[1] * d * (ny < 0 ? fb : 1),
        center[2] + nz * radii[2] * d,
      ]);
      opts.colorAt(cols[k], nx, ny, nz);
    }
    b.tri(verts[0], verts[1], verts[2], cols[0], cols[1], cols[2]);
  }
}

// ---------------------------------------------------------------------------
// Blade: a leaf strip that rises at `lift`, then droops, with optional
// serrated edge and a raised mid-rib. Meant to be drawn double-sided.
// ---------------------------------------------------------------------------

export interface BladeOptions {
  length: number;
  width: number;
  segs: number;
  /** Initial elevation above horizontal, radians (negative = pointing down). */
  lift: number;
  /** Total bend over the blade's length, radians (positive droops). */
  droop: number;
  azimuth: number;
  /** Raises the mid line by this share of the width (0 = flat strip). */
  rib?: number;
  /** 0..1 how deeply alternate cross-sections are narrowed (toothed edge). */
  serrate?: number;
  /** Width over t (0 base .. 1 tip); defaults to a leaf shape. */
  profile?: (t: number) => number;
  colorAt: (out: THREE.Color, t: number, side: number) => THREE.Color;
}

const leafProfile = (t: number): number => Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.75);

export function addBlade(b: MeshBuilder, origin: Vec3, o: BladeOptions): void {
  const dirH: [number, number] = [Math.cos(o.azimuth), Math.sin(o.azimuth)];
  const side: Vec3 = [-dirH[1], 0, dirH[0]];
  const profile = o.profile ?? leafProfile;
  const step = o.length / o.segs;
  const cross3 = o.rib ? 3 : 2;
  const rows: Array<Array<[number, number, number]>> = [];
  const colors: THREE.Color[][] = [];
  let px = origin[0];
  let py = origin[1];
  let pz = origin[2];
  for (let i = 0; i <= o.segs; i++) {
    const t = i / o.segs;
    const theta = o.lift - o.droop * Math.pow(t, 1.3);
    const dx = dirH[0] * Math.cos(theta);
    const dy = Math.sin(theta);
    const dz = dirH[1] * Math.cos(theta);
    const w = o.width * profile(t) * (o.serrate && i % 2 === 1 ? 1 - o.serrate : 1);
    // Up-ish normal of the blade: side x dir.
    const n = norm(cross(side, [dx, dy, dz]));
    const row: Array<[number, number, number]> = [[px - side[0] * w, py, pz - side[2] * w]];
    if (o.rib) row.push([px + n[0] * w * o.rib, py + n[1] * w * o.rib, pz + n[2] * w * o.rib]);
    row.push([px + side[0] * w, py, pz + side[2] * w]);
    rows.push(row);
    const rowColors: THREE.Color[] = [];
    for (let j = 0; j < cross3; j++) {
      const c = new THREE.Color();
      o.colorAt(c, t, j / (cross3 - 1));
      rowColors.push(c);
    }
    colors.push(rowColors);
    px += dx * step;
    py += dy * step;
    pz += dz * step;
  }
  for (let i = 0; i < o.segs; i++) {
    for (let j = 0; j < cross3 - 1; j++) {
      b.quad(
        rows[i][j],
        rows[i + 1][j],
        rows[i + 1][j + 1],
        rows[i][j + 1],
        colors[i][j],
        colors[i + 1][j],
        colors[i + 1][j + 1],
        colors[i][j + 1],
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Box helpers for the house and props.
// ---------------------------------------------------------------------------

/** Axis-aligned box from min to max corner; `bottom` tints the lower vertices
 *  (a cheap height gradient), `top` the upper ones. */
export function addBox(
  b: MeshBuilder,
  min: Vec3,
  max: Vec3,
  top: THREE.Color,
  bottom: THREE.Color = top,
): void {
  const [x0, y0, z0] = min;
  const [x1, y1, z1] = max;
  const p = (x: number, y: number, z: number): Vec3 => [x, y, z];
  // +Z
  b.quad(p(x0, y0, z1), p(x1, y0, z1), p(x1, y1, z1), p(x0, y1, z1), bottom, bottom, top, top);
  // -Z
  b.quad(p(x1, y0, z0), p(x0, y0, z0), p(x0, y1, z0), p(x1, y1, z0), bottom, bottom, top, top);
  // +X
  b.quad(p(x1, y0, z1), p(x1, y0, z0), p(x1, y1, z0), p(x1, y1, z1), bottom, bottom, top, top);
  // -X
  b.quad(p(x0, y0, z0), p(x0, y0, z1), p(x0, y1, z1), p(x0, y1, z0), bottom, bottom, top, top);
  // +Y
  b.quad(p(x0, y1, z1), p(x1, y1, z1), p(x1, y1, z0), p(x0, y1, z0), top);
  // -Y
  b.quad(p(x0, y0, z0), p(x1, y0, z0), p(x1, y0, z1), p(x0, y0, z1), bottom);
}

/** A box rotated about Y around its own centre, then placed at `center`. */
export function addBoxRotated(
  b: MeshBuilder,
  center: Vec3,
  size: Vec3,
  yaw: number,
  top: THREE.Color,
  bottom: THREE.Color = top,
  pitch = 0,
): void {
  const sub = new MeshBuilder();
  addBox(sub, [-size[0] / 2, -size[1] / 2, -size[2] / 2], [size[0] / 2, size[1] / 2, size[2] / 2], top, bottom);
  const geo = sub.build();
  geo.rotateX(pitch);
  geo.rotateY(yaw);
  geo.translate(center[0], center[1], center[2]);
  appendGeometry(b, geo);
  geo.dispose();
}

/** Copy a non-indexed coloured geometry's triangles into a builder. */
export function appendGeometry(b: MeshBuilder, geo: THREE.BufferGeometry): void {
  const p = geo.attributes.position.array;
  const c = geo.attributes.color.array;
  const col = [new THREE.Color(), new THREE.Color(), new THREE.Color()];
  for (let i = 0; i < p.length; i += 9) {
    for (let k = 0; k < 3; k++) col[k].setRGB(c[i + k * 3], c[i + k * 3 + 1], c[i + k * 3 + 2]);
    b.tri(
      [p[i], p[i + 1], p[i + 2]],
      [p[i + 3], p[i + 4], p[i + 5]],
      [p[i + 6], p[i + 7], p[i + 8]],
      col[0],
      col[1],
      col[2],
    );
  }
}

/** Bake a transform into a copy of a geometry's triangles (for assembling
 *  several instances of one shape into a single mesh). */
export function addTransformed(b: MeshBuilder, geo: THREE.BufferGeometry, matrix: THREE.Matrix4): void {
  const copy = geo.clone();
  copy.applyMatrix4(matrix);
  appendGeometry(b, copy);
  copy.dispose();
}
