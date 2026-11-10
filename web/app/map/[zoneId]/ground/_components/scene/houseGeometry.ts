import * as THREE from "three";
import { LOOK } from "../../_lib/look";
import { HOUSE_SIZE, POLE_HEIGHT, createRng } from "../../_lib/terrain";
import {
  MeshBuilder,
  SUN,
  addBlob,
  addBox,
  addBoxRotated,
  addTransformed,
  addTube,
  clamp,
  type Vec3,
} from "./meshBuilder";
import { F, W, buildLog } from "./treeGeometry";

/**
 * Procedural geometry for the homestead and the road furniture. The house is
 * built in its own frame: x along the 6 m width, z across the 4.5 m depth with
 * +Z the door side (toward the road), y up. Each construction stage is its own
 * mesh whose origin sits at the stage's base, so it can be scaled upward in
 * place (see PROGRESS.md on scaling parents versus pieces).
 */

const col = (hex: string) => new THREE.Color(hex);
const H = {
  wall: col(LOOK.house.wall),
  wallShade: col(LOOK.house.wallShade),
  plinth: col(LOOK.house.plinth),
  plinthShade: col(LOOK.house.plinthShade),
  door: col(LOOK.house.door),
  frame: col(LOOK.house.frame),
  interior: col(LOOK.house.interior),
  insulator: col(LOOK.house.insulator),
  cloth: col(LOOK.house.cloth),
  rust: col(LOOK.house.roofRust),
  tin: col(LOOK.house.roofTin),
  rock: col(LOOK.ground.rock),
  bamboo: col(LOOK.foliage.bamboo),
};
const white = new THREE.Color(1, 1, 1);
const tint = (c: THREE.Color, k: number) => c.clone().multiplyScalar(k);

export const HALF_W = HOUSE_SIZE.width / 2;
export const HALF_D = HOUSE_SIZE.depth / 2;
export const WALL_H = HOUSE_SIZE.wallHeight;

/** Plinth: its mesh origin is at world y = PLINTH_BASE (below the pad, so it
 *  never floats), its top at PLINTH_TOP. Walls and everything above start there. */
export const PLINTH_BASE = -0.5;
export const PLINTH_TOP = 0.55;

/** Gable roof numbers, in metres above the wall base (y = PLINTH_TOP). */
export const ROOF = {
  /** Eave overhang past the wall face, front and back. */
  eaveZ: HALF_D + 0.55,
  ridgeY: 3.8,
  /** tan of the pitch angle. */
  slope: 0.445,
  sheetWidth: 0.77,
  /** Sheets per slope. */
  sheetsPerSlope: 9,
} as const;
export const ROOF_PITCH = Math.atan(ROOF.slope);
export const EAVE_Y = ROOF.ridgeY - ROOF.eaveZ * ROOF.slope;
export const SLOPE_LENGTH = ROOF.eaveZ / Math.cos(ROOF_PITCH);

// ---------------------------------------------------------------------------
// Plinth
// ---------------------------------------------------------------------------

export function buildPlinth(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const top = tint(H.plinth, 1.08);
  const base = H.plinthShade;
  // y is measured from PLINTH_BASE.
  addBox(b, [-3.3, 0, -2.55], [3.3, 1.05, 2.55], top, base);
  // Veranda slab, a little lower than the main floor.
  addBox(b, [-1.95, 0.1, 2.55], [1.95, 0.95, 4.35], top, base);
  // Front step.
  addBox(b, [-0.85, 0.1, 4.35], [0.85, 0.55, 5.0], top, base);
  return b.build();
}

// ---------------------------------------------------------------------------
// Frame: posts, wall plates, door frame. Origin at the wall base.
// ---------------------------------------------------------------------------

