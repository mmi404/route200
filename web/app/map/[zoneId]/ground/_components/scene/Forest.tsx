"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type * as THREE from "three";
import type { SceneLayout, TreeSlot } from "../../_lib/terrain";
import { ForestRig, type ForestMeshes, type Quality } from "./forestRig";
import { buildLog, buildStump, buildTreeSpecies } from "./treeGeometry";
import { Undergrowth } from "./Undergrowth";
import { createSwayUniforms, createVegetationMaterial, setSwayTime } from "./vegetationMaterial";

type ForestProps = {
  layout: SceneLayout;
  /** The collidable trees (the player controller uses the same slots). */
  trees: TreeSlot[];
  /** 0..1 */
  severityFraction: number;
  /** "low" draws about a third of the far trees and undergrowth. */
  quality?: Quality;
  /** Turns the canopy sway off. */
  reducedMotion?: boolean;
};

/**
 * The jungle: four tree species (tall broadleaf, mid-storey, palm, bamboo),
 * each an instanced merged mesh in a near and a far level of detail, plus
 * stumps and felled logs where trees were cleared, plus the understorey.
 *
 * Trunk base radii are about 0.3 m at scale 1 (0.56 m at the root flare), in
 * line with the 0.35 * baseScale collision circle PlayerController uses.
 * Everything per-slot lives in ForestRig; this component owns the GPU
 * resources and hands the rig the meshes.
 */
export function Forest({
  layout,
  trees,
  severityFraction,
  quality = "high",
  reducedMotion = false,
}: ForestProps) {
  const sway = useMemo(() => createSwayUniforms(reducedMotion ? 0 : 1), [reducedMotion]);
  const assets = useMemo(() => {
    const species = buildTreeSpecies();
    const solid = createVegetationMaterial({ doubleSided: false, sway });
    const leafy = createVegetationMaterial({ doubleSided: true, sway });
    const plain = createVegetationMaterial({ doubleSided: false });
    return { species, solid, leafy, plain, stump: buildStump(), log: buildLog() };
  }, [sway]);
  useEffect(
    () => () => {
      for (const s of assets.species) {
        s.hi.dispose();
        s.lo.dispose();
        s.far.dispose();
      }
      assets.solid.dispose();
      assets.leafy.dispose();
      assets.plain.dispose();
      assets.stump.dispose();
      assets.log.dispose();
    },
    [assets],
  );

  const rig = useMemo(
    () => new ForestRig(layout, trees, quality, assets.species.map((s) => s.stumpRadius)),
    [layout, trees, quality, assets],
  );
  const meshes = useRef<ForestMeshes>({ groups: [], stumps: null, logs: null });

  useLayoutEffect(() => {
    rig.init(meshes.current);
  }, [rig]);
  useLayoutEffect(() => {
    rig.update(meshes.current, severityFraction);
  }, [rig, severityFraction]);

  useFrame(({ clock }) => {
    if (!reducedMotion) setSwayTime(sway, clock.elapsedTime);
  });

  return (
    <>
      {rig.groupSpecs.map((spec, g) => {
        const species = assets.species[spec.species];
        return (
          <instancedMesh
            key={`${spec.species}-${spec.lod}`}
            ref={(mesh: THREE.InstancedMesh | null) => {
              meshes.current.groups[g] = mesh;
            }}
            args={[
              spec.lod === 0 ? species.hi : spec.lod === 1 ? species.lo : species.far,
              species.doubleSided ? assets.leafy : assets.solid,
              spec.count,
            ]}
            frustumCulled={false}
          />
        );
      })}
      {rig.stumpCount > 0 && (
        <instancedMesh
          ref={(mesh: THREE.InstancedMesh | null) => {
            meshes.current.stumps = mesh;
          }}
          args={[assets.stump, assets.plain, rig.stumpCount]}
          frustumCulled={false}
        />
      )}
      {rig.logCount > 0 && (
        <instancedMesh
          ref={(mesh: THREE.InstancedMesh | null) => {
            meshes.current.logs = mesh;
          }}
          args={[assets.log, assets.plain, rig.logCount]}
          frustumCulled={false}
        />
      )}
      <Undergrowth layout={layout} severityFraction={severityFraction} quality={quality} />
    </>
  );
}
