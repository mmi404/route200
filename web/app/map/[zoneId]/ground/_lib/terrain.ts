/**
 * Pure, deterministic procedural-scene helpers for the Ground View
 * prototype (PROGRESS.md, "Phase 3: Ground View"). Everything here is a
 * function of a zone's id (for a stable per-zone layout across reloads)
 * and its real ChangeEvent history (for the severity-over-time curve);
 * nothing here invents new data, it only decides how to render data that
 * already exists.
 *
 * The scene is explicitly illustrative, not a measurement: a hillside,
 * a cleared scar, a road and a house are stylized stand-ins for "this
 * place was forested and now shows disturbance," not a claim about the
 * real geometry of any specific hill.
 */
import type { ChangeEvent } from "@/lib/types";
import { isoToDayIndex } from "../../../_lib/severity";

/** FNV-1a style string hash, deterministic across runs and platforms. */
export function hashSeed(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32: a small, fast, deterministic PRNG. Same seed, same stream,
 *  every time, so a zone's scattered trees sit in the same place on every
 *  visit instead of reshuffling on each load. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash2(ix: number, iz: number, seed: number): number {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iz, 668265263) ^ Math.imul(seed, 2147483647);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function smootherStep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Single-octave 2D value noise, [-1, 1], continuous and smooth. Deliberately
 *  simple (no external noise library) since this scene only needs a
 *  believable hillside, not scientifically textured terrain. */
function valueNoise2D(x: number, z: number, seed: number): number {
  const x0 = Math.floor(x);
  const z0 = Math.floor(z);
  const tx = smootherStep(x - x0);
  const tz = smootherStep(z - z0);
  const v00 = hash2(x0, z0, seed);
  const v10 = hash2(x0 + 1, z0, seed);
  const v01 = hash2(x0, z0 + 1, seed);
  const v11 = hash2(x0 + 1, z0 + 1, seed);
  const a = v00 + (v10 - v00) * tx;
  const b = v01 + (v11 - v01) * tx;
  return (a + (b - a) * tz) * 2 - 1;
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** Smooth 0->1 ramp between edge0 and edge1, 0 before edge0, 1 after edge1. */
export function smoothstep(value: number, edge0: number, edge1: number): number {
  if (edge0 === edge1) return value < edge0 ? 0 : 1;
  const t = clamp01((value - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// World scale: 1 unit = 1 metre. The visitor walks inside `walkRadius`; the
// terrain is rendered out to `worldRadius`, and beyond the walkable disc the
// ground rises into an encircling ridge too steep to climb.
// ---------------------------------------------------------------------------

/** Total width of the road bed, metres. */
export const roadWidth = 4.2;

/** Footprint of the house, metres (x = long axis in the house's local frame). */
export const HOUSE_SIZE = { width: 6, depth: 4.5, wallHeight: 2.6 } as const;

/** Radius of the flat pad under the house, and where its blend ends. */
const PAD_FLAT_RADIUS = 5;
const PAD_BLEND_RADIUS = 14;

/** How far the terrace sits below the hill at the scar centre (metres), and
 *  the most a single point can be cut down. */
const TERRACE_DROP = 5.5;
const MAX_CUT = 6.5;

export interface Placement {
  x: number;
  z: number;
  /** Rotation about +Y (three.js convention: local +Z maps to
   *  (sin yaw, cos yaw) in world x/z, local -Z, the camera's forward, to
   *  (-sin yaw, -cos yaw)). */
  yaw: number;
}

export interface SceneLayout {
  seed: number;
  /** The visitor can walk anywhere inside this radius of the origin. */
  walkRadius: number;
  /** Terrain and trees are generated out to this radius. */
  worldRadius: number;
  /** Where the clearing/hill-cut scar is centred. */
  scarCenter: { x: number; z: number };
  /** Largest radius the cleared area reaches at severity 1 (before noise). */
  scarMaxRadius: number;
  /** The house's facing angle, radians. */
  structureAngle: number;
  /** Centre, height and radius (sigma) of the hill the scar is cut into. */
  hillCenter: { x: number; z: number };
  hillHeight: number;
  hillRadius: number;
  /** Where the visitor starts, facing the scar. */
  spawn: Placement;
  /** House placement; local +Z (the door side) faces the road end. */
  house: Placement;
  /** Road centreline, from outside walkRadius (rim) to beside the house. */
  road: Array<{ x: number; z: number }>;
}

/** One stable layout per zone id. Independent of severity, so the *place*
 *  doesn't move as the slider scrubs, only its *state* does. */
export function sceneLayoutForZone(zoneId: string): SceneLayout {
  const seed = hashSeed(zoneId);
  const rng = createRng(seed);
  const walkRadius = 52;
  const worldRadius = 120;

  const scarAngle = rng() * Math.PI * 2;
  const scarRadius = 10 + rng() * 8;
  const scarCenter = { x: Math.cos(scarAngle) * scarRadius, z: Math.sin(scarAngle) * scarRadius };
  const structureAngle = rng() * Math.PI * 2;

  // The visitor starts on the origin side of the scar, with the hill that is
  // about to be cut rising behind it.
  const towardOrigin = Math.atan2(-scarCenter.z, -scarCenter.x);
  const spawnJitter = (rng() * 2 - 1) * 1.0;
  const spawnDir = towardOrigin + spawnJitter;
  const hillAngle = spawnDir + Math.PI + (rng() * 2 - 1) * 0.5;
  const hillRadius = 15;
  const hillCenter = {
    x: scarCenter.x + Math.cos(hillAngle) * 14,
    z: scarCenter.z + Math.sin(hillAngle) * 14,
  };

  // House a few metres off the scar centre.
  const houseOffset = 4 + rng() * 2;
  const houseX = scarCenter.x + Math.cos(structureAngle) * houseOffset;
  const houseZ = scarCenter.z + Math.sin(structureAngle) * houseOffset;

  // Road: rim point on the opposite lateral side from the spawn, to a point
  // in front of the house, bowed into a gentle S.
  // Approach from whichever lateral side keeps the road away from the hill.
  const startOffset = 0.8 + rng() * 0.3;
  const approach = ([1, -1] as const).map((side) => {
    const angle = scarAngle + side * startOffset;
    const point = { x: Math.cos(angle) * 75, z: Math.sin(angle) * 75 };
    const toPoint = Math.atan2(point.z - houseZ, point.x - houseX);
    return { side, point, toPoint, overHill: Math.cos(toPoint - hillAngle) };
  });
  const chosen = approach[0].overHill <= approach[1].overHill ? approach[0] : approach[1];
  const start = chosen.point;
  const frontAngle = chosen.toPoint + chosen.side * 0.7;
  const end = { x: houseX + Math.cos(frontAngle) * 6, z: houseZ + Math.sin(frontAngle) * 6 };
  const alongX = end.x - start.x;
  const alongZ = end.z - start.z;
  const alongLen = Math.hypot(alongX, alongZ);
  const perpX = -alongZ / alongLen;
  const perpZ = alongX / alongLen;
  const ampA = 6 + rng() * 4;
  const ampB = 1.5 + rng() * 2;
  const roadSamples = 32;
  const road: SceneLayout["road"] = [];
  for (let i = 0; i < roadSamples; i++) {
    const t = i / (roadSamples - 1);
    const bow = ampA * Math.sin(2 * Math.PI * t) + ampB * Math.sin(3 * Math.PI * t);
    road.push({
      x: start.x + alongX * t + perpX * bow,
      z: start.z + alongZ * t + perpZ * bow,
    });
  }

  const layout: SceneLayout = {
    seed,
    walkRadius,
    worldRadius,
    scarCenter,
    scarMaxRadius: 24,
    structureAngle,
    hillCenter,
    hillHeight: 11,
    hillRadius,
    spawn: { x: 0, z: 0, yaw: 0 },
    // Door (+Z) toward the road end.
    house: { x: houseX, z: houseZ, yaw: Math.atan2(end.x - houseX, end.z - houseZ) },
    road,
  };

  // Spawn: 30-34 m from the scar centre, on gentle ground, clear of the road
  // and well inside the walkable disc. First candidate that passes wins.
  for (let attempt = 0; attempt < 16; attempt++) {
    const angle = spawnDir + (attempt === 0 ? 0 : (rng() * 2 - 1) * 0.6);
    const dist = 30 + rng() * 4;
    const x = scarCenter.x + Math.cos(angle) * dist;
    const z = scarCenter.z + Math.sin(angle) * dist;
    layout.spawn = {
      x,
      z,
      yaw: Math.atan2(-(scarCenter.x - x), -(scarCenter.z - z)),
    };
    if (Math.hypot(x, z) > walkRadius - 8) continue;
    if (slopeOf(x, z, layout) > 0.22) continue;
    if (roadInfo(x, z, layout).dist < 10) continue;
    break;
  }
  return layout;
}

/** Rise over run of the base ground at (x, z). */
function slopeOf(x: number, z: number, layout: SceneLayout): number {
  const e = 1;
  const gx = (baseHeight(x + e, z, layout) - baseHeight(x - e, z, layout)) / (2 * e);
  const gz = (baseHeight(x, z + e, layout) - baseHeight(x, z - e, layout)) / (2 * e);
  return Math.hypot(gx, gz);
}

/**
 * Natural ground height at a local (x, z), before any clearing: rolling
 * jungle hills (several metres of undulation over 30-60 m plus sub-0.4 m
 * roughness), one noticeable hill the scar is cut into the side of, and an
 * encircling ridge that rises past the walkable disc so the boundary is a
 * slope too steep to climb rather than an invisible wall.
 */
export function baseHeight(x: number, z: number, layout: SceneLayout): number {
  const s = layout.seed;
  const undulation =
    valueNoise2D(x / 48, z / 48, s) * 4.6 +
    valueNoise2D(x / 24, z / 24, s + 11) * 1.9 +
    valueNoise2D(x / 11, z / 11, s + 23) * 0.6 +
    valueNoise2D(x / 4.3, z / 4.3, s + 37) * 0.3;

  const hx = x - layout.hillCenter.x;
  const hz = z - layout.hillCenter.z;
  const sigma = layout.hillRadius;
  const hill = layout.hillHeight * Math.exp(-(hx * hx + hz * hz) / (2 * sigma * sigma));

  const r = Math.hypot(x, z);
  let ridge = 0;
  if (r > layout.walkRadius - 8) {
    const t = smoothstep(r, layout.walkRadius - 8, layout.walkRadius + 32);
    const a = Math.atan2(z, x);
    // Angular noise on the unit circle is periodic, so no seam at +-pi.
    const skyline = valueNoise2D(Math.cos(a) * 2.4 + 5, Math.sin(a) * 2.4 + 5, s + 51);
    ridge = t * (27 + 7 * skyline) + t * valueNoise2D(x / 14, z / 14, s + 61) * 4;
  }
  return undulation + hill + ridge;
}

// ---------------------------------------------------------------------------
// Per-layout precomputation (road bed profile, terrace and pad levels).
// ---------------------------------------------------------------------------

interface LayoutCache {
  terrace: number;
  padY: number;
  /** Road bed height at each centreline sample (smoothed, at full severity). */
  roadBed: number[];
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
}

/** Width of the band over which neighbouring road stretches share the bed height. */
const BED_BLEND = 3;
/** Widest shoulder the road bed blends over (deep cuts get gentler walls). */
const MAX_ROAD_BLEND = 16;
let segmentDists = new Float64Array(64);
let segmentBeds = new Float64Array(64);

const layoutCaches = new WeakMap<SceneLayout, LayoutCache>();

function cutBy(base: number, terrace: number): number {
  const d = base - terrace;
  return d > 0 ? MAX_CUT * (1 - Math.exp(-d / MAX_CUT)) : 0;
}

function cacheFor(layout: SceneLayout): LayoutCache {
  const cached = layoutCaches.get(layout);
  if (cached) return cached;
  const terrace = baseHeight(layout.scarCenter.x, layout.scarCenter.z, layout) - TERRACE_DROP;
  const fullCut = (x: number, z: number): number => {
    const base = baseHeight(x, z, layout);
    return base - cutBy(base, terrace) * scarMask(x, z, layout, 1);
  };
  let bed = layout.road.map((p) => fullCut(p.x, p.z));
  for (let pass = 0; pass < 2; pass++) {
    const prev = bed;
    bed = prev.map((_, i) => {
      let sum = 0;
      let n = 0;
      for (let k = -3; k <= 3; k++) {
        const j = i + k;
        if (j < 0 || j >= prev.length) continue;
        sum += prev[j];
        n++;
      }
      return sum / n;
    });
  }
  const margin = roadWidth / 2 + 1 + MAX_ROAD_BLEND + 1;
  const xs = layout.road.map((p) => p.x);
  const zs = layout.road.map((p) => p.z);
  const cache: LayoutCache = {
    terrace,
    padY: fullCut(layout.house.x, layout.house.z),
    roadBed: bed,
    minX: Math.min(...xs) - margin,
    maxX: Math.max(...xs) + margin,
    minZ: Math.min(...zs) - margin,
    maxZ: Math.max(...zs) + margin,
  };
  layoutCaches.set(layout, cache);
  return cache;
}

/** Distance from (x, z) to the road centreline and the road bed height at
 *  the nearest point. Distance is Infinity outside the road's bounding box
 *  (cheap early-out for most of the terrain). */
export function roadInfo(
  x: number,
  z: number,
  layout: SceneLayout,
): { dist: number; bed: number } {
  const cache = cacheFor(layout);
  if (x < cache.minX || x > cache.maxX || z < cache.minZ || z > cache.maxZ) {
    return { dist: Infinity, bed: 0 };
  }
  const road = layout.road;
  const count = road.length - 1;
  const dists = segmentDists.length >= count ? segmentDists : (segmentDists = new Float64Array(count));
  const beds = segmentBeds.length >= count ? segmentBeds : (segmentBeds = new Float64Array(count));
  let best = Infinity;
  for (let i = 0; i < count; i++) {
    const a = road[i];
    const b = road[i + 1];
    const abx = b.x - a.x;
    const abz = b.z - a.z;
    const len2 = abx * abx + abz * abz;
    const u = len2 > 0 ? clamp01(((x - a.x) * abx + (z - a.z) * abz) / len2) : 0;
    const px = a.x + abx * u - x;
    const pz = a.z + abz * u - z;
    const d = Math.sqrt(px * px + pz * pz);
    dists[i] = d;
    beds[i] = cache.roadBed[i] + (cache.roadBed[i + 1] - cache.roadBed[i]) * u;
    if (d < best) best = d;
  }
  // Bed height: average over every segment within BED_BLEND of the nearest
  // one, weighted down to 0 at the edge. Where two stretches of road are
  // equally near (the bow of the S) a plain "nearest segment" bed would jump
  // from one to the other; this keeps it continuous.
  let sum = 0;
  let weight = 0;
  for (let i = 0; i < count; i++) {
    const w = 1 - (dists[i] - best) / BED_BLEND;
    if (w <= 0) continue;
    sum += beds[i] * w;
    weight += w;
  }
  return { dist: best, bed: sum / weight };
}

// ---------------------------------------------------------------------------
// Severity-driven state. `severityFraction` is 0..1 everywhere below.
// ---------------------------------------------------------------------------

/** 0..1, how present the road is. Starts past 0.55, fully there by 0.8. */
export function roadAppear(severityFraction: number): number {
  return smoothstep(severityFraction, 0.55, 0.8);
}

/** 0..1, how present the house is. Starts past 0.58, fully there by 0.8. */
export function houseAppear(severityFraction: number): number {
  return smoothstep(severityFraction, 0.58, 0.8);
}

/** The irregular, growing cleared area around the scar centre (no road, no
 *  house pad). 0 everywhere at severity 0, 1 at the centre by severity 1. */
function scarMask(x: number, z: number, layout: SceneLayout, severityFraction: number): number {
  const growth = smoothstep(severityFraction, 0.04, 0.9);
  if (growth <= 0) return 0;
  const dx = x - layout.scarCenter.x;
  const dz = z - layout.scarCenter.z;
  const dist = Math.hypot(dx, dz);
  if (dist > layout.scarMaxRadius * 1.3 + 4) return 0;
  const a = Math.atan2(dz, dx);
  const angular = valueNoise2D(Math.cos(a) * 1.7 + 3, Math.sin(a) * 1.7 + 3, layout.seed + 71);
  const radius = layout.scarMaxRadius * growth * (1 + 0.16 * angular);
  const edge = dist + 2.5 * valueNoise2D(x * 0.11, z * 0.11, layout.seed + 83);
  const shape = 1 - smoothstep(edge, radius * 0.3, radius);
  return shape * smoothstep(radius, 0.5, 4);
}

export interface SurfaceSample {
  /** Ground height, metres. */
  height: number;
  /** 0..1 how cleared/bare the spot is (drives colour, trees, undergrowth). */
  cleared: number;
}

/**
 * Severity-dependent part of the terrain, given the cached `base` height at
 * (x, z) so the noise octaves are evaluated once per vertex rather than on
 * every slider tick. Writes into `out` to avoid allocation in the mesh loop.
 */
export function surfaceFromBase(
  base: number,
  x: number,
  z: number,
  layout: SceneLayout,
  severityFraction: number,
  out: SurfaceSample,
): SurfaceSample {
  const cache = cacheFor(layout);
  const scar = scarMask(x, z, layout, severityFraction);
  const cutScale = smoothstep(severityFraction, 0.15, 0.85);
  let height = base - cutBy(base, cache.terrace) * scar * cutScale;
  let cleared = scar;

  const rAppear = roadAppear(severityFraction);
  if (rAppear > 0) {
    const road = roadInfo(x, z, layout);
    if (road.dist < Infinity) {
      const half = roadWidth / 2;
      const gap = Math.abs(road.bed - height);
      const shoulder = Math.min(MAX_ROAD_BLEND, Math.max(6, 2 * gap));
      const w = (1 - smoothstep(road.dist, half + 1, half + 1 + shoulder)) * rAppear;
      height += (road.bed - height) * w;
      const corridor = (1 - smoothstep(road.dist, half + 1, half + 5)) * rAppear;
      cleared = Math.max(cleared, corridor);
    }
  }

  // The house pad is applied last so it stays flat where the road shoulder overlaps it.
  const hAppear = houseAppear(severityFraction);
  if (hAppear > 0) {
    const d = Math.hypot(x - layout.house.x, z - layout.house.z);
    const pad = (1 - smoothstep(d, PAD_FLAT_RADIUS, PAD_BLEND_RADIUS)) * hAppear;
    if (pad > 0) {
      height += (cache.padY - height) * pad;
      cleared = Math.max(cleared, pad);
    }
  }

  out.height = height;
  out.cleared = cleared;
  return out;
}

const scratchSurface: SurfaceSample = { height: 0, cleared: 0 };

/** Terrain height when the base height has already been computed. */
export function terrainHeightFromBase(
  base: number,
  x: number,
  z: number,
  layout: SceneLayout,
  severityFraction: number,
): number {
  return surfaceFromBase(base, x, z, layout, severityFraction, scratchSurface).height;
}

/** Ground height at (x, z) for a severity fraction: the hill cut down toward
 *  a terrace, a flat pad under the house, the road bed levelled across its
 *  width. Continuous for every severity 0..1. */
export function terrainHeight(
  x: number,
  z: number,
  layout: SceneLayout,
  severityFraction: number,
): number {
  return terrainHeightFromBase(baseHeight(x, z, layout), x, z, layout, severityFraction);
}

/** 0..1 how cleared/bare this spot is at this severity. One smooth,
 *  deterministic mask for ground colour, tree removal and undergrowth. */
export function clearedAmount(
  x: number,
  z: number,
  layout: SceneLayout,
  severityFraction: number,
): number {
  return surfaceFromBase(baseHeight(x, z, layout), x, z, layout, severityFraction, {
    height: 0,
    cleared: 0,
  }).cleared;
}

// ---------------------------------------------------------------------------
// Trees
// ---------------------------------------------------------------------------

export interface TreeSlot {
  x: number;
  z: number;
  rotationY: number;
  /** 0.7..1.4; tree height is roughly 9 m times this. */
  baseScale: number;
  /** 0..3, for later art use (species/silhouette). */
  variant: number;
  /** 0..1, seeded; staggers when this tree clears relative to neighbours. */
  jitter: number;
}

/** A fixed, seeded scatter across the whole world disk, denser inside
 *  walkRadius + 20 where the visitor can see it up close. */
export function generateTreeSlots(layout: SceneLayout, count: number): TreeSlot[] {
  const rng = createRng(layout.seed + 7919);
  const inner = layout.walkRadius + 20;
  const slots: TreeSlot[] = [];
  while (slots.length < count) {
    const radius =
      rng() < 0.7
        ? inner * Math.sqrt(rng())
        : Math.sqrt(inner * inner + rng() * (layout.worldRadius ** 2 - inner * inner));
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const rotationY = rng() * Math.PI * 2;
    const baseScale = 0.7 + rng() * 0.7;
    const variant = Math.min(3, Math.floor(rng() * 4));
    const jitter = rng();
    // Keep the spawn point itself free of trunks.
    if (Math.hypot(x - layout.spawn.x, z - layout.spawn.z) < 2.5) continue;
    slots.push({ x, z, rotationY, baseScale, variant, jitter });
  }
  return slots;
}

/** How visible (0..1) a tree is at this severity: gone where its spot is
 *  cleared, thinning through a soft band (staggered per tree by `jitter`) so
 *  scrubbing reads as thinning, not popping. Never present on the road
 *  corridor once the road appears, nor on the house pad. */
export function treeVisibility(
  slot: TreeSlot,
  layout: SceneLayout,
  severityFraction: number,
): number {
  const cleared = clearedAmount(slot.x, slot.z, layout, severityFraction);
  const start = 0.1 + 0.5 * slot.jitter;
  let visible = 1 - smoothstep(cleared, start, start + 0.25);
  if (visible <= 0) return 0;

  const rAppear = roadAppear(severityFraction);
  if (rAppear > 0) {
    const d = roadInfo(slot.x, slot.z, layout).dist;
    const half = roadWidth / 2;
    visible *= 1 - rAppear * (1 - smoothstep(d, half, half + 2.5));
  }
  const hAppear = houseAppear(severityFraction);
  if (hAppear > 0) {
    const d = Math.hypot(slot.x - layout.house.x, slot.z - layout.house.z);
    visible *= 1 - hAppear * (1 - smoothstep(d, PAD_FLAT_RADIUS, PAD_FLAT_RADIUS + 2));
  }
  return clamp01(visible);
}

/**
 * Continuous 0-100 severity "now" for a given day, interpolated across the
 * zone's real recorded events rather than only ever snapping to the latest
 * one at-or-before the day (which is how the 2D map and the phase-2 terrain
 * page both work). This is a deliberate rendering choice for Ground View
 * specifically, so the scrub reads as smooth change happening over time,
 * not a series of hard cuts between discrete readings. Flat at 0 before the
 * first observation (a lead-in ramp, not an instant jump), flat at the
 * latest reading after the last one (the "current" state persists).
 */
export function severityAtDay(history: ChangeEvent[], day: number): number {
  if (history.length === 0) return 0;
  const points = history.map((event) => ({
    day: isoToDayIndex(event.dateRangeEnd),
    severity: event.severity,
  }));
  const leadInDays = 20;
  const first = points[0];
  const last = points[points.length - 1];
  if (day <= first.day) {
    const rampStart = first.day - leadInDays;
    if (day <= rampStart) return 0;
    const t = (day - rampStart) / leadInDays;
    return first.severity * t;
  }
  if (day >= last.day) return last.severity;
  for (let i = 0; i < points.length - 1; i++) {
    const a = points[i];
    const b = points[i + 1];
    if (day >= a.day && day <= b.day) {
      const t = b.day === a.day ? 1 : (day - a.day) / (b.day - a.day);
      return a.severity + (b.severity - a.severity) * t;
    }
  }
  return last.severity;
}
