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

/** Two octaves of valueNoise2D, for a hillside with both a broad shape and
 *  finer roughness, still cheap to evaluate per vertex. */
function terrainNoise(x: number, z: number, seed: number): number {
  return (
    valueNoise2D(x * 0.09, z * 0.09, seed) * 0.75 +
    valueNoise2D(x * 0.23, z * 0.23, seed + 101) * 0.25
  );
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

export interface SceneLayout {
  seed: number;
  /** Half-extent of the ground plane on each axis, world units. */
  halfSize: number;
  /** Where the clearing/hill-cut scar is centered, local XZ. */
  scarCenter: { x: number; z: number };
  /** The house+road's facing angle, radians, so they sit naturally. */
  structureAngle: number;
}

/** One stable layout per zone id: where the hill-cut scar sits, which way
 *  the eventual road/house face. Independent of severity, so the *place*
 *  doesn't move as the slider scrubs, only its *state* does. */
export function sceneLayoutForZone(zoneId: string): SceneLayout {
  const seed = hashSeed(zoneId);
  const rng = createRng(seed);
  const halfSize = 22;
  const angle = rng() * Math.PI * 2;
  const radius = 6 + rng() * 8;
  return {
    seed,
    halfSize,
    scarCenter: { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius },
    structureAngle: rng() * Math.PI * 2,
  };
}

/**
 * Hillside height at a local (x, z), before any clearing. A broad radial
 * hill (peak offset from the scar so the scar reads as cut *into* a slope,
 * not centered on the summit) plus noise roughness.
 */
export function baseHeight(x: number, z: number, layout: SceneLayout): number {
  const peakX = layout.scarCenter.x * 0.4 + layout.halfSize * 0.15;
  const peakZ = layout.scarCenter.z * 0.4 - layout.halfSize * 0.1;
  const dx = x - peakX;
  const dz = z - peakZ;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const hill = Math.max(0, 1 - distance / (layout.halfSize * 1.05)) ** 1.6 * 7.5;
  const roughness = terrainNoise(x, z, layout.seed) * 0.9;
  return hill + roughness;
}

/**
 * Terrain height at (x, z) for a given severity fraction (0..1): the scar
 * area is pulled down toward a cleared plateau, growing in radius and depth
 * as severity rises. This is the literal "a hill was here, now it's not."
 */
export function terrainHeight(
  x: number,
  z: number,
  layout: SceneLayout,
  severityFraction: number,
): number {
  const base = baseHeight(x, z, layout);
  const scarStrength = smoothstep(severityFraction, 0.3, 1);
  if (scarStrength <= 0) return base;
  const dx = x - layout.scarCenter.x;
  const dz = z - layout.scarCenter.z;
  const distance = Math.sqrt(dx * dx + dz * dz);
  const maxRadius = 10;
  const radius = maxRadius * scarStrength;
  if (distance >= radius) return base;
  const falloff = smootherStep(1 - distance / radius);
  const clearedLevel = baseHeight(layout.scarCenter.x, layout.scarCenter.z, layout) * 0.12;
  return base + (clearedLevel - base) * falloff * scarStrength;
}

export interface TreeSlot {
  x: number;
  z: number;
  rotationY: number;
  baseScale: number;
  /** 0 = right at the scar center (clears first), 1 = farthest away. */
  clearRank: number;
}

/** A fixed, seeded scatter of tree positions across the plane, excluding a
 *  margin around the scar center (trees that will become the clearing
 *  shouldn't visibly float the moment it opens up). Sorted nearest-to-scar
 *  first so clearing order always reads as "outward from the cut," not a
 *  random flicker across the whole hillside. */
export function generateTreeSlots(layout: SceneLayout, count: number): TreeSlot[] {
  const rng = createRng(layout.seed + 7919);
  const slots: TreeSlot[] = [];
  const margin = layout.halfSize * 0.94;
  let attempts = 0;
  while (slots.length < count && attempts < count * 6) {
    attempts++;
    const x = (rng() * 2 - 1) * margin;
    const z = (rng() * 2 - 1) * margin;
    const dxScar = x - layout.scarCenter.x;
    const dzScar = z - layout.scarCenter.z;
    if (Math.sqrt(dxScar * dxScar + dzScar * dzScar) < 2.2) continue;
    slots.push({
      x,
      z,
      rotationY: rng() * Math.PI * 2,
      baseScale: 0.75 + rng() * 0.55,
      clearRank: 0,
    });
  }
  slots.sort((a, b) => {
    const da = (a.x - layout.scarCenter.x) ** 2 + (a.z - layout.scarCenter.z) ** 2;
    const db = (b.x - layout.scarCenter.x) ** 2 + (b.z - layout.scarCenter.z) ** 2;
    return da - db;
  });
  slots.forEach((slot, index) => {
    slot.clearRank = slots.length > 1 ? index / (slots.length - 1) : 0;
  });
  return slots;
}

/** How visible (0..1) a tree at this clearRank is at this severity fraction.
 *  A soft band around the current clearing edge, not a hard on/off cut, so
 *  scrubbing the slider reads as trees thinning, not a slideshow. A small
 *  fraction (maxClearedFraction short of 1) never clears, a fringe left
 *  standing even at the most severe recorded state. */
export function treeVisibility(clearRank: number, severityFraction: number): number {
  const maxClearedFraction = 0.9;
  const clearedFraction = smoothstep(severityFraction, 0, 1) * maxClearedFraction;
  const band = 0.07;
  return clamp01((clearRank - clearedFraction) / band + 0.5);
}

export interface PatchSlot {
  x: number;
  z: number;
  radius: number;
}

/** A fixed, seeded pool of bare-ground patch positions scattered inside the
 *  scar radius. Rendered count grows with severity (see GroundScene); the
 *  pool itself never changes, so a patch that appears always appears in the
 *  same place rather than reshuffling as the slider moves. */
export function generatePatchSlots(layout: SceneLayout, count: number): PatchSlot[] {
  const rng = createRng(layout.seed + 2027);
  const slots: PatchSlot[] = [];
  for (let i = 0; i < count; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = rng() * 8.5;
    slots.push({
      x: layout.scarCenter.x + Math.cos(angle) * radius,
      z: layout.scarCenter.z + Math.sin(angle) * radius,
      radius: 0.8 + rng() * 1.1,
    });
  }
  return slots;
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
