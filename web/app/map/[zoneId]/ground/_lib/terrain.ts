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
import { sampleGrid, type Grid, type RealTerrain } from "./realTerrain";

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
  /** Real elevation/density/disturbance grids, when this zone has a ground
   *  terrain pack built by evidence/scripts/build_ground_terrain.py.
   *  Absent for every zone except Teknaf today; everything below falls
   *  back to the original synthetic generation when it is absent. */
  realTerrain?: RealTerrain;
}

/** One stable layout per zone id. Independent of severity, so the *place*
 *  doesn't move as the slider scrubs, only its *state* does.
 *
 *  `realTerrain`, when given, replaces the synthetic hill, scar shape and
 *  vegetation density with real satellite-derived grids (baseHeight,
 *  scarMask, generateTreeSlots/generateUndergrowthSlots/
 *  generateDistantTreeSlots below); the scene's local origin then becomes
 *  the grid's own reference point, i.e. the real location of the measured
 *  disturbance, instead of a hash-seeded point. */
export function sceneLayoutForZone(zoneId: string, realTerrain?: RealTerrain): SceneLayout {
  const seed = hashSeed(zoneId);
  const rng = createRng(seed);
  const walkRadius = 52;
  const worldRadius = 120;

  // Drawn either way so every later rng() draw lands on the same value
  // regardless of whether realTerrain is present; only scarCenter itself
  // differs.
  const scarAngle = rng() * Math.PI * 2;
  const scarRadius = 10 + rng() * 8;
  const scarCenter = realTerrain
    ? { x: 0, z: 0 }
    : { x: Math.cos(scarAngle) * scarRadius, z: Math.sin(scarAngle) * scarRadius };
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
    realTerrain,
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
  if (layout.realTerrain) {
    // Real elevation (Copernicus DEM GLO-30, bilinear-resampled) gives the
    // macro shape; the two finest noise octaves stay on top as sub-30 m
    // ground texture, the same role they already play over the synthetic
    // hill below, now sitting on a real contour instead of a fake one.
    const macro = sampleGrid(layout.realTerrain.heights, x, z);
    const texture =
      valueNoise2D(x / 11, z / 11, s + 23) * 0.6 + valueNoise2D(x / 4.3, z / 4.3, s + 37) * 0.3;
    const { water, waterLevelM } = layout.realTerrain;
    if (water && waterLevelM !== undefined) {
      // A river is flat: pull the ground down to a riverbed just below the
      // real water surface level where WorldCover says open water, fading
      // out the fine roughness there too (a channel has no leaf-litter
      // texture). The Water scene component draws the actual surface on top.
      const w = sampleGrid(water, x, z);
      if (w > 0) {
        const land = macro + texture;
        const riverbed = waterLevelM - 0.15;
        return land + (riverbed - land) * w;
      }
    }
    return macro + texture;
  }
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
  if (layout.realTerrain) {
    // Real shape (the actual Sentinel-1 before/after footprint) instead of
    // a synthetic radial blob; still fades in with severity exactly as the
    // synthetic scar does below.
    return sampleGrid(layout.realTerrain.disturbance, x, z) * growth;
  }
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

/** Mean real density within radius of the world origin, sampled on a
 *  regular grid and masked to the circle, not the whole measured density
 *  grid: that grid extends out to the edge of its ~360 m scan window
 *  (`build_ground_terrain.py`'s extraction half-extent), well past
 *  `worldRadius`, so a patch of real forest the visitor can never reach
 *  (e.g. along a distant tributary at the edge of the scan) must not
 *  inflate how much vegetation appears inside the walkable world. */
function localMeanDensity(grid: Grid, radius: number): number {
  const samples = 12;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < samples; i++) {
    for (let j = 0; j < samples; j++) {
      const x = -radius + (2 * radius * i) / (samples - 1);
      const z = -radius + (2 * radius * j) / (samples - 1);
      if (Math.hypot(x, z) > radius) continue;
      sum += sampleGrid(grid, x, z);
      count++;
    }
  }
  return count > 0 ? sum / count : 0;
}

