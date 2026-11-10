"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { LOOK } from "../../_lib/look";
import type { GroundQuality } from "../../_lib/quality";
import {
  baseHeight,
  roadAppear,
  roadInfo,
  roadWidth,
  smoothstep,
  surfaceFromBase,
  type SceneLayout,
  type SurfaceSample,
} from "../../_lib/terrain";

export type { GroundQuality };

type TerrainProps = {
  layout: SceneLayout;
  /** 0..1 */
  severityFraction: number;
  quality?: GroundQuality;
};

/** Cells are uniform inside this half-extent (a bit past the walkable disc). */
const FINE_HALF = 72;
/** The mesh runs this far past `worldRadius`, dropping away behind the ridge crest. */
const SKIRT = 50;
/** Severities sampled once per layout to find which vertices can ever change. */
const SEVERITY_PROBES = [1, 0.85, 0.7, 0.55, 0.4, 0.25];
/** How far the skirt falls (metres), so it can never rise above the far ranges. */
const SKIRT_DROP = 90;

/** Positive half of one grid axis: uniform `fine` spacing out to FINE_HALF,
 *  then spacing that grows geometrically out to `limit`. */
function axisHalf(fine: number, limit: number, growth: number): number[] {
  const steps = Math.round(FINE_HALF / fine);
  const step = FINE_HALF / steps;
  const out: number[] = [];
  for (let i = 0; i <= steps; i++) out.push(i * step);
  let at = FINE_HALF;
  let s = step;
  while (at < limit) {
    s *= growth;
    at = Math.min(limit, at + s);
    out.push(at);
  }
  return out;
}

/** Full symmetric axis lines, -limit .. limit. */
function axisLines(fine: number, limit: number, growth: number): number[] {
  const half = axisHalf(fine, limit, growth);
  const lines: number[] = [];
  for (let i = half.length - 1; i > 0; i--) lines.push(-half[i]);
  return lines.concat(half);
}

/** Smooth normals for the tensor grid by central differences on the height
 *  field (about five times cheaper than a generic computeVertexNormals pass,
 *  and exact for non-uniform spacing). */
function writeGridNormals(
  normal: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  position: THREE.BufferAttribute | THREE.InterleavedBufferAttribute,
  lines: number[],
  range?: { i0: number; i1: number; j0: number; j1: number },
): void {
  const n = lines.length;
  const iStart = range ? range.i0 : 0;
  const iEnd = range ? range.i1 : n - 1;
  const jStart = range ? range.j0 : 0;
  const jEnd = range ? range.j1 : n - 1;
  for (let j = jStart; j <= jEnd; j++) {
    const j0 = Math.max(0, j - 1);
    const j1 = Math.min(n - 1, j + 1);
    const dz = lines[j1] - lines[j0];
    for (let i = iStart; i <= iEnd; i++) {
      const i0 = Math.max(0, i - 1);
      const i1 = Math.min(n - 1, i + 1);
      const gx = (position.getY(j * n + i1) - position.getY(j * n + i0)) / (lines[i1] - lines[i0]);
      const gz = (position.getY(j1 * n + i) - position.getY(j0 * n + i)) / dz;
      const inv = 1 / Math.sqrt(gx * gx + 1 + gz * gz);
      normal.setXYZ(j * n + i, -gx * inv, inv, -gz * inv);
    }
  }
}

// ---------------------------------------------------------------------------
// Ground shader: three's Lambert lighting and fog, with the albedo replaced
// by procedural world-space noise. Colours come from LOOK and are baked into
// the source as linear constants.
// ---------------------------------------------------------------------------

function glslColor(hex: string): string {
  const c = new THREE.Color(hex);
  return `vec3(${c.r.toFixed(5)}, ${c.g.toFixed(5)}, ${c.b.toFixed(5)})`;
}