export function buildFrame(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const top = H.frame;
  const bottom = tint(H.frame, 0.7);
  const post = (x: number, z: number) => addBox(b, [x - 0.1, -0.02, z - 0.1], [x + 0.1, 2.75, z + 0.1], top, bottom);
  for (const x of [-HALF_W, -1, 1, HALF_W]) {
    post(x, HALF_D);
    post(x, -HALF_D);
  }
  post(-HALF_W, 0);
  post(HALF_W, 0);
  // Wall plates along the top and a mid rail.
  for (const z of [-HALF_D, HALF_D]) {
    addBox(b, [-HALF_W - 0.1, 2.6, z - 0.09], [HALF_W + 0.1, 2.76, z + 0.09], top);
    addBox(b, [-HALF_W, 1.3, z - 0.06], [HALF_W, 1.4, z + 0.06], top);
  }
  for (const x of [-HALF_W, HALF_W]) {
    addBox(b, [x - 0.09, 2.6, -HALF_D], [x + 0.09, 2.76, HALF_D], top);
    addBox(b, [x - 0.06, 1.3, -HALF_D], [x + 0.06, 1.4, HALF_D], top);
  }
  // Door frame on the front.
  addBox(b, [-0.62, 0, HALF_D - 0.07], [-0.5, 2.12, HALF_D + 0.07], top, bottom);
  addBox(b, [0.5, 0, HALF_D - 0.07], [0.62, 2.12, HALF_D + 0.07], top, bottom);
  addBox(b, [-0.62, 2.0, HALF_D - 0.07], [0.62, 2.12, HALF_D + 0.07], top);
  return b.build();
}

// ---------------------------------------------------------------------------
// Walls: plank faces with openings, darker base band, gables. Origin at the wall base.
// ---------------------------------------------------------------------------

interface Opening {
  a0: number;
  a1: number;
  y0: number;
  y1: number;
}

export interface WindowSpec {
  /** Which wall: +z front, -z back, +x right, -x left. */
  face: "+z" | "-z" | "+x" | "-x";
  /** Position along the wall (x for z-faces, z for x-faces). */
  at: number;
  closed: boolean;
}

export const WINDOWS: WindowSpec[] = [
  { face: "+z", at: -1.75, closed: true },
  { face: "+z", at: 1.75, closed: true },
  { face: "-z", at: 1.2, closed: false },
  { face: "-x", at: 0, closed: false },
  { face: "+x", at: 0.4, closed: true },
];
const WIN_Y0 = 0.95;
const WIN_Y1 = 1.85;
const WIN_HALF = 0.45;
const DOOR: Opening = { a0: -0.5, a1: 0.5, y0: 0, y1: 2.05 };
const BAND = 0.5;

function faceQuad(
  b: MeshBuilder,
  face: WindowSpec["face"],
  fixed: number,
  a0: number,
  a1: number,
  y0: number,
  y1: number,
  top: THREE.Color,
  bottom: THREE.Color,
): void {
  const p = (a: number, y: number): Vec3 => {
    switch (face) {
      case "+z":
        return [a, y, fixed];
      case "-z":
        return [a, y, fixed];
      default:
        return [fixed, y, a];
    }
  };
  // Counter-clockwise seen from outside.
  const forward = face === "+z" || face === "-x";
  const [s0, s1] = forward ? [a0, a1] : [a1, a0];
  b.quad(p(s0, y0), p(s1, y0), p(s1, y1), p(s0, y1), bottom, bottom, top, top);
}

function wallFace(
  b: MeshBuilder,
  face: WindowSpec["face"],
  fixed: number,
  length: number,
  openings: Opening[],
  rng: () => number,
): void {
  const sorted = [...openings].sort((p, q) => p.a0 - q.a0);
  const rects: Opening[] = [];
  let cursor = -length / 2;
  for (const o of sorted) {
    if (o.a0 > cursor) rects.push({ a0: cursor, a1: o.a0, y0: 0, y1: WALL_H });
    if (o.y0 > 0) rects.push({ a0: o.a0, a1: o.a1, y0: 0, y1: o.y0 });
    if (o.y1 < WALL_H) rects.push({ a0: o.a0, a1: o.a1, y0: o.y1, y1: WALL_H });
    cursor = o.a1;
  }
  if (cursor < length / 2) rects.push({ a0: cursor, a1: length / 2, y0: 0, y1: WALL_H });
  const baseBand = tint(H.wallShade, 0.82);
  for (const r of rects) {
    const n = Math.max(1, Math.round((r.a1 - r.a0) / 0.42));
    for (let i = 0; i < n; i++) {
      const a0 = r.a0 + ((r.a1 - r.a0) * i) / n;
      const a1 = r.a0 + ((r.a1 - r.a0) * (i + 1)) / n;
      const k = 0.93 + rng() * 0.14;
      if (r.y0 < BAND) {
        const yTop = Math.min(r.y1, BAND);
        faceQuad(b, face, fixed, a0, a1, r.y0, yTop, tint(baseBand, k), tint(baseBand, k * 0.8));
      }
      if (r.y1 > BAND) {
        const yBot = Math.max(r.y0, BAND);
        faceQuad(b, face, fixed, a0, a1, yBot, r.y1, tint(H.wall, k), tint(H.wall, k * 0.94));
      }
    }
  }
}