/** How much a real density grid's overall level, not just its spatial
 *  shape, should scale a slot quota. The per-candidate rejection below
 *  only reshapes WHERE slots land inside the walkable world, and does
 *  nothing when the grid has no spatial contrast there; a density sample
 *  that reads uniformly sparse across the walkable world (real cropland or
 *  char, or the whole plot measured as cleared on one real date) still
 *  needs to reduce how much canopy appears at all, which only scaling the
 *  quota itself achieves. `exponent` above 1 compresses a low real density
 *  further: real land-cover cropland/bare values (around 0.1-0.3) still
 *  carry enough weight under a plain linear scale to fill the walkable
 *  world with hundreds of full-size trees, reading as thinned forest
 *  rather than the open, largely treeless ground those real values
 *  describe; trees use exponent 2 for exactly this reason, undergrowth
 *  (low ground cover, plausible even on real cropland) stays linear. */
function realCountScale(layout: SceneLayout, floor: number, exponent = 1): number {
  if (!layout.realTerrain) return 1;
  const local = localMeanDensity(layout.realTerrain.density, layout.walkRadius + 20);
  return Math.max(floor, local ** exponent);
}

/** Hard ceiling on rejection-sampling attempts per wanted slot, so an
 *  almost entirely real-water local window (the one case the floor-based
 *  density rejection below cannot rescue) degrades to fewer slots than
 *  asked for instead of spinning forever. Ordinary zones, real or
 *  synthetic, never get close to this. */
const MAX_SLOT_ATTEMPTS_PER_TARGET = 300;

/** A fixed, seeded scatter across the whole world disk, denser inside
 *  walkRadius + 20 where the visitor can see it up close. */
export function generateTreeSlots(layout: SceneLayout, count: number): TreeSlot[] {
  const rng = createRng(layout.seed + 7919);
  const inner = layout.walkRadius + 20;
  const target = Math.round(count * realCountScale(layout, TREE_DENSITY_FLOOR, 2));
  const slots: TreeSlot[] = [];
  for (let attempt = 0; slots.length < target && attempt < target * MAX_SLOT_ATTEMPTS_PER_TARGET; attempt++) {
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
    if (isRealWater(layout, x, z)) continue;
    if (layout.realTerrain && rng() > Math.max(TREE_DENSITY_FLOOR, sampleGrid(layout.realTerrain.density, x, z))) {
      continue;
    }
    slots.push({ x, z, rotationY, baseScale, variant, jitter });
  }
  return slots;
}

/** True where a real water grid says this spot is open water: no tree,
 *  undergrowth or far-tree slot can land there, overriding the density
 *  floor that would otherwise still scatter the occasional tree. Absent
 *  (false) for every zone without a water grid. */
function isRealWater(layout: SceneLayout, x: number, z: number): boolean {
  const water = layout.realTerrain?.water;
  return water !== undefined && sampleGrid(water, x, z) > 0.4;
}

/** Rejection-sampling floor so a zero-density real spot (bare ground,
 *  built-up, water) still gets the occasional tree rather than a hard
 *  edge, and so the loop above never stalls. Small: trees are the tallest,
 *  most visually dominant slot kind, so a real zero-density spot should
 *  read as open ground with the rare stray tree, not a guaranteed stand. */
const TREE_DENSITY_FLOOR = 0.02;

/** Same idea for undergrowth: ferns and grass still grow at the edge of
 *  cropland or a clearing, unlike closed-canopy trees, so this floor stays
 *  a little higher than the tree one, but well short of forcing a quarter
 *  of max ground cover onto a real zero-density spot the way the original
 *  0.25 did. Its quota uses exponent 1.6 (see `realCountScale`'s call
 *  sites): low enough, unlike the trees' exponent 2, that real cropland
 *  still shows scattered grass rather than nothing, but high enough that a
 *  real sandbar/char reads as mostly open ground, not a lawn. */
const UNDERGROWTH_DENSITY_FLOOR = 0.02;

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
  return treeVisibilityFromCleared(slot, cleared, layout, severityFraction);
}

/** `treeVisibility` when the cleared amount at the slot is already known
 *  (the renderer gets it together with the ground height from one
 *  `surfaceFromBase` call, so the noise is evaluated once per slider tick). */
