"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import {
  baseHeight,
  terrainHeightFromBase,
  treeVisibility,
  type SceneLayout,
  type TreeSlot,
} from "../../_lib/terrain";

type ForestProps = {
  layout: SceneLayout;
  trees: TreeSlot[];
  /** 0..1 */
  severityFraction: number;
};

/** Nominal tree height in metres at baseScale 1 (so 6 to 13 m overall). */
const TREE_HEIGHT = 9;
/** Share of the height that is bare trunk before the canopy starts. */
const TRUNK_SHARE = 0.55;
/** Trunk base radius at scale 1. PlayerController collides with this. */
const TRUNK_RADIUS = 0.35;
/** Canopy radius (m at scale 1) and tint per `variant`; placeholder art. */
const CANOPY_RADIUS = [3.0, 2.5, 3.4, 2.8];
const CANOPY_TINT = ["#2e6b3e", "#3a7a45", "#285f37", "#427f3d"];

/**
 * Instanced trunks and canopies: simple cone/cylinder placeholders at human
 * scale. The vegetation pass replaces the geometry/material; keep the
 * per-slot matrix update (visibility + ground height per severity) as is.
 */
export function Forest({ layout, trees, severityFraction }: ForestProps) {
  const trunkRef = useRef<THREE.InstancedMesh>(null);
  const canopyRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const baseHeights = useMemo(
    () => Float32Array.from(trees, (tree) => baseHeight(tree.x, tree.z, layout)),
    [trees, layout],
  );

  // Per-instance canopy tint, once per tree set.
  useLayoutEffect(() => {
    const canopy = canopyRef.current;
    if (!canopy) return;
    const color = new THREE.Color();
    trees.forEach((tree, index) => {
      color.set(CANOPY_TINT[tree.variant] ?? CANOPY_TINT[0]);
      color.offsetHSL(0, 0, (tree.jitter - 0.5) * 0.08);
      canopy.setColorAt(index, color);
    });
    if (canopy.instanceColor) canopy.instanceColor.needsUpdate = true;
  }, [trees]);

  useLayoutEffect(() => {
    const trunk = trunkRef.current;
    const canopy = canopyRef.current;
    if (!trunk || !canopy) return;

    trees.forEach((tree, index) => {
      const scale = tree.baseScale * treeVisibility(tree, layout, severityFraction);
      const ground = terrainHeightFromBase(
        baseHeights[index],
        tree.x,
        tree.z,
        layout,
        severityFraction,
      );
      const height = TREE_HEIGHT * scale;
      const trunkHeight = height * TRUNK_SHARE + 0.4 * scale;
      const canopyHeight = height * (1 - TRUNK_SHARE) + 1.2 * scale;
      const canopyRadius = (CANOPY_RADIUS[tree.variant] ?? 3) * scale;

      // Trunk: unit-height cylinder, base sunk slightly into the ground.
      dummy.position.set(tree.x, ground - 0.3 * scale + trunkHeight / 2, tree.z);
      dummy.rotation.set(0, tree.rotationY, 0);
      dummy.scale.set(scale, trunkHeight, scale);
      dummy.updateMatrix();
      trunk.setMatrixAt(index, dummy.matrix);

      // Canopy: unit cone sitting on top of the bare trunk.
      dummy.position.set(
        tree.x,
        ground - 0.3 * scale + height * TRUNK_SHARE + canopyHeight / 2,
        tree.z,
      );
      dummy.scale.set(canopyRadius, canopyHeight, canopyRadius);
      dummy.updateMatrix();
      canopy.setMatrixAt(index, dummy.matrix);
    });
    trunk.instanceMatrix.needsUpdate = true;
    canopy.instanceMatrix.needsUpdate = true;
  }, [trees, layout, baseHeights, severityFraction, dummy]);

  return (
    <>
      <instancedMesh ref={trunkRef} args={[undefined, undefined, trees.length]} frustumCulled={false}>
        <cylinderGeometry args={[TRUNK_RADIUS * 0.6, TRUNK_RADIUS, 1, 6]} />
        <meshStandardMaterial color="#5b4636" roughness={1} />
      </instancedMesh>
      <instancedMesh ref={canopyRef} args={[undefined, undefined, trees.length]} frustumCulled={false}>
        <coneGeometry args={[1, 1, 8]} />
        <meshStandardMaterial color="#ffffff" roughness={0.9} />
      </instancedMesh>
    </>
  );
}
