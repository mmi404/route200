"use client";

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { LOOK } from "../../_lib/look";
import { baseHeight, type RealDataStop, type SceneLayout } from "../../_lib/terrain";

type StopsProps = {
  layout: SceneLayout;
  stops: RealDataStop[];
};

const RING_COLOR = new THREE.Color(LOOK.sky.sunGlow);
/** Lays the ring (built facing +Z) flat on the ground, facing up. */
const TILT_FLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2);
const UP_AXIS = new THREE.Vector3(0, 1, 0);

/**
 * A quiet ring of light on the ground at each real-data stop (_lib/terrain.ts
 * realTerrainStops), marking where the scene's terrain is tied to an actual
 * measurement rather than invented. Non-collidable, severity-independent
 * (the ground beneath it can still change; the marker just tracks its
 * height), and empty for every zone without real terrain.
 */
export function Stops({ layout, stops }: StopsProps) {
  const ringRef = useRef<THREE.InstancedMesh>(null);
  const spinRef = useRef(0);
  const positions = useMemo(
    () => stops.map((stop) => ({ x: stop.x, z: stop.z, y: baseHeight(stop.x, stop.z, layout) })),
    [stops, layout],
  );

  useFrame((_, delta) => {
    const mesh = ringRef.current;
    if (!mesh) return;
    spinRef.current += delta * 0.25;
    const dummy = new THREE.Object3D();
    const spin = new THREE.Quaternion().setFromAxisAngle(UP_AXIS, spinRef.current);
    dummy.quaternion.copy(spin).multiply(TILT_FLAT);
    positions.forEach((p, i) => {
      dummy.position.set(p.x, p.y + 0.06, p.z);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
  });

  if (positions.length === 0) return null;

  return (
    <instancedMesh ref={ringRef} args={[undefined, undefined, positions.length]} frustumCulled={false}>
      <ringGeometry args={[0.9, 1.15, 32]} />
      <meshBasicMaterial color={RING_COLOR} transparent opacity={0.85} side={THREE.DoubleSide} />
    </instancedMesh>
  );
}