export function treeVisibilityFromCleared(
  slot: Pick<TreeSlot, "x" | "z" | "jitter">,
  cleared: number,
  layout: SceneLayout,
  severityFraction: number,
): number {
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

// ---------------------------------------------------------------------------
// Vegetation beyond the collidable big trees: far ridge trees, undergrowth,
// felled logs and stumps. All seeded per layout, none of it collidable.
// ---------------------------------------------------------------------------

/** True for a spot no severity value can change: beyond the scar's reach, the
 *  road shoulder and the house pad. The renderer writes these instances once
 *  and only re-evaluates the rest while the slider moves. */
export function isSeverityStatic(x: number, z: number, layout: SceneLayout): boolean {
  const scarReach = layout.scarMaxRadius * 1.3 + 5;
  if (Math.hypot(x - layout.scarCenter.x, z - layout.scarCenter.z) <= scarReach) return false;
  if (Math.hypot(x - layout.house.x, z - layout.house.z) <= PAD_BLEND_RADIUS + 2) return false;
  return roadInfo(x, z, layout).dist > roadWidth / 2 + 1 + MAX_ROAD_BLEND + 3;
}

/** Extra tree slots on the encircling ridge and the far slopes, past the
 *  walkable disc (nobody can reach them, so they carry no collision and the
 *  caller can draw them with a cheaper tree). Same slot shape as the near trees. */
export function generateDistantTreeSlots(layout: SceneLayout, count: number): TreeSlot[] {
  const rng = createRng(layout.seed + 104729);
  const inner = layout.walkRadius + 4;
  const target = Math.round(count * realCountScale(layout, TREE_DENSITY_FLOOR, 2));
  const slots: TreeSlot[] = [];
  for (let attempt = 0; slots.length < target && attempt < target * MAX_SLOT_ATTEMPTS_PER_TARGET; attempt++) {
    const radius = Math.sqrt(inner * inner + rng() * (layout.worldRadius ** 2 - inner * inner));
    const angle = rng() * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const rotationY = rng() * Math.PI * 2;
    const baseScale = 0.8 + rng() * 0.8;
    const variant = Math.min(3, Math.floor(rng() * 4));
    const jitter = rng();
    if (isRealWater(layout, x, z)) continue;
    if (layout.realTerrain && rng() > Math.max(TREE_DENSITY_FLOOR, sampleGrid(layout.realTerrain.density, x, z))) {
      continue;
    }
    slots.push({ x, z, rotationY, baseScale, variant, jitter });
  }
  return slots;
}

/** Undergrowth kinds, in the order the renderer builds their meshes. */
export const UNDERGROWTH_KINDS = ["fern", "shrub", "grass", "paddle", "sapling"] as const;
/** Share of slots per kind (sums to 1). */
const UNDERGROWTH_WEIGHTS = [0.27, 0.17, 0.26, 0.1, 0.2];

export interface UndergrowthSlot {
  x: number;
  z: number;
  rotationY: number;
  /** 0.65..1.45, multiplies the kind's nominal size. */
  scale: number;
  /** Index into UNDERGROWTH_KINDS. */
  kind: number;
  /** 0..1, seeded; staggers when this plant clears relative to neighbours. */
  jitter: number;
}

function pickUndergrowthKind(u: number): number {
  let acc = 0;
  for (let i = 0; i < UNDERGROWTH_WEIGHTS.length; i++) {
    acc += UNDERGROWTH_WEIGHTS[i];
    if (u < acc) return i;
  }
  return UNDERGROWTH_WEIGHTS.length - 1;
}

/** Ferns, shrubs, grass, big-leaf plants and saplings across the walkable
 *  area plus a margin: part uniform, part gathered in patches so the forest
 *  floor has thickets and open glades rather than an even sprinkle. */
export function generateUndergrowthSlots(layout: SceneLayout, count: number): UndergrowthSlot[] {
  const rng = createRng(layout.seed + 31337);
  const reach = layout.walkRadius + 14;
  const target = Math.round(count * realCountScale(layout, UNDERGROWTH_DENSITY_FLOOR, 1.6));
  const clusterCount = Math.max(8, Math.round(target / 22));
  const clusters = Array.from({ length: clusterCount }, () => {
    const r = reach * Math.sqrt(rng());
    const a = rng() * Math.PI * 2;
    return { x: Math.cos(a) * r, z: Math.sin(a) * r, spread: 2.5 + rng() * 4.5, kind: pickUndergrowthKind(rng()) };
  });
  const slots: UndergrowthSlot[] = [];
  for (let attempt = 0; slots.length < target && attempt < target * MAX_SLOT_ATTEMPTS_PER_TARGET; attempt++) {
    let x: number;
    let z: number;
    let kind: number;
    const pick = rng();
    if (pick < 0.2) {
      // Rim thicket: saplings and shrubs crowd the foot of the ridge, so the
      // slope that ends the walk reads as dense jungle, not bare ground.
      const r = layout.walkRadius - 9 + rng() * 21;
      const a = rng() * Math.PI * 2;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      kind = rng() < 0.6 ? 4 : rng() < 0.6 ? 1 : 3;
    } else if (pick < 0.68) {
      const c = clusters[Math.floor(rng() * clusters.length)];
      x = c.x + (rng() + rng() + rng() - 1.5) * 2 * c.spread;
      z = c.z + (rng() + rng() + rng() - 1.5) * 2 * c.spread;
      kind = rng() < 0.65 ? c.kind : pickUndergrowthKind(rng());
    } else {
      const r = reach * Math.sqrt(rng());
      const a = rng() * Math.PI * 2;
      x = Math.cos(a) * r;
      z = Math.sin(a) * r;
      kind = pickUndergrowthKind(rng());
    }
    const rotationY = rng() * Math.PI * 2;
    const scale = 0.65 + rng() * 0.8;
    const jitter = rng();
    if (Math.hypot(x, z) > reach) continue;
    // Nothing growing in the visitor's face on arrival.
    if (Math.hypot(x - layout.spawn.x, z - layout.spawn.z) < 3) continue;
    if (isRealWater(layout, x, z)) continue;
    if (
      layout.realTerrain &&
      rng() > Math.max(UNDERGROWTH_DENSITY_FLOOR, sampleGrid(layout.realTerrain.density, x, z))
    ) {
      continue;
    }
    slots.push({ x, z, rotationY, scale, kind, jitter });
  }
  return slots;
}

/** How present (0..1) an undergrowth plant is, given the cleared amount at
 *  its spot. Plants go before trees do, and cleared is 1 on the road bed and
 *  the house pad, so nothing grows there. */
export function undergrowthVisibility(slot: Pick<UndergrowthSlot, "jitter">, cleared: number): number {
  const start = 0.02 + 0.3 * slot.jitter;
  return 1 - smoothstep(cleared, start, start + 0.25);
}

/** 0..1, how much of a felled tree's stump stands at a spot where the tree's
 *  own visibility is `vis`. Absent while the tree stands, on the road bed and
 *  on the house pad, and about one tree in five leaves no stump at all. */
export function stumpAmount(
  slot: Pick<TreeSlot, "x" | "z" | "jitter">,
  vis: number,
  layout: SceneLayout,
  severityFraction: number,
): number {
  let amount = 1 - smoothstep(vis, 0.3, 0.55);
  if (amount <= 0) return 0;
  const noStump = (slot.jitter * 97.13) % 1 < 0.18;
  if (noStump) return 0;
  const rAppear = roadAppear(severityFraction);
  if (rAppear > 0) {
    const d = roadInfo(slot.x, slot.z, layout).dist;
    const half = roadWidth / 2;
    amount *= 1 - rAppear * (1 - smoothstep(d, half + 0.6, half + 1.4));
  }
  const hAppear = houseAppear(severityFraction);
  if (hAppear > 0) {
    const d = Math.hypot(slot.x - layout.house.x, slot.z - layout.house.z);
    amount *= 1 - hAppear * (1 - smoothstep(d, PAD_FLAT_RADIUS + 0.5, PAD_FLAT_RADIUS + 2.5));
  }
  return clamp01(amount);
}

export interface LogSlot {
  x: number;
  z: number;
  yaw: number;
  /** Metres. */
  length: number;
  /** Metres. */
  radius: number;
  jitter: number;
}

/** Felled logs lying in the cleared ground, away from the road and the pad. */
export function generateLogSlots(layout: SceneLayout, count: number): LogSlot[] {
  const rng = createRng(layout.seed + 6151);
  const logs: LogSlot[] = [];
  for (let attempt = 0; attempt < count * 60 && logs.length < count; attempt++) {
    const a = rng() * Math.PI * 2;
    const d = layout.scarMaxRadius * (0.3 + 0.45 * rng());
    const x = layout.scarCenter.x + Math.cos(a) * d;
    const z = layout.scarCenter.z + Math.sin(a) * d;
    const yaw = rng() * Math.PI;
    const length = 3 + rng() * 3;
    const radius = 0.2 + rng() * 0.15;
    const jitter = rng();
    if (clearedAmount(x, z, layout, 1) < 0.9) continue;
    if (roadInfo(x, z, layout).dist < roadWidth / 2 + length / 2 + 1) continue;
    if (Math.hypot(x - layout.house.x, z - layout.house.z) < 8 + length / 2) continue;
    if (logs.some((l) => Math.hypot(l.x - x, l.z - z) < 4)) continue;
    logs.push({ x, z, yaw, length, radius, jitter });
  }
  return logs;
}

/** 0..1, how present a felled log is: it lies there once the clearing has
 *  reached its spot. */
export function logAmount(
  slot: Pick<LogSlot, "x" | "z">,
  layout: SceneLayout,
  severityFraction: number,
): number {
  return smoothstep(clearedAmount(slot.x, slot.z, layout, severityFraction), 0.55, 0.85);
}

// ---------------------------------------------------------------------------
// Settlement layout: utility poles along the road and the homestead around
// the house. Positions only; the renderer owns the geometry.
// ---------------------------------------------------------------------------

/** World x/z of a point given in the house's local frame (+Z toward the road). */
export function houseToWorld(layout: SceneLayout, lx: number, lz: number): { x: number; z: number } {
  const { x, z, yaw } = layout.house;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { x: x + lx * c + lz * s, z: z - lx * s + lz * c };
}

export interface PolePlacement {
  x: number;
  z: number;
  /** Rotation about +Y that points the cross-arm (local x) across the road. */
  yaw: number;
}

export interface SettlementPlan {
  poles: PolePlacement[];
  stones: Array<{ x: number; z: number; size: number; yaw: number }>;
  /** Fence path in the house's local frame, metres. */
  fence: Array<{ lx: number; lz: number }>;
  /** Cowshed footprint centre and size, house-local. */
  shed: { lx: number; lz: number; width: number; depth: number };
  bananas: Array<{ lx: number; lz: number; scale: number; yaw: number }>;
  logStack: { lx: number; lz: number; yaw: number };
  clothesline: { a: { lx: number; lz: number }; b: { lx: number; lz: number } };
}

/** Height of a utility pole, metres. */
export const POLE_HEIGHT = 8;
/** Spacing of fence slats along the fence path, metres. */
export const FENCE_SLAT_SPACING = 0.2;

const planCache = new WeakMap<SceneLayout, SettlementPlan>();

export function settlementPlan(layout: SceneLayout): SettlementPlan {
  const cached = planCache.get(layout);
  if (cached) return cached;
  const rng = createRng(layout.seed + 90001);

  // Poles: every ~22 m along the road from its house end, on the left-hand
  // verge, cross-arm across the road.
  const road = layout.road;
  const poles: PolePlacement[] = [];
  const stones: SettlementPlan["stones"] = [];
  const offset = roadWidth / 2 + 0.9;
  const spacing = 22;
  let carried = 6;
  for (let i = road.length - 1; i > 0; i--) {
    const a = road[i];
    const b = road[i - 1];
    const segLen = Math.hypot(b.x - a.x, b.z - a.z);
    if (segLen === 0) continue;
    const tx = (b.x - a.x) / segLen;
    const tz = (b.z - a.z) / segLen;
    const nx = -tz;
    const nz = tx;
    let along = carried;
    while (along < segLen) {
      const px = a.x + tx * along + nx * offset;
      const pz = a.z + tz * along + nz * offset;
      if (Math.hypot(px, pz) <= layout.walkRadius + 32) {
        poles.push({ x: px, z: pz, yaw: Math.atan2(-nz, nx) });
      }
      along += spacing;
    }
    carried = along - segLen;
    // Marker stones: now and then, either verge, close to the bed edge.
    if (rng() < 0.7) {
      const side = rng() < 0.5 ? -1 : 1;
      const u = rng() * segLen;
      const out = roadWidth / 2 + 0.9 + rng() * 1.1;
      stones.push({
        x: a.x + tx * u + nx * out * side,
        z: a.z + tz * u + nz * out * side,
        size: 0.28 + rng() * 0.3,
        yaw: rng() * Math.PI * 2,
      });
    }
  }

  const plan: SettlementPlan = {
    poles,
    stones: stones.filter((s) => Math.hypot(s.x, s.z) <= layout.walkRadius + 32),
    fence: [
      { lx: 7.0, lz: 2.4 },
      { lx: 7.0, lz: -5.0 },
      { lx: -7.4, lz: -5.0 },
      { lx: -7.4, lz: 0.4 },
    ],
    shed: { lx: -5.2, lz: 0.3, width: 2.4, depth: 2.2 },
    bananas: [
      { lx: -3.9, lz: 3.3, scale: 1.0, yaw: 0.4 },
      { lx: -4.6, lz: 2.2, scale: 0.8, yaw: 2.1 },
      { lx: 4.4, lz: -3.3, scale: 1.1, yaw: 4.0 },
    ],
    logStack: { lx: 5.4, lz: -0.8, yaw: 0.25 },
    clothesline: { a: { lx: -2.4, lz: -4.0 }, b: { lx: 2.8, lz: -4.1 } },
  };
  planCache.set(layout, plan);
  return plan;
}

/** Circles (world x/z, metres) the visitor should not walk through: utility
 *  poles once the road is there, and the homestead dressing around the house
 *  (porch, cowshed, fence, bananas, log stack) once it is built. The house
 *  walls themselves are covered by HOUSE_SIZE in the player controller. */
export function settlementObstacles(
  layout: SceneLayout,
  severityFraction: number,
): Array<{ x: number; z: number; r: number }> {
  const out: Array<{ x: number; z: number; r: number }> = [];
  const plan = settlementPlan(layout);
  if (roadAppear(severityFraction) > 0.85) {
    for (const pole of plan.poles) out.push({ x: pole.x, z: pole.z, r: 0.22 });
  }
  if (houseAppear(severityFraction) > 0.85) {
    const add = (lx: number, lz: number, r: number) => out.push({ ...houseToWorld(layout, lx, lz), r });
    // Porch and veranda, past the walls HOUSE_SIZE already covers.
    for (const lx of [-1.3, 0, 1.3]) add(lx, 3.7, 0.7);
    add(plan.shed.lx, plan.shed.lz - 0.55, 1.0);
    add(plan.shed.lx, plan.shed.lz + 0.55, 1.0);
    for (const b of plan.bananas) add(b.lx, b.lz, 0.3);
    add(plan.logStack.lx, plan.logStack.lz, 0.8);
    for (let i = 0; i < plan.fence.length - 1; i++) {
      const a = plan.fence[i];
      const b = plan.fence[i + 1];
      const len = Math.hypot(b.lx - a.lx, b.lz - a.lz);
      const steps = Math.max(1, Math.round(len / 1.1));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        add(a.lx + (b.lx - a.lx) * t, a.lz + (b.lz - a.lz) * t, 0.45);
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Real-data stops: a couple of fixed waypoints, present only when the zone
// has a real terrain pack, that surface the actual measured numbers behind
// the terrain in-scene instead of only on the separate evidence page.
// ---------------------------------------------------------------------------

export type RealDataStopKind = "disturbance" | "slope";

export interface RealDataStop {
  x: number;
  z: number;
  kind: RealDataStopKind;
  /** Set only for kind "slope": the steepest real grade found on the walk. */
  slopeDegrees?: number;
}

/** Coarse scan of baseHeight inside walkRadius for the steepest point a
 *  visitor can actually reach. 16x16 is plenty for a single waypoint; this
 *  runs once per layout, not per frame. */
function steepestRealPoint(layout: SceneLayout): { x: number; z: number; slope: number } {
  let best = { x: 0, z: 0, slope: 0 };
  const steps = 16;
  for (let i = 0; i < steps; i++) {
    for (let j = 0; j < steps; j++) {
      const x = -layout.walkRadius + (2 * layout.walkRadius * i) / (steps - 1);
      const z = -layout.walkRadius + (2 * layout.walkRadius * j) / (steps - 1);
      if (Math.hypot(x, z) >= layout.walkRadius - 2) continue;
      const slope = slopeOf(x, z, layout);
      if (slope > best.slope) best = { x, z, slope };
    }
  }
  return best;
}

const stopsCache = new WeakMap<SceneLayout, RealDataStop[]>();

/** Empty for every zone without a real terrain pack. For Teknaf today: the
 *  reference point itself (the real measured disturbance the scene is
 *  centred on) and the steepest real slope reachable on the walk. */
export function realTerrainStops(layout: SceneLayout): RealDataStop[] {
  if (!layout.realTerrain) return [];
  const cached = stopsCache.get(layout);
  if (cached) return cached;
  const stops: RealDataStop[] = [{ x: 0, z: 0, kind: "disturbance" }];
  const steepest = steepestRealPoint(layout);
  if (steepest.slope > 0.15) {
    stops.push({
      x: steepest.x,
      z: steepest.z,
      kind: "slope",
      slopeDegrees: Math.round((Math.atan(steepest.slope) * 180) / Math.PI),
    });
  }
  stopsCache.set(layout, stops);
  return stops;
}
