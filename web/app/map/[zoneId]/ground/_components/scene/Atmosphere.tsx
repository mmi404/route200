"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LOOK, SUN_DIRECTION } from "../../_lib/look";
import { createRng, type SceneLayout } from "../../_lib/terrain";

type AtmosphereProps = {
  layout: SceneLayout;
  reducedMotion: boolean;
};

const SKY_RADIUS = 650;

const SUN = new THREE.Vector3(...SUN_DIRECTION).normalize();

// ---------------------------------------------------------------------------
// Sky dome: vertical gradient, warm sun glow and soft cloud bands. It is drawn
// first, never writes depth, ignores fog, and is not tone mapped: its horizon
// colour is the fog colour exactly, so distant terrain dissolves into it.
// ---------------------------------------------------------------------------

const SKY_VERTEX = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = /* glsl */ `
#include <common>
#include <dithering_pars_fragment>
uniform vec3 uZenith;
uniform vec3 uMid;
uniform vec3 uHorizon;
uniform vec3 uGlow;
uniform vec3 uSun;
uniform float uTime;
varying vec3 vDir;

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
float fbm(vec2 p) {
  float s = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    s += a * vn(p);
    p = mat2(1.6, 1.2, -1.2, 1.6) * p + 13.7;
    a *= 0.5;
  }
  return s / 0.9375;
}

void main() {
  vec3 dir = normalize(vDir);
  float h = max(dir.y, 0.0);
  vec3 c = mix(uHorizon, uMid, smoothstep(0.0, 0.3, h));
  c = mix(c, uZenith, smoothstep(0.22, 0.9, h));

  float sd = max(dot(dir, uSun), 0.0);
  float lowSky = 1.0 - smoothstep(0.0, 0.55, h);
  // Glow fades out at the horizon so the sky meets the (uniform) fog colour exactly.
  float aloft = smoothstep(0.02, 0.14, h);
  c = mix(c, uGlow, pow(sd, 3.0) * 0.2 * lowSky * aloft);
  c = mix(c, uGlow, pow(sd, 10.0) * 0.55 * aloft);
  c += uGlow * pow(sd, 120.0) * 0.45;
  c = mix(c, vec3(1.0, 0.97, 0.88), smoothstep(0.9988, 0.9996, sd));

  // Soft cloud bands, stretched along the horizon, fading toward it.
  vec2 uv = dir.xz / (h + 0.16) * 0.9 + vec2(uTime * 0.012, uTime * 0.004);
  float n = fbm(uv * vec2(0.8, 1.7) + 4.0);
  float cover = smoothstep(0.5, 0.78, n);
  float fade = smoothstep(0.05, 0.34, h) * (1.0 - smoothstep(0.82, 1.0, h) * 0.5);
  vec3 lit = mix(vec3(1.0, 0.98, 0.93), uGlow, 0.3 + 0.4 * pow(sd, 2.0));
  vec3 shade = mix(uMid, vec3(0.86, 0.88, 0.9), 0.5);
  float body = smoothstep(0.62, 0.92, n);
  vec3 cloud = mix(lit, shade, (1.0 - body) * 0.55);
  c = mix(c, cloud, cover * fade * 0.72);

  gl_FragColor = vec4(c, 1.0);
  #include <colorspace_fragment>
  #include <dithering_fragment>
}
`;

