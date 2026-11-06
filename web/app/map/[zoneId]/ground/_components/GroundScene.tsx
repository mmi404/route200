"use client";

import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { PALETTE, SEVERITY_FILL } from "@/lib/design-tokens";
import { severityToBand } from "@/lib/types";
import {
  baseHeight,
  clamp01,
  generatePatchSlots,
  generateTreeSlots,
  sceneLayoutForZone,
  smoothstep,
  terrainHeight,
  treeVisibility,
  type SceneLayout,
} from "../_lib/terrain";

type GroundSceneProps = {
  zoneId: string;
  /** Continuous 0-100 severity for the currently scrubbed day. */
  severity: number;
  reducedMotion: boolean;
};

const TREE_COUNT = 110;
const PATCH_COUNT = 14;

/**
 * The Ground View 3D scene (PROGRESS.md, "Phase 3: Ground View"): a
 * stylized, low-poly hillside the visitor can look around freely, where a
 * forest thins, a clearing opens, and a road and a house appear as the
 * zone's real recorded severity rises. Explicitly illustrative, not a
 * terrain or imagery reconstruction (that is the phase-2 /map/[zoneId]
 * page's job); see GroundView.tsx's caption copy for the same disclosure
 * shown to the visitor.
 *
 * @react-three/fiber's Canvas is SSR-safe on its own (it renders an inert
 * <canvas> wrapper during the server pass and defers all WebGL/context
 * work to effects, which never run on the server), the same reasoning
 * TerrainCanvas.tsx relies on for its own MapLibre container: no separate
 * client-only mount gate is needed here.
 */
export function GroundScene({ zoneId, severity, reducedMotion }: GroundSceneProps) {
  const layout = useMemo(() => sceneLayoutForZone(zoneId), [zoneId]);
  const severityFraction = clamp01(severity / 100);

  // Computed once per zone (not re-derived from the current severity, or
  // the camera would snap back to this spot every time the slider moves):
  // a standing point facing the scar/house from the opposite side of
  // structureAngle, at roughly eye height above the (pre-clearing) ground.
  const initialCameraPosition = useMemo((): [number, number, number] => {
    const standDistance = 13;
    const standAngle = layout.structureAngle + Math.PI;
    const x = layout.scarCenter.x + Math.cos(standAngle) * standDistance;
    const z = layout.scarCenter.z + Math.sin(standAngle) * standDistance;
    const y = baseHeight(x, z, layout) + 1.75;
    return [x, y, z];
  }, [layout]);

  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.75]}
      camera={{ fov: 55, near: 0.1, far: 120, position: initialCameraPosition }}
      className="h-full w-full"
    >
      <color attach="background" args={[PALETTE.riverLight]} />
      <fog attach="fog" args={[PALETTE.riverLight, 20, 58]} />
      <hemisphereLight args={[PALETTE.riverLight, PALETTE.well, 0.65]} />
      <directionalLight position={[18, 22, 10]} intensity={1.1} />
      <TerrainMesh layout={layout} severityFraction={severityFraction} />
      <TreeField layout={layout} severityFraction={severityFraction} />
      <ClearingPatches layout={layout} severityFraction={severityFraction} />
      <RoadAndHouse layout={layout} severityFraction={severityFraction} />
      <CameraRig layout={layout} reducedMotion={reducedMotion} />
    </Canvas>
  );
}

function TerrainMesh({
  layout,
  severityFraction,
}: {
  layout: SceneLayout;
  severityFraction: number;
}) {
  const geometry = useMemo(() => {
    const segments = 56;
    const size = layout.halfSize * 2;
    const geo = new THREE.PlaneGeometry(size, size, segments, segments);
    geo.rotateX(-Math.PI / 2);
    const position = geo.attributes.position;
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      position.setY(i, terrainHeight(x, z, layout, severityFraction));
    }
    geo.computeVertexNormals();
    return geo;
  }, [layout, severityFraction]);

  return (
    <mesh geometry={geometry} receiveShadow={false}>
      <meshStandardMaterial color={PALETTE.well} roughness={1} />
    </mesh>
  );
}

