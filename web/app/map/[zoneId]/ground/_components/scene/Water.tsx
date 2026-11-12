"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LOOK, SUN_DIRECTION } from "../../_lib/look";
import type { Grid } from "../../_lib/realTerrain";
import type { SceneLayout } from "../../_lib/terrain";

const SUN = new THREE.Vector3(...SUN_DIRECTION).normalize();

const WATER_VERTEX = /* glsl */ `
#include <common>
#include <fog_pars_vertex>
attribute float aWaterAlpha;
varying vec3 vWorldPos;
varying float vWaterAlpha;
void main() {
  vWorldPos = position;
  vWaterAlpha = aWaterAlpha;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const WATER_FRAGMENT = /* glsl */ `
#include <common>
#include <fog_pars_fragment>
uniform float uTime;
uniform vec3 uSun;
uniform vec3 uDeep;
uniform vec3 uShallow;
uniform vec3 uFoam;
varying vec3 vWorldPos;
varying float vWaterAlpha;

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

void main() {
  vec2 p = vWorldPos.xz;
  float n1 = vn(p * 0.07 + uTime * 0.12);
  float n2 = vn(p * 0.17 - uTime * 0.08 + 5.0);
  float ripple = n1 * 0.6 + n2 * 0.4;
  vec3 normal = normalize(vec3((n1 - 0.5) * 0.4, 1.0, (n2 - 0.5) * 0.4));
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fresnel = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 3.0);

  vec3 col = mix(uDeep, uShallow, clamp(ripple * 0.7 + 0.2, 0.0, 1.0));
  float sparkle = pow(max(dot(reflect(-uSun, normal), viewDir), 0.0), 50.0);
  col += uFoam * sparkle * 0.7;
  col = mix(col, uFoam, fresnel * 0.3);

  float alpha = vWaterAlpha * (0.75 + fresnel * 0.22);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  #include <fog_fragment>
}
`;

/** A flat mesh at the real water grid's own resolution, so its edges trace
 *  the actual measured river shape instead of a rough approximation: each
 *  node sits exactly where the grid says, at a constant `levelY`, and a
 *  quad is skipped entirely when every one of its corners reads as dry
 *  (no stray geometry drawn over land far from the channel). */
function buildWaterGeometry(grid: Grid, levelY: number): THREE.BufferGeometry {
  const { width, height, cellSize, originX, originZ, values } = grid;
  const positions = new Float32Array(width * height * 3);
  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const k = row * width + col;
      positions[k * 3] = originX + col * cellSize;
      positions[k * 3 + 1] = levelY;
      positions[k * 3 + 2] = originZ + row * cellSize;
    }
  }
  const index: number[] = [];
  const DRY = 0.02;
  for (let row = 0; row < height - 1; row++) {
    for (let col = 0; col < width - 1; col++) {
      const a = row * width + col;
      const b = a + 1;
      const c = a + width;
      const d = c + 1;
      if (values[a] < DRY && values[b] < DRY && values[c] < DRY && values[d] < DRY) continue;
      index.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("aWaterAlpha", new THREE.BufferAttribute(values, 1));
  geo.setIndex(index);
  return geo;
}

type WaterProps = {
  layout: SceneLayout;
  reducedMotion: boolean;
};

/** The real river surface, present only for a zone whose real water grid
 *  has a meaningful amount of open water (_lib/realTerrain.ts); absent
 *  (renders nothing) for every other zone, including Teknaf. A cheap
 *  procedural ripple and sun glint, no reflections: this is a flat plane
 *  at the real measured water level, not a physical simulation. */
export function Water({ layout, reducedMotion }: WaterProps) {
  const water = layout.realTerrain?.water;
  const waterLevelM = layout.realTerrain?.waterLevelM;

  const geometry = useMemo(() => {
    if (!water || waterLevelM === undefined) return null;
    return buildWaterGeometry(water, waterLevelM);
  }, [water, waterLevelM]);

  const uniforms = useMemo(
    () => ({
      uTime: { value: 0 },
      uSun: { value: SUN },
      uDeep: { value: new THREE.Color(LOOK.water.deep) },
      uShallow: { value: new THREE.Color(LOOK.water.shallow) },
      uFoam: { value: new THREE.Color(LOOK.water.foam) },
    }),
    [],
  );

  const matRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (reducedMotion) return;
    const mat = matRef.current;
    if (mat) mat.uniforms.uTime.value = state.clock.elapsedTime;
  });

  useLayoutEffect(() => () => geometry?.dispose(), [geometry]);

  if (!geometry) return null;

  return (
    <mesh geometry={geometry} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={WATER_VERTEX}
        fragmentShader={WATER_FRAGMENT}
        transparent
        depthWrite={false}
        fog
      />
    </mesh>
  );
}