function gable(b: MeshBuilder, x: number, sign: 1 | -1, rng: () => number): void {
  const roofAtWall = ROOF.ridgeY - HALF_D * ROOF.slope - 0.06;
  const apex = ROOF.ridgeY - 0.06;
  const pts: Vec3[] = [
    [x, WALL_H, -HALF_D],
    [x, WALL_H, HALF_D],
    [x, roofAtWall, HALF_D],
    [x, apex, 0],
    [x, roofAtWall, -HALF_D],
  ];
  const c = tint(H.wall, 0.9 + rng() * 0.05);
  const low = tint(H.wall, 0.82);
  const order = sign > 0 ? [1, 0, 4, 3, 2] : [0, 1, 2, 3, 4];
  const [p0, p1, p2, p3, p4] = order.map((i) => pts[i]);
  b.tri(p0, p1, p2, low, low, c);
  b.tri(p0, p2, p3, low, c, c);
  b.tri(p0, p3, p4, low, c, c);
}

export function buildWalls(): THREE.BufferGeometry {
  const rng = createRng(8800);
  const b = new MeshBuilder();
  const winOpen = (c: number): Opening => ({ a0: c - WIN_HALF, a1: c + WIN_HALF, y0: WIN_Y0, y1: WIN_Y1 });
  const on = (face: WindowSpec["face"]) => WINDOWS.filter((w) => w.face === face).map((w) => winOpen(w.at));
  wallFace(b, "+z", HALF_D, HOUSE_SIZE.width, [DOOR, ...on("+z")], rng);
  wallFace(b, "-z", -HALF_D, HOUSE_SIZE.width, on("-z"), rng);
  wallFace(b, "+x", HALF_W, HOUSE_SIZE.depth, on("+x"), rng);
  wallFace(b, "-x", -HALF_W, HOUSE_SIZE.depth, on("-x"), rng);
  gable(b, HALF_W, 1, rng);
  gable(b, -HALF_W, -1, rng);
  return b.build();
}

// ---------------------------------------------------------------------------
// Openings: door leaf, window frames, shutters. Origin at the wall base.
// ---------------------------------------------------------------------------

function windowParts(closed: boolean): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const f = H.frame;
  addBox(b, [-0.54, 0.45, -0.05], [0.54, 0.56, 0.1], f);
  addBox(b, [-0.56, -0.56, -0.05], [0.56, -0.45, 0.16], f);
  addBox(b, [-0.54, -0.45, -0.05], [-0.45, 0.45, 0.1], f);
  addBox(b, [0.45, -0.45, -0.05], [0.54, 0.45, 0.1], f);
  // Dark interior seen through the opening.
  b.quad([-0.45, -0.45, -0.1], [0.45, -0.45, -0.1], [0.45, 0.45, -0.1], [-0.45, 0.45, -0.1], H.interior);
  const leaf = tint(H.door, 1.1);
  if (closed) {
    addBox(b, [-0.46, -0.45, 0.1], [-0.01, 0.45, 0.14], leaf, tint(leaf, 0.85));
    addBox(b, [0.01, -0.45, 0.1], [0.46, 0.45, 0.14], leaf, tint(leaf, 0.85));
    addBox(b, [-0.46, -0.05, 0.14], [0.46, 0.03, 0.16], tint(H.frame, 1.1));
  } else {
    const phi = 1.25;
    const half = 0.225;
    addBoxRotated(b, [-0.5 + Math.cos(phi) * half, 0, 0.12 + Math.sin(phi) * half], [0.45, 0.9, 0.04], -phi, leaf, tint(leaf, 0.85));
    addBoxRotated(b, [0.5 - Math.cos(phi) * half, 0, 0.12 + Math.sin(phi) * half], [0.45, 0.9, 0.04], Math.PI + phi, leaf, tint(leaf, 0.85));
  }
  return b.build();
}