function TreeField({
  layout,
  severityFraction,
}: {
  layout: SceneLayout;
  severityFraction: number;
}) {
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const slots = useMemo(() => generateTreeSlots(layout, TREE_COUNT), [layout]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const canopy = canopyRef.current;
    const trunk = trunkRef.current;
    if (!canopy || !trunk) return;

    slots.forEach((slot, index) => {
      const visibility = treeVisibility(slot.clearRank, severityFraction);
      const scale = slot.baseScale * visibility;
      const groundY = terrainHeight(slot.x, slot.z, layout, severityFraction);

      dummy.position.set(slot.x, groundY + 0.9 * scale, slot.z);
      dummy.rotation.set(0, slot.rotationY, 0);
      dummy.scale.set(scale, scale, scale);
      dummy.updateMatrix();
      canopy.setMatrixAt(index, dummy.matrix);

      dummy.position.set(slot.x, groundY + 0.35 * scale, slot.z);
      dummy.scale.set(scale * 0.35, scale * 0.7, scale * 0.35);
      dummy.updateMatrix();
      trunk.setMatrixAt(index, dummy.matrix);
    });

    canopy.instanceMatrix.needsUpdate = true;
    trunk.instanceMatrix.needsUpdate = true;
  }, [slots, severityFraction, layout, dummy]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, slots.length]} frustumCulled={false}>
        <cylinderGeometry args={[0.1, 0.15, 1, 5]} />
        <meshStandardMaterial color={PALETTE.inkSubtle} roughness={0.95} />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, slots.length]} frustumCulled={false}>
        <coneGeometry args={[0.85, 1.8, 7]} />
        <meshStandardMaterial color={PALETTE.ok} roughness={0.85} />
      </instancedMesh>
    </>
  );
}

function ClearingPatches({
  layout,
  severityFraction,
}: {
  layout: SceneLayout;
  severityFraction: number;
}) {
  const slots = useMemo(() => generatePatchSlots(layout, PATCH_COUNT), [layout]);
  const activeCount = Math.round(
    smoothstep(severityFraction, 0.25, 0.9) * slots.length,
  );
  const band = severityToBand(severityFraction * 100).band;
  const color = SEVERITY_FILL[band];

  return (
    <>
      {slots.slice(0, activeCount).map((slot, index) => {
        const y = terrainHeight(slot.x, slot.z, layout, severityFraction) + 0.02;
        return (
          <mesh key={index} position={[slot.x, y, slot.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[slot.radius, 10]} />
            <meshStandardMaterial color={color} roughness={1} />
          </mesh>
        );
      })}
    </>
  );
}

function RoadAndHouse({
  layout,
  severityFraction,
}: {
  layout: SceneLayout;
  severityFraction: number;
}) {
  const appear = smoothstep(severityFraction, 0.55, 1);
  if (appear <= 0.01) return null;

  const scarY = terrainHeight(layout.scarCenter.x, layout.scarCenter.z, layout, severityFraction);
  const angle = layout.structureAngle;
  const houseOffset = 2.4;
  const houseX = layout.scarCenter.x + Math.cos(angle) * houseOffset;
  const houseZ = layout.scarCenter.z + Math.sin(angle) * houseOffset;
  const houseY = terrainHeight(houseX, houseZ, layout, severityFraction);

  return (
    <group scale={[appear, appear, appear]}>
      <mesh
        position={[layout.scarCenter.x, scarY + 0.03, layout.scarCenter.z]}
        rotation={[-Math.PI / 2, 0, angle]}
      >
        <planeGeometry args={[2.2, 9]} />
        <meshStandardMaterial color={PALETTE.ink} roughness={1} />
      </mesh>

      <group position={[houseX, houseY, houseZ]} rotation={[0, -angle, 0]}>
        <mesh position={[0, 0.65, 0]}>
          <boxGeometry args={[2.1, 1.3, 1.7]} />
          <meshStandardMaterial color={PALETTE.paperMuted} roughness={0.9} />
        </mesh>
        <mesh position={[0, 1.55, 0]} rotation={[0, Math.PI / 4, 0]}>
          <coneGeometry args={[1.55, 0.9, 4]} />
          <meshStandardMaterial color={PALETTE.ink} roughness={0.8} />
        </mesh>
      </group>
    </group>
  );
}

/** Free look-around camera: drag to orbit/zoom around the scar, the point
 *  of the scene, with no panning away from it (matches the user's own
 *  framing: "I will slide that and see... viewing everything on my own,"
 *  not a scripted flythrough). Distance and polar angle are both
 *  constrained so a visitor can't zoom through the ground or flip to a
 *  bird's-eye view that defeats the "standing here" feeling. */
function CameraRig({
  layout,
  reducedMotion,
}: {
  layout: SceneLayout;
  reducedMotion: boolean;
}) {
  const targetY = baseHeight(layout.scarCenter.x, layout.scarCenter.z, layout) * 0.3 + 1.1;
  return (
    <OrbitControls
      target={[layout.scarCenter.x, targetY, layout.scarCenter.z]}
      enablePan={false}
      enableDamping={!reducedMotion}
      dampingFactor={0.08}
      minDistance={4}
      maxDistance={20}
      minPolarAngle={0.25}
      maxPolarAngle={1.47}
    />
  );
}
