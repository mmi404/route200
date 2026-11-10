"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  HOUSE_SIZE,
  houseAppear,
  roadAppear,
  roadWidth,
  terrainHeight,
  type SceneLayout,
} from "../../_lib/terrain";

type SettlementProps = {
  layout: SceneLayout;
  /** 0..1 */
  severityFraction: number;
};

/** Spacing of the road ribbon's cross sections, metres. */
const RIBBON_STEP = 1.2;
/** Vertices across the ribbon (left edge, centre, right edge). */
const ACROSS = 3;
/** Lift above the terrain so the ribbon never z-fights with it. */
const ROAD_LIFT = 0.1;

const ROOF_HEIGHT = 1.7;

/** Road centreline resampled to roughly RIBBON_STEP spacing, with a unit
 *  left-hand normal at each sample. Once per layout. */
function resampleRoad(layout: SceneLayout) {
  const points: Array<{ x: number; z: number }> = [];
  const road = layout.road;
  for (let i = 0; i < road.length - 1; i++) {
    const a = road[i];
    const b = road[i + 1];
    const steps = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.z - a.z) / RIBBON_STEP));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      points.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  points.push(road[road.length - 1]);
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const len = Math.hypot(next.x - prev.x, next.z - prev.z) || 1;
    return { x: p.x, z: p.z, nx: -(next.z - prev.z) / len, nz: (next.x - prev.x) / len };
  });
}

/** Road ribbon and house. Both grow in place with roadAppear / houseAppear:
 *  each piece's anchor sits on an unscaled group and only its own geometry
 *  is scaled (scaling a group that carries a world position drags the piece
 *  toward the origin; see PROGRESS.md, Phase 3). */
export function Settlement({ layout, severityFraction }: SettlementProps) {
  return (
    <>
      <Road layout={layout} severityFraction={severityFraction} />
      <House layout={layout} severityFraction={severityFraction} />
    </>
  );
}

function Road({ layout, severityFraction }: SettlementProps) {
  const samples = useMemo(() => resampleRoad(layout), [layout]);
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute(
      "position",
      new THREE.BufferAttribute(new Float32Array(samples.length * ACROSS * 3), 3),
    );
    const index: number[] = [];
    for (let i = 0; i < samples.length - 1; i++) {
      for (let j = 0; j < ACROSS - 1; j++) {
        const a = i * ACROSS + j;
        const b = a + 1;
        const c = a + ACROSS;
        const d = c + 1;
        index.push(a, c, b, b, c, d);
      }
    }
    geo.setIndex(index);
    return geo;
  }, [samples]);

  const appear = roadAppear(severityFraction);
  const meshRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    const target = meshRef.current?.geometry;
    if (!target) return;
    const position = target.attributes.position;
    const half = (roadWidth / 2) * roadAppear(severityFraction);
    samples.forEach((s, i) => {
      for (let j = 0; j < ACROSS; j++) {
        const across = (j / (ACROSS - 1)) * 2 - 1;
        const x = s.x + s.nx * half * across;
        const z = s.z + s.nz * half * across;
        position.setXYZ(i * ACROSS + j, x, terrainHeight(x, z, layout, severityFraction) + ROAD_LIFT, z);
      }
    });
    position.needsUpdate = true;
    target.computeVertexNormals();
    target.computeBoundingSphere();
  }, [geometry, samples, layout, severityFraction]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh ref={meshRef} geometry={geometry} visible={appear > 0.01} frustumCulled={false}>
      <meshStandardMaterial
        color="#5d554a"
        roughness={1}
        side={THREE.DoubleSide}
        polygonOffset
        polygonOffsetFactor={-2}
        polygonOffsetUnits={-2}
      />
    </mesh>
  );
}

function House({ layout, severityFraction }: SettlementProps) {
  const appear = houseAppear(severityFraction);
  const { x, z, yaw } = layout.house;
  const y = terrainHeight(x, z, layout, severityFraction);
  const roofGeometry = useMemo(() => {
    // Square-based pyramid aligned to the axes (a 4-sided cone is a
    // diamond until rotated 45 degrees); scaled to the footprint below.
    const geo = new THREE.ConeGeometry(1, 1, 4);
    geo.rotateY(Math.PI / 4);
    return geo;
  }, []);
  useLayoutEffect(() => () => roofGeometry.dispose(), [roofGeometry]);

  const { width, depth, wallHeight } = HOUSE_SIZE;
  const foundation = 0.8;
  return (
    <group position={[x, y, z]} rotation={[0, yaw, 0]} visible={appear > 0.01}>
      <group scale={[appear, appear, appear]}>
        <mesh position={[0, (wallHeight - foundation) / 2, 0]}>
          <boxGeometry args={[width, wallHeight + foundation, depth]} />
          <meshStandardMaterial color="#b8a88e" roughness={0.95} />
        </mesh>
        <mesh
          geometry={roofGeometry}
          position={[0, wallHeight + ROOF_HEIGHT / 2, 0]}
          scale={[(width + 1) / Math.SQRT2, ROOF_HEIGHT, (depth + 1) / Math.SQRT2]}
        >
          <meshStandardMaterial color="#7a4a38" roughness={0.85} />
        </mesh>
        {/* Door on the +Z face, which faces the road. */}
        <mesh position={[0, 0.95, depth / 2 + 0.02]}>
          <boxGeometry args={[1, 1.9, 0.08]} />
          <meshStandardMaterial color="#3a2b22" roughness={0.9} />
        </mesh>
      </group>
    </group>
  );
}