export function buildOpenings(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  // Door leaf with two battens, slightly recessed in its frame.
  addBox(b, [-0.5, 0, HALF_D - 0.05], [0.5, 2.03, HALF_D + 0.02], H.door, tint(H.door, 0.8));
  addBox(b, [-0.5, 0.45, HALF_D + 0.02], [0.5, 0.58, HALF_D + 0.045], tint(H.frame, 1.05));
  addBox(b, [-0.5, 1.45, HALF_D + 0.02], [0.5, 1.58, HALF_D + 0.045], tint(H.frame, 1.05));
  // Door step stone.
  addBox(b, [-0.6, -0.04, HALF_D + 0.02], [0.6, 0.0, HALF_D + 0.4], tint(H.plinth, 1.1));
  const yaw: Record<WindowSpec["face"], number> = { "+z": 0, "-z": Math.PI, "+x": Math.PI / 2, "-x": -Math.PI / 2 };
  const closed = windowParts(true);
  const open = windowParts(false);
  for (const w of WINDOWS) {
    const m = new THREE.Matrix4().makeRotationY(yaw[w.face]);
    const yc = (WIN_Y0 + WIN_Y1) / 2;
    if (w.face === "+z") m.setPosition(w.at, yc, HALF_D);
    else if (w.face === "-z") m.setPosition(w.at, yc, -HALF_D);
    else if (w.face === "+x") m.setPosition(HALF_W, yc, w.at);
    else m.setPosition(-HALF_W, yc, w.at);
    addTransformed(b, w.closed ? closed : open, m);
  }
  closed.dispose();
  open.dispose();
  return b.build();
}

// ---------------------------------------------------------------------------
// Roof: corrugated sheet (instanced), rafter (instanced), ridge and fascia.
// ---------------------------------------------------------------------------

/** A corrugated sheet, origin on its eave edge, running to -Z (up-slope), centred on x. */
export function buildSheet(length = SLOPE_LENGTH + 0.04): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const w = ROOF.sheetWidth;
  const waves = 4;
  const cols = waves * 4;
  const amp = 0.032;
  const colorAt = (i: number): THREE.Color => {
    const s = Math.sin((i / cols) * waves * Math.PI * 2);
    return tint(white, 0.86 + 0.14 * s);
  };
  for (let i = 0; i < cols; i++) {
    const x0 = -w / 2 + (w * i) / cols;
    const x1 = -w / 2 + (w * (i + 1)) / cols;
    const y0 = amp * Math.sin((i / cols) * waves * Math.PI * 2);
    const y1 = amp * Math.sin(((i + 1) / cols) * waves * Math.PI * 2);
    const c0 = colorAt(i);
    const c1 = colorAt(i + 1);
    // Eave edge slightly darker (shadowed lip), up-slope end lighter.
    const lip = tint(c0, 0.82);
    const lip1 = tint(c1, 0.82);
    b.quad([x0, y0, 0], [x1, y1, 0], [x1, y1, -length * 0.12], [x0, y0, -length * 0.12], lip, lip1, c1, c0);
    b.quad([x0, y0, -length * 0.12], [x1, y1, -length * 0.12], [x1, y1, -length], [x0, y0, -length], c0, c1, c1, c0);
  }
  return b.build();
}

/** A rafter: a beam from the eave to the ridge, origin at the eave end. */
export function buildRafter(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  addBox(b, [-0.035, -0.12, -SLOPE_LENGTH], [0.035, -0.04, 0.3], H.frame, tint(H.frame, 0.8));
  return b.build();
}