/**
 * GROUND_LOW compiles the cheaper path for phones: fbm drops from three
 * octaves to two, and the close-range detail terms (mottling, clumps, blade
 * speckle, rill warp, pebbles and clods) are skipped. The large-scale look
 * (moss, litter, soil, road, dapple) is unchanged.
 */
function groundShaderSource(quality: GroundQuality): string {
  const g = LOOK.ground;
  const r = LOOK.road;
  return /* glsl */ `
${quality === "low" ? "#define GROUND_LOW" : ""}
const vec3 C_GRASS_LIGHT = ${glslColor(g.grassLight)};
const vec3 C_GRASS = ${glslColor(g.grass)};
const vec3 C_GRASS_SHADE = ${glslColor(g.grassShade)};
const vec3 C_LITTER = ${glslColor(g.leafLitter)};
const vec3 C_SOIL_DRY = ${glslColor(g.soilDry)};
const vec3 C_SOIL = ${glslColor(g.soil)};
const vec3 C_SOIL_CUT = ${glslColor(g.soilCut)};
const vec3 C_ROCK = ${glslColor(g.rock)};
const vec3 C_ROAD = ${glslColor(r.surface)};
const vec3 C_TRACK = ${glslColor(r.track)};
const vec3 C_ROAD_EDGE = ${glslColor(r.edge)};
const float ROAD_HALF = ${(roadWidth / 2).toFixed(3)};

float h21(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float vn(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), u.x),
             mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), u.x), u.y);
}
const mat2 ROT = mat2(1.6, 1.2, -1.2, 1.6);
float fbm3(vec2 p) {
  p = mat2(0.8, 0.6, -0.6, 0.8) * p;
#ifdef GROUND_LOW
  float s = 0.5 * vn(p);
  p = ROT * p + 17.1;
  s += 0.25 * vn(p);
  return s / 0.75;
#else
  float s = 0.5 * vn(p);
  p = ROT * p + 17.1;
  s += 0.25 * vn(p);
  p = ROT * p + 9.7;
  s += 0.125 * vn(p);
  return s / 0.875;
#endif
}

varying vec3 vGWorld;
varying vec3 vGNormal;
varying float vGCleared;
varying vec2 vGRoad;

vec3 groundAlbedo(float viewDist) {
  vec2 p = vGWorld.xz;
  vec3 n = normalize(vGNormal);
  float slope = 1.0 - clamp(n.y, 0.0, 1.0);
  float nearK = 1.0 - smoothstep(18.0, 60.0, viewDist);
  float midK = 1.0 - smoothstep(45.0, 110.0, viewDist);

  float broad = fbm3(p * 0.03 + 11.0);
  float patchN = fbm3(p * 0.14 + 3.0);
  float steep = smoothstep(0.10, 0.34, slope);
  float cutFace = smoothstep(0.09, 0.30, slope);

  // Forest floor: varied greens, mossy hollows, brown leaf litter.
  vec3 f = mix(C_GRASS, C_GRASS_LIGHT, smoothstep(0.38, 0.72, patchN));
  float moss = smoothstep(0.42, 0.7, fbm3(p * 0.085 + 40.0));
  f = mix(f, C_GRASS_SHADE, moss * 0.85);
  float litter = smoothstep(0.56, 0.68, fbm3(p * 0.21 + 70.0));
  f = mix(f, C_LITTER, litter * 0.55 * midK);
#ifndef GROUND_LOW
  // Painterly mottling: organic darker and lighter clumps, then fine blade speckle.
  float mott = fbm3(p * 1.25 + 30.0);
  f = mix(f, f * 0.9, smoothstep(0.5, 0.66, mott) * nearK);
  float clump = fbm3(p * 2.3 + 60.0);
  f = mix(f, mix(f, C_GRASS_LIGHT, 0.55), smoothstep(0.56, 0.7, clump) * 0.3 * nearK);
  f *= 0.95 + 0.1 * mix(0.5, vn(p * vec2(9.0, 5.0)), nearK);
#endif
  f = mix(f, mix(C_ROCK, C_SOIL_CUT, 0.45 + 0.4 * patchN), steep * mix(0.1, 0.5, midK));

  // Cleared earth: dry lighter tops, darker freshly cut faces, rills, clods.
  vec3 s = mix(C_SOIL, C_SOIL_DRY, smoothstep(0.3, 0.7, broad) * 0.8 + 0.1);
  s = mix(s, C_SOIL_DRY, (1.0 - cutFace) * smoothstep(0.5, 0.75, patchN) * 0.5);
  s = mix(s, C_SOIL_CUT, cutFace * (0.55 + 0.35 * patchN));
  vec2 dir = normalize(n.xz + vec2(1e-5));
  vec2 perp = vec2(-dir.y, dir.x);
#ifdef GROUND_LOW
  float warp = vn(p * 0.18 + 21.0) * 9.0;
#else
  float warp = fbm3(p * 0.18 + 21.0) * 9.0;
#endif
  float rills = vn(vec2(dot(p, perp) * 2.3 + warp, dot(p, dir) * 0.32 + warp * 0.7));
  rills = smoothstep(0.55, 0.85, rills);
  s *= 1.0 - rills * smoothstep(0.05, 0.22, slope) * 0.26 * midK;
#ifndef GROUND_LOW
  vec2 cell = p * 4.5;
  vec2 id = floor(cell);
  vec2 fc = fract(cell) - 0.5 - (vec2(h21(id + 3.1), h21(id + 7.7)) - 0.5) * 0.5;
  float pick = h21(id);
  float dotM = 1.0 - smoothstep(0.07, 0.13, length(fc));
  float pebble = step(0.82, pick) * dotM;
  float clod = step(0.6, pick) * (1.0 - step(0.82, pick)) * dotM;
  s = mix(s, mix(C_ROCK, C_SOIL_DRY, 0.35), pebble * 0.85 * nearK);
  s *= 1.0 - clod * 0.22 * nearK;
  s *= 0.95 + 0.1 * mix(0.5, vn(p * 2.1), nearK);
#endif

  // Irregular, noise-broken edge between forest floor and cleared earth.
  float edgeN = fbm3(p * 0.42 + 5.0) * 0.65 + vn(p * 1.6) * 0.35;
  float m = smoothstep(0.42, 0.58, vGCleared + (edgeN - 0.5) * 0.8);
  float disturbed = m * (1.0 - smoothstep(0.55, 0.9, vGCleared)) * 0.4;
  vec3 col = mix(f, s * (1.0 - disturbed * 0.3), m);

  // Road painted onto the terrain: packed dirt, two lighter wheel tracks,
  // darker damp edges.
  float d = vGRoad.x;
  float a = vGRoad.y;
  if (a > 0.0 && d < ROAD_HALF + 1.0) {
    float jit = (vn(p * 0.8) - 0.5) * 0.4;
    float rm = (1.0 - smoothstep(ROAD_HALF - 0.2, ROAD_HALF + 0.2, d + jit)) * a;
    vec3 rd = C_ROAD * (0.96 + 0.08 * vn(p * 1.3));
    float track = exp(-pow((d - 0.85) / 0.3, 2.0)) * (0.55 + 0.45 * vn(p * 0.7 + 2.0));
    rd = mix(rd, C_TRACK, track * 0.9);
    rd = mix(rd, mix(C_ROAD, C_SOIL, 0.6), (1.0 - smoothstep(0.0, 0.5, d)) * 0.5);
    rd = mix(rd, C_ROAD_EDGE, smoothstep(1.3, ROAD_HALF, d) * 0.75);
    col = mix(col, rd, rm);
    m = max(m, rm);
  }

  // Under the canopy: dappled light on the forest floor, fading with distance.
  float forest = 1.0 - m;
  float dap = fbm3(p * 0.33 + 91.0) * 0.6 + vn(p * 0.95 + 7.0) * 0.4;
  float lit = smoothstep(0.44, 0.64, dap);
  float dapple = mix(0.64, 1.2, lit);
  col *= mix(1.0, mix(0.84, dapple, nearK), forest);
  return col;
}
`;
}

