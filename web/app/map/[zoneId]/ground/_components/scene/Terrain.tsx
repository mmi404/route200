"use client";

import { useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { baseHeight, surfaceFromBase, type SceneLayout, type SurfaceSample } from "../../_lib/terrain";

type TerrainProps = {
  layout: SceneLayout;
  /** 0..1 */
  severityFraction: number;
};

/** Square grid over the world disk's bounding box (1 m cells near 240 m / 200). */
const SEGMENTS = 200;

// Plain colours for now; the ground-shading pass replaces these.
const GROUND_COLOR = new THREE.Color("#4f7d3b");
const SOIL_COLOR = new THREE.Color("#8a6a4a");

/**
 * The displaced terrain mesh. Base (severity-independent) heights are
 * computed once per layout and cached; a severity change only re-evaluates
 * the cut/pad/road part via surfaceFromBase, writes heights and vertex
 * colours into the existing buffers, and recomputes normals.
 */
export function Terrain({ layout, severityFraction }: TerrainProps) {
  const { geometry, baseHeights } = useMemo(() => {
    const size = layout.worldRadius * 2;
    const geo = new THREE.PlaneGeometry(size, size, SEGMENTS, SEGMENTS);
    geo.rotateX(-Math.PI / 2);
    const position = geo.attributes.position;
    const base = new Float32Array(position.count);
    for (let i = 0; i < position.count; i++) {
      base[i] = baseHeight(position.getX(i), position.getZ(i), layout);
    }
    geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(position.count * 3), 3));
    return { geometry: geo, baseHeights: base };
  }, [layout]);

  const meshRef = useRef<THREE.Mesh>(null);

  useLayoutEffect(() => {
    // Written through the mesh ref: the geometry is a hook-derived value the
    // React lint rules treat as immutable, but its buffers are ours to update.
    const target = meshRef.current?.geometry;
    if (!target) return;
    const position = target.attributes.position;
    const color = target.attributes.color;
    const sample: SurfaceSample = { height: 0, cleared: 0 };
    const mixed = new THREE.Color();
    for (let i = 0; i < position.count; i++) {
      const x = position.getX(i);
      const z = position.getZ(i);
      surfaceFromBase(baseHeights[i], x, z, layout, severityFraction, sample);
      position.setY(i, sample.height);
      mixed.copy(GROUND_COLOR).lerp(SOIL_COLOR, sample.cleared);
      color.setXYZ(i, mixed.r, mixed.g, mixed.b);
    }
    position.needsUpdate = true;
    color.needsUpdate = true;
    target.computeVertexNormals();
    target.computeBoundingSphere();
    target.computeBoundingBox();
  }, [geometry, baseHeights, layout, severityFraction]);

  useLayoutEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial vertexColors roughness={1} />
    </mesh>
  );
}