/** Ridge beam, fascia boards and the ridge cap. Origin at the wall base. */
export function buildRoofTrim(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const len = ROOF.sheetsPerSlope * ROOF.sheetWidth;
  addBox(b, [-len / 2, ROOF.ridgeY - 0.14, -0.06], [len / 2, ROOF.ridgeY - 0.04, 0.06], H.frame);
  for (const s of [-1, 1]) {
    const z = s * ROOF.eaveZ;
    addBox(b, [-len / 2, EAVE_Y - 0.17, z - 0.03], [len / 2, EAVE_Y + 0.0, z + 0.03], tint(H.frame, 0.9));
  }
  // Ridge cap: two strips folded over the ridge.
  const cap = tint(H.tin, 1.15);
  const capLight = tint(cap, 1.1);
  const half = 0.3;
  const dz = Math.cos(ROOF_PITCH) * half;
  const dy = Math.sin(ROOF_PITCH) * half;
  const y = ROOF.ridgeY + 0.045;
  b.quad([-len / 2, y, 0], [len / 2, y, 0], [len / 2, y - dy, dz], [-len / 2, y - dy, dz], capLight, capLight, cap, cap);
  b.quad([len / 2, y, 0], [-len / 2, y, 0], [-len / 2, y - dy, -dz], [len / 2, y - dy, -dz], capLight, capLight, cap, cap);
  return b.build();
}

// ---------------------------------------------------------------------------
// Veranda: posts, front beam, rafters. Origin at the veranda slab top.
// ---------------------------------------------------------------------------

export const VERANDA = { eaveZ: 4.45, eaveY: 2.28, wallY: 2.72, wallZ: HALF_D + 0.1 } as const;
export const VERANDA_PITCH = Math.atan((VERANDA.wallY - VERANDA.eaveY) / (VERANDA.eaveZ - VERANDA.wallZ));
export const VERANDA_LENGTH = (VERANDA.eaveZ - VERANDA.wallZ) / Math.cos(VERANDA_PITCH);

export function buildVeranda(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const top = H.frame;
  const bottom = tint(H.frame, 0.7);
  // y is measured from the slab top, which is 0.1 below the main floor.
  const beamY = VERANDA.eaveY + 0.1 - 0.17;
  for (const x of [-1.7, 1.7]) addBox(b, [x - 0.07, -0.05, 4.25], [x + 0.07, beamY + 0.1, 4.39], top, bottom);
  addBox(b, [-1.95, beamY, 4.2], [1.95, beamY + 0.14, 4.44], top);
  // Sloping rafters from the house wall down to the front beam.
  const zMid = (VERANDA.wallZ + 4.44) / 2;
  const yMid = (VERANDA.wallY + VERANDA.eaveY) / 2 + 0.1 - 0.12;
  for (const x of [-1.5, -0.5, 0.5, 1.5]) {
    addBoxRotated(b, [x, yMid, zMid], [0.06, 0.07, VERANDA_LENGTH], 0, tint(top, 0.9), tint(top, 0.8), VERANDA_PITCH);
  }
  return b.build();
}

// ---------------------------------------------------------------------------
// Cowshed: four posts, back wall of slats, trough. Origin at ground centre.
// ---------------------------------------------------------------------------

export const SHED = { width: 2.4, depth: 2.2, frontH: 2.1, backH: 1.7 } as const;
export const SHED_PITCH = Math.atan((SHED.frontH - SHED.backH) / SHED.depth);
export const SHED_LENGTH = (SHED.depth + 0.5) / Math.cos(SHED_PITCH);