type ShaderParts = { vertexShader: string; fragmentShader: string };

const cachedSource: Partial<Record<GroundQuality, string>> = {};

function patchGroundShader(shader: ShaderParts, quality: GroundQuality): void {
  const source = (cachedSource[quality] ??= groundShaderSource(quality));
  shader.vertexShader = shader.vertexShader
    .replace(
      "#include <common>",
      `#include <common>
attribute float aCleared;
attribute vec2 aRoad;
varying vec3 vGWorld;
varying vec3 vGNormal;
varying float vGCleared;
varying vec2 vGRoad;`,
    )
    .replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
vGWorld = position;
vGNormal = normal;
vGCleared = aCleared;
vGRoad = aRoad;`,
    );
  shader.fragmentShader = shader.fragmentShader
    .replace("#include <common>", `#include <common>\n${source}`)
    .replace(
      "#include <color_fragment>",
      "#include <color_fragment>\ndiffuseColor.rgb = groundAlbedo(length(vViewPosition));",
    );
}

// Module-level so the material gets stable props (and a distinct program
// cache key per tier: three's cache would otherwise share one compiled
// program between the two sources).
const PATCH_BY_QUALITY: Record<GroundQuality, (shader: ShaderParts) => void> = {
  high: (shader) => patchGroundShader(shader, "high"),
  low: (shader) => patchGroundShader(shader, "low"),
};
const CACHE_KEY_BY_QUALITY: Record<GroundQuality, () => string> = {
  high: () => "ground-high",
  low: () => "ground-low",
};