function SkyDome({ reducedMotion }: { reducedMotion: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.ShaderMaterial>(null);
  const uniforms = useMemo(
    () => ({
      uZenith: { value: new THREE.Color(LOOK.sky.zenith) },
      uMid: { value: new THREE.Color(LOOK.sky.mid) },
      uHorizon: { value: new THREE.Color(LOOK.sky.horizon) },
      uGlow: { value: new THREE.Color(LOOK.sky.sunGlow) },
      uSun: { value: SUN },
      uTime: { value: 0 },
    }),
    [],
  );

  useFrame((state) => {
    const mesh = meshRef.current;
    if (mesh) mesh.position.copy(state.camera.position);
    const mat = matRef.current;
    if (mat && !reducedMotion) mat.uniforms.uTime.value = state.clock.elapsedTime;
  });

  return (
    <mesh ref={meshRef} renderOrder={-1000} frustumCulled={false}>
      <sphereGeometry args={[SKY_RADIUS, 32, 20]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={SKY_VERTEX}
        fragmentShader={SKY_FRAGMENT}
        side={THREE.BackSide}
        depthWrite={false}
        depthTest={false}
        fog={false}
        toneMapped={false}
        dithering
      />
    </mesh>
  );
}

// ---------------------------------------------------------------------------
// Far hill ranges: ridge-line walls beyond the terrain, paler toward the
// horizon. Unlit, fog-free, hand-coloured, stable per zone seed.
// ---------------------------------------------------------------------------

const RIDGES = [
  { radius: 230, colour: LOOK.far.ridgeNear, minDeg: 19, maxDeg: 33, salt: 101 },
  { radius: 345, colour: LOOK.far.ridgeMid, minDeg: 16, maxDeg: 27, salt: 202 },
  { radius: 495, colour: LOOK.far.ridgeFar, minDeg: 13, maxDeg: 22, salt: 303 },
] as const;

const RIDGE_SEGMENTS = 288;
const RIDGE_FLOOR = -40;

/** A periodic ridge profile in 0..1 around the full circle: a few seeded
 *  sines of falling amplitude, folded so peaks are sharper than valleys. */
function ridgeProfile(seed: number): (angle: number) => number {
  const rng = createRng(seed);
  const waves = [3, 5, 8, 13, 21, 34].map((freq, i) => ({
    freq,
    amp: 1 / (1 + i * 0.9),
    phase: rng() * Math.PI * 2,
  }));
  const total = waves.reduce((sum, w) => sum + w.amp, 0);
  return (angle) => {
    let v = 0;
    for (const w of waves) v += w.amp * Math.sin(w.freq * angle + w.phase);
    const t = v / total; // about -1..1
    const folded = 1 - Math.abs(t * 1.25 - 0.1);
    return Math.max(0, Math.min(1, 0.25 + 0.75 * folded));
  };
}

function buildRidgeGeometry(
  seed: number,
  ring: (typeof RIDGES)[number],
): THREE.BufferGeometry {
  const profile = ridgeProfile(seed + ring.salt);
  const horizon = new THREE.Color(LOOK.sky.horizon);
  const top = new THREE.Color(ring.colour);
  const mist = horizon.clone().lerp(top, 0.55);
  const positions: number[] = [];
  const colors: number[] = [];
  const index: number[] = [];
  const stack = 3;
  for (let i = 0; i <= RIDGE_SEGMENTS; i++) {
    const a = (i / RIDGE_SEGMENTS) * Math.PI * 2;
    const deg = ring.minDeg + (ring.maxDeg - ring.minDeg) * profile(a);
    const height = Math.tan((deg * Math.PI) / 180) * ring.radius;
    const x = Math.cos(a) * ring.radius;
    const z = Math.sin(a) * ring.radius;
    const ys = [RIDGE_FLOOR, height * 0.4, height];
    const cs = [horizon, mist, top];
    for (let k = 0; k < stack; k++) {
      positions.push(x, ys[k], z);
      colors.push(cs[k].r, cs[k].g, cs[k].b);
    }
    if (i < RIDGE_SEGMENTS) {
      for (let k = 0; k < stack - 1; k++) {
        const a0 = i * stack + k;
        const b0 = (i + 1) * stack + k;
        index.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(index);
  return geo;
}

function FarRidges({ seed }: { seed: number }) {
  const groupRef = useRef<THREE.Group>(null);
  const geometries = useMemo(() => RIDGES.map((ring) => buildRidgeGeometry(seed, ring)), [seed]);

  // Follow the camera in the ground plane so the ranges stay at infinity.
  useFrame((state) => {
    const group = groupRef.current;
    if (group) group.position.set(state.camera.position.x, 0, state.camera.position.z);
  });

  return (
    <group ref={groupRef}>
      {geometries.map((geometry, i) => (
        <mesh key={RIDGES[i].radius} geometry={geometry} frustumCulled={false}>
          <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog={false} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Sky, fog, far ranges and lights for the Ground View scene. Everything is
 * procedural; the fog colour is `LOOK.sky.horizon`, the same colour the sky
 * and the far ranges fade to.
 */
export function Atmosphere({ layout, reducedMotion }: AtmosphereProps) {
  const sunPosition = useMemo(
    () => SUN.clone().multiplyScalar(120).toArray() as [number, number, number],
    [],
  );
  return (
    <>
      <color attach="background" args={[LOOK.sky.horizon]} />
      <fogExp2 attach="fog" args={[LOOK.sky.horizon, LOOK.atmosphere.fogDensity]} />
      <SkyDome reducedMotion={reducedMotion} />
      <FarRidges seed={layout.seed} />
      <hemisphereLight
        args={[LOOK.light.skyFill, LOOK.light.groundBounce, LOOK.atmosphere.fillIntensity]}
      />
      <directionalLight
        color={LOOK.light.sun}
        intensity={LOOK.atmosphere.sunIntensity}
        position={sunPosition}
      />
    </>
  );
}