export function buildShed(): THREE.BufferGeometry {
  const rng = createRng(9900);
  const b = new MeshBuilder();
  const wood = tint(W.weathered, 1.15);
  const dark = tint(W.weathered, 0.75);
  const hw = SHED.width / 2;
  const hd = SHED.depth / 2;
  // Posts sink 0.5 m so the shed stands on uneven ground.
  for (const x of [-hw, hw]) {
    addBox(b, [x - 0.06, -0.5, hd - 0.06], [x + 0.06, SHED.frontH, hd + 0.06], wood, dark);
    addBox(b, [x - 0.06, -0.5, -hd - 0.06], [x + 0.06, SHED.backH, -hd + 0.06], wood, dark);
  }
  // Roof beams front and back, side rails.
  addBox(b, [-hw - 0.1, SHED.frontH - 0.1, hd - 0.05], [hw + 0.1, SHED.frontH + 0.02, hd + 0.05], wood);
  addBox(b, [-hw - 0.1, SHED.backH - 0.1, -hd - 0.05], [hw + 0.1, SHED.backH + 0.02, -hd + 0.05], wood);
  // Back wall of vertical bamboo slats.
  const slats = 14;
  for (let i = 0; i < slats; i++) {
    const x0 = -hw + (SHED.width * i) / slats;
    const x1 = -hw + (SHED.width * (i + 1)) / slats;
    const c = tint(H.bamboo.clone().lerp(W.cut, 0.4), 0.7 + rng() * 0.22);
    b.quad([x1, 0.05, -hd], [x0, 0.05, -hd], [x0, SHED.backH - 0.1, -hd], [x1, SHED.backH - 0.1, -hd], tint(c, 0.8), tint(c, 0.8), c, c);
  }
  // Half-height slat walls on the sides.
  for (const s of [-1, 1]) {
    const n = 9;
    for (let i = 0; i < n; i++) {
      const z0 = -hd + (SHED.depth * i) / n;
      const z1 = -hd + (SHED.depth * (i + 1)) / n;
      const c = tint(H.bamboo.clone().lerp(W.cut, 0.4), 0.7 + rng() * 0.22);
      const x = s * hw;
      const top = 1.0;
      if (s > 0) b.quad([x, 0.05, z1], [x, 0.05, z0], [x, top, z0], [x, top, z1], tint(c, 0.8), tint(c, 0.8), c, c);
      else b.quad([x, 0.05, z0], [x, 0.05, z1], [x, top, z1], [x, top, z0], tint(c, 0.8), tint(c, 0.8), c, c);
    }
  }
  // Trough and a heap of straw.
  addBox(b, [-0.6, 0, 0.2], [0.6, 0.35, 0.62], wood, dark);
  addBox(b, [-0.5, 0.35, 0.28], [0.5, 0.38, 0.54], tint(H.interior, 1.4));
  const rngStraw = createRng(31);
  addBlob(b, [0.2, 0.15, -0.5], [0.7, 0.3, 0.55], rngStraw, {
    detail: 0,
    lump: 0.2,
    colorAt: (out, _nx, ny) => out.copy(F.dry).lerp(W.cut, 0.35 + 0.3 * ny),
  });
  return b.build();
}

// ---------------------------------------------------------------------------
// Smaller props
// ---------------------------------------------------------------------------

/** A stack of cut logs, origin at the ground centre. Ends show the pale cut wood. */
export function buildLogStack(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const log = buildLog();
  const rows: Array<[number, number][]> = [
    [[-0.24, 0.11], [0, 0.11], [0.24, 0.11]],
    [[-0.12, 0.31], [0.12, 0.31]],
    [[0, 0.5]],
  ];
  const rng = createRng(1234);
  for (const row of rows) {
    for (const [z, y] of row) {
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3((rng() - 0.5) * 0.12, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, (rng() - 0.5) * 0.1, 0)),
        new THREE.Vector3(1.5 + rng() * 0.2, 0.11, 0.11),
      );
      addTransformed(b, log, m);
    }
  }
  log.dispose();
  return b.build();
}

/** Two bamboo poles and washing, origin at the first pole's foot; the second
 *  pole is `spanX`, `spanZ` away. Cloth is single-sided (draw double-sided). */
export function buildClothesline(spanX: number, spanZ: number): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const poleColor = (out: THREE.Color, t: number) => out.copy(H.bamboo).multiplyScalar(0.7 + 0.2 * t);
  for (const [x, z] of [[0, 0], [spanX, spanZ]]) {
    addTube(b, [[x, -0.3, z], [x + 0.02, 1.2, z], [x, 2.35, z]], [0.045, 0.04, 0.03], { sides: 5, colorAt: poleColor, capTop: H.bamboo });
  }
  const clothes: Array<[number, number, THREE.Color]> = [
    [0.22, 0.46, H.cloth],
    [0.5, 0.5, H.rust],
    [0.76, 0.4, tint(H.cloth, 0.8)],
  ];
  for (const [t, width, c] of clothes) {
    const cx = spanX * t;
    const cz = spanZ * t;
    const len = Math.hypot(spanX, spanZ);
    const dx = (spanX / len) * (width / 2);
    const dz = (spanZ / len) * (width / 2);
    const y0 = 1.65;
    const y1 = 2.28;
    b.quad([cx - dx, y0, cz - dz], [cx + dx, y0, cz + dz], [cx + dx, y1, cz + dz], [cx - dx, y1, cz - dz], tint(c, 0.9), tint(c, 0.9), c, c);
  }
  return b.build();
}