/**
 * The displaced terrain mesh. One tensor grid: 1 m cells inside the walkable
 * area, cells that widen geometrically beyond it, and a skirt that falls away
 * past the ridge crest (out of sight, so the world never shows an edge).
 *
 * Base heights and the road distance are severity independent and computed
 * once per layout. A severity change only rewrites heights, the `cleared`
 * attribute and the road-appear factor in place, then recomputes normals.
 * All colour is a fragment shader (see groundShaderSource), so detail does not
 * depend on vertex density.
 */
export function Terrain({ layout, severityFraction, quality = "high" }: TerrainProps) {
  const { geometry, baseHeights, roadDist, lines, affected, span } = useMemo(() => {
    const fine = quality === "high" ? 1 : 1.8;
    const limit = layout.worldRadius + SKIRT;
    const lines = axisLines(fine, limit, quality === "high" ? 1.1 : 1.16);
    const n = lines.length;
    const count = n * n;
    const positions = new Float32Array(count * 3);
    const base = new Float32Array(count);
    const road = new Float32Array(count);
    const roadAttr = new Float32Array(count * 2);
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = j * n + i;
        const x = lines[i];
        const z = lines[j];
        positions[k * 3] = x;
        positions[k * 3 + 2] = z;
        base[k] = baseHeight(x, z, layout);
        road[k] = Math.min(60, roadInfo(x, z, layout).dist);
        roadAttr[k * 2] = road[k];
      }
    }
    const index = new Uint32Array((n - 1) * (n - 1) * 6);
    let w = 0;
    for (let j = 0; j < n - 1; j++) {
      for (let i = 0; i < n - 1; i++) {
        const a = j * n + i;
        const b = a + 1;
        const c = a + n;
        const d = c + 1;
        // Alternate the diagonal so facets do not all lean one way.
        if ((i + j) % 2 === 0) {
          index.set([a, c, b, b, c, d], w);
        } else {
          index.set([a, c, d, a, d, b], w);
        }
        w += 6;
      }
    }
    // Most of the world never changes with severity. Write its resting state
    // once and remember only the vertices the cut, the road or the house pad
    // can ever touch, so a slider tick rewrites a fraction of the grid.
    const clearedInit = new Float32Array(count);
    const affectedList: number[] = [];
    const probe: SurfaceSample = { height: 0, cleared: 0 };
    const skirtStart = layout.worldRadius;
    for (let k = 0; k < count; k++) {
      const x = positions[k * 3];
      const z = positions[k * 3 + 2];
      const fall = smoothstep(Math.hypot(x, z), skirtStart, skirtStart + SKIRT);
      positions[k * 3 + 1] = base[k] - fall * SKIRT_DROP;
      let touched = road[k] < roadWidth / 2 + 2;
      for (const sev of SEVERITY_PROBES) {
        if (touched) break;
        surfaceFromBase(base[k], x, z, layout, sev, probe);
        touched = probe.cleared > 1e-4 || Math.abs(probe.height - base[k]) > 1e-4;
      }
      if (touched) affectedList.push(k);
    }
    const affected = Uint32Array.from(affectedList);
    // Grid rectangle (one cell wider) that contains every changeable vertex:
    // normals only need recomputing inside it.
    const span = { i0: n - 1, i1: 0, j0: n - 1, j1: 0 };
    for (const k of affectedList) {
      const i = k % n;
      const j = (k - i) / n;
      span.i0 = Math.min(span.i0, Math.max(0, i - 1));
      span.i1 = Math.max(span.i1, Math.min(n - 1, i + 1));
      span.j0 = Math.min(span.j0, Math.max(0, j - 1));
      span.j1 = Math.max(span.j1, Math.min(n - 1, j + 1));
    }
    const normalAttr = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    writeGridNormals(normalAttr, new THREE.BufferAttribute(positions, 3), lines);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("normal", normalAttr);
    geo.setAttribute("aCleared", new THREE.BufferAttribute(clearedInit, 1));
    geo.setAttribute("aRoad", new THREE.BufferAttribute(roadAttr, 2));
    geo.setIndex(new THREE.BufferAttribute(index, 1));
    return { geometry: geo, baseHeights: base, roadDist: road, lines, affected, span };
  }, [layout, quality]);

  const meshRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    // Written through the mesh ref: the geometry is a hook-derived value the
    // React lint rules treat as immutable, but its buffers are ours to update.
    const target = meshRef.current?.geometry;
    if (!target) return;
    const position = target.attributes.position;
    const cleared = target.attributes.aCleared;
    const road = target.attributes.aRoad;
    const sample: SurfaceSample = { height: 0, cleared: 0 };
    const appear = roadAppear(severityFraction);
    const skirtStart = layout.worldRadius;
    for (let n = 0; n < affected.length; n++) {
      const i = affected[n];
      const x = position.getX(i);
      const z = position.getZ(i);
      surfaceFromBase(baseHeights[i], x, z, layout, severityFraction, sample);
      const fall = smoothstep(Math.hypot(x, z), skirtStart, skirtStart + SKIRT);
      position.setY(i, sample.height - fall * SKIRT_DROP);
      cleared.setX(i, sample.cleared);
      road.setXY(i, roadDist[i], appear);
    }
    position.needsUpdate = true;
    cleared.needsUpdate = true;
    road.needsUpdate = true;
    if (affected.length > 0) writeGridNormals(target.attributes.normal, position, lines, span);
    target.attributes.normal.needsUpdate = true;
  }, [geometry, baseHeights, roadDist, lines, affected, span, layout, severityFraction]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh ref={meshRef} geometry={geometry} frustumCulled={false}>
      <meshLambertMaterial
        key={quality}
        onBeforeCompile={PATCH_BY_QUALITY[quality]}
        customProgramCacheKey={CACHE_KEY_BY_QUALITY[quality]}
      />
    </mesh>
  );
}
