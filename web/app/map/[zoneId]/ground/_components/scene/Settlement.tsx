"use client";

import { useEffect, useLayoutEffect, useMemo } from "react";
import * as THREE from "three";
import { LOOK } from "../../_lib/look";
import type { SceneLayout } from "../../_lib/terrain";
import {
  buildClothesline,
  buildFenceRail,
  buildFenceSlat,
  buildFrame,
  buildLogStack,
  buildOpenings,
  buildPlinth,
  buildPole,
  buildRafter,
  buildRoofTrim,
  buildSheet,
  buildShed,
  buildStone,
  buildVeranda,
  buildWalls,
} from "./houseGeometry";
import { buildBanana } from "./plantGeometry";
import { RAFTER_COUNT, SHEET_COUNT, SettlementRig, bindMesh, emptyMeshes, type SettlementMeshes } from "./settlementRig";
import { createVegetationMaterial } from "./vegetationMaterial";

type SettlementProps = {
  layout: SceneLayout;
  /** 0..1 */
  severityFraction: number;
};

/**
 * Road furniture and the homestead. The road surface itself is painted on the
 * terrain, so this adds what stands on it: utility poles with wires, marker
 * stones. The house is built in stages out of sub-ranges of `houseAppear`
 * (plinth, posts and frame, walls, roof, then fence, cowshed, bananas, log
 * stack and washing line). The positioned group is never scaled; each piece
 * scales about its own base inside it (see PROGRESS.md, Phase 3).
 *
 * The house footprint is HOUSE_SIZE (collision covers it); the porch and the
 * homestead dressing are covered by `settlementObstacles` in terrain.ts.
 */
export function Settlement({ layout, severityFraction }: SettlementProps) {
  const assets = useMemo(() => {
    return {
      solid: createVegetationMaterial({ doubleSided: false }),
      double: createVegetationMaterial({ doubleSided: true }),
      wire: new THREE.LineBasicMaterial({ color: LOOK.metal.wire }),
      line: new THREE.LineBasicMaterial({ color: LOOK.metal.wire }),
      plinth: buildPlinth(),
      frame: buildFrame(),
      walls: buildWalls(),
      openings: buildOpenings(),
      trim: buildRoofTrim(),
      veranda: buildVeranda(),
      shed: buildShed(),
      logStack: buildLogStack(),
      sheet: buildSheet(),
      rafter: buildRafter(),
      slat: buildFenceSlat(),
      rail: buildFenceRail(),
      banana: buildBanana(),
      pole: buildPole(),
      stone: buildStone(),
    };
  }, []);

  const rig = useMemo(() => new SettlementRig(layout), [layout]);

  const extra = useMemo(() => {
    const { a, b } = rig.plan.clothesline;
    const clothes = buildClothesline(b.lx - a.lx, b.lz - a.lz);
    const lineGeo = new THREE.BufferGeometry();
    lineGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(rig.clothLineVertexCount * 3), 3));
    const wireGeo = new THREE.BufferGeometry();
    wireGeo.setAttribute("position", new THREE.BufferAttribute(new Float32Array(Math.max(1, rig.wireVertexCount) * 3), 3));
    wireGeo.setDrawRange(0, 0);
    return { clothes, lineGeo, wireGeo };
  }, [rig]);

  useEffect(
    () => () => {
      for (const value of Object.values(assets)) value.dispose();
    },
    [assets],
  );
  useEffect(
    () => () => {
      extra.clothes.dispose();
      extra.lineGeo.dispose();
      extra.wireGeo.dispose();
    },
    [extra],
  );

  const meshes = useMemo(() => emptyMeshes(), []);

  useLayoutEffect(() => {
    rig.init(meshes);
  }, [rig, meshes]);
  useLayoutEffect(() => {
    rig.update(meshes, severityFraction);
  }, [rig, meshes, severityFraction]);

  const set = <K extends keyof SettlementMeshes>(key: K) => bindMesh(meshes, key);

  return (
    <>
      {rig.poleCount > 0 && (
        <instancedMesh ref={set("poles")} args={[assets.pole, assets.solid, rig.poleCount]} frustumCulled={false} />
      )}
      {rig.stoneCount > 0 && (
        <instancedMesh ref={set("stones")} args={[assets.stone, assets.solid, rig.stoneCount]} frustumCulled={false} />
      )}
      <lineSegments ref={set("wires")} geometry={extra.wireGeo} material={assets.wire} frustumCulled={false} />

      <group ref={set("house")} rotation={[0, layout.house.yaw, 0]} visible={false}>
        <mesh ref={set("plinth")} geometry={assets.plinth} material={assets.solid} frustumCulled={false} />
        <mesh ref={set("frame")} geometry={assets.frame} material={assets.solid} frustumCulled={false} />
        <mesh ref={set("walls")} geometry={assets.walls} material={assets.solid} frustumCulled={false} />
        <mesh ref={set("openings")} geometry={assets.openings} material={assets.solid} frustumCulled={false} />
        <mesh ref={set("veranda")} geometry={assets.veranda} material={assets.solid} frustumCulled={false} />
        <mesh ref={set("trim")} geometry={assets.trim} material={assets.double} frustumCulled={false} />
        <instancedMesh ref={set("rafters")} args={[assets.rafter, assets.solid, RAFTER_COUNT]} frustumCulled={false} />
        <instancedMesh ref={set("sheets")} args={[assets.sheet, assets.double, SHEET_COUNT]} frustumCulled={false} />
        <mesh ref={set("shed")} geometry={assets.shed} material={assets.double} frustumCulled={false} />
        <mesh ref={set("logStack")} geometry={assets.logStack} material={assets.solid} frustumCulled={false} />
        <mesh ref={set("clothes")} geometry={extra.clothes} material={assets.double} frustumCulled={false} />
        <lineSegments ref={set("clothLine")} geometry={extra.lineGeo} material={assets.line} frustumCulled={false} />
        {rig.slatCount > 0 && (
          <instancedMesh ref={set("slats")} args={[assets.slat, assets.solid, rig.slatCount]} frustumCulled={false} />
        )}
        {rig.railCount > 0 && (
          <instancedMesh ref={set("rails")} args={[assets.rail, assets.solid, rig.railCount]} frustumCulled={false} />
        )}
        <instancedMesh ref={set("bananas")} args={[assets.banana, assets.double, rig.bananaCount]} frustumCulled={false} />
      </group>
    </>
  );
}