/** Fence slat: a pointed bamboo pole. Origin at its foot. */
export function buildFenceSlat(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  addTube(b, [[0, -0.2, 0], [0, 0.6, 0], [0, 1.2, 0]], [0.04, 0.036, 0.03], {
    sides: 4,
    colorAt: (out, t) => out.copy(W.weathered).lerp(H.bamboo, 0.35 + 0.3 * t).multiplyScalar(0.85 + 0.2 * t),
  });
  const tip = H.bamboo;
  const r = 0.03;
  const y = 1.2;
  b.tri([-r, y, -r], [r, y, -r], [0, y + 0.1, 0], tip);
  b.tri([r, y, -r], [r, y, r], [0, y + 0.1, 0], tip);
  b.tri([r, y, r], [-r, y, r], [0, y + 0.1, 0], tip);
  b.tri([-r, y, r], [-r, y, -r], [0, y + 0.1, 0], tip);
  return b.build();
}

/** Unit rail: a thin bar along +X from 0 to 1 (scale x to the span). */
export function buildFenceRail(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  addBox(b, [0, -0.025, -0.025], [1, 0.025, 0.025], tint(W.weathered, 1.1), tint(W.weathered, 0.8));
  return b.build();
}

/** Utility pole: tapered pole, cross-arm with three insulators. Origin at the foot. */
export function buildPole(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const h = POLE_HEIGHT;
  const pts: Vec3[] = [[0, -0.6, 0], [0, 2, 0], [0, 4, 0], [0, 6, 0], [0, h, 0]];
  addTube(b, pts, [0.18, 0.155, 0.13, 0.11, 0.09], {
    sides: 6,
    colorAt: (out, t, nx, _ny, nz) => {
      out.copy(W.dark).lerp(W.weathered, 0.35 + 0.5 * t);
      return out.multiplyScalar(0.8 + 0.3 * clamp(nx * SUN.x + nz * SUN.z + 0.3));
    },
    capTop: W.dark,
  });
  const armY = h - 0.55;
  addBox(b, [-0.95, armY, -0.06], [0.95, armY + 0.12, 0.06], W.weathered, W.dark);
  for (const x of [-0.8, 0, 0.8]) {
    addBox(b, [x - 0.045, armY + 0.12, -0.045], [x + 0.045, armY + 0.29, 0.045], H.insulator, tint(H.insulator, 0.8));
  }
  // Braces.
  addBoxRotated(b, [-0.45, armY - 0.28, 0], [0.05, 0.62, 0.05], 0, W.weathered, W.dark, 0);
  return b.build();
}

/** Where a wire attaches, relative to a pole's origin, in the pole's local frame. */
export const POLE_WIRE_OFFSETS: Array<[number, number]> = [
  [-0.8, POLE_HEIGHT - 0.55 + 0.3],
  [0, POLE_HEIGHT - 0.55 + 0.3],
  [0.8, POLE_HEIGHT - 0.55 + 0.3],
];

/** Roadside marker stone / boulder, origin on the ground. */
export function buildStone(): THREE.BufferGeometry {
  const b = new MeshBuilder();
  const rng = createRng(4411);
  addBlob(b, [0, 0.35, 0], [1, 0.8, 0.9], rng, {
    detail: 0,
    lump: 0.22,
    flatBottom: 0.35,
    colorAt: (out, nx, ny, nz) => {
      const lit = clamp(0.5 + 0.5 * (nx * SUN.x + ny * SUN.y + nz * SUN.z));
      return out.copy(H.rock).multiplyScalar(0.6 + 0.55 * lit);
    },
  });
  return b.build();
}
