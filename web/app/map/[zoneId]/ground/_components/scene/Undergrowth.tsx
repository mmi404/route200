"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type * as THREE from "three";
import { UNDERGROWTH_KINDS, type SceneLayout } from "../../_lib/terrain";
import { UndergrowthRig, type Quality } from "./forestRig";
import { UNDERGROWTH_BUILDERS } from "./plantGeometry";
import { createVegetationMaterial } from "./vegetationMaterial";

type UndergrowthProps = {
  layout: SceneLayout;
  /** 0..1 */
  severityFraction: number;
  quality: Quality;
};

/** Ferns, shrubs, grass, big-leaf plants and saplings on the forest floor.
 *  Not collidable: the visitor brushes through them. They thin out and go
 *  with the clearing before the trees do. */
export function Undergrowth({ layout, severityFraction, quality }: UndergrowthProps) {
  const assets = useMemo(
    () => ({
      geometries: UNDERGROWTH_BUILDERS.map((build) => build()),
      material: createVegetationMaterial({ doubleSided: true }),
    }),
    [],
  );
  useEffect(
    () => () => {
      for (const g of assets.geometries) g.dispose();
      assets.material.dispose();
    },
    [assets],
  );
  const rig = useMemo(() => new UndergrowthRig(layout, quality, UNDERGROWTH_KINDS.length), [layout, quality]);
  const meshes = useRef<Array<THREE.InstancedMesh | null>>([]);

  useLayoutEffect(() => {
    rig.init(meshes.current);
  }, [rig]);
  useLayoutEffect(() => {
    rig.update(meshes.current, severityFraction);
  }, [rig, severityFraction]);

  return (
    <>
      {UNDERGROWTH_KINDS.map((name, kind) => (
        <instancedMesh
          key={name}
          ref={(mesh: THREE.InstancedMesh | null) => {
            meshes.current[kind] = mesh;
          }}
          args={[assets.geometries[kind], assets.material, rig.kindCounts[kind]]}
          frustumCulled={false}
        />
      ))}
    </>
  );
}
