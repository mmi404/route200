"use client";

import { useMemo, type RefObject } from "react";
import { Canvas } from "@react-three/fiber";
import { PALETTE } from "@/lib/design-tokens";
import { EYE_HEIGHT } from "../_lib/player";
import {
  clamp01,
  generateTreeSlots,
  sceneLayoutForZone,
  terrainHeight,
} from "../_lib/terrain";
import { PlayerController } from "./PlayerController";
import type { WalkInput } from "./useWalkInput";
import { Forest } from "./scene/Forest";
import { Settlement } from "./scene/Settlement";
import { Terrain } from "./scene/Terrain";

type GroundSceneProps = {
  zoneId: string;
  /** Continuous 0-100 severity for the currently scrubbed day. */
  severity: number;
  reducedMotion: boolean;
  inputRef: RefObject<WalkInput>;
};

const TREE_COUNT = 1400;
const SKY_COLOR = PALETTE.riverLight;

/**
 * The Ground View 3D scene (PROGRESS.md, "Phase 3: Ground View"): a
 * stylized, human-scale (1 unit = 1 metre) jungle the visitor walks through
 * in first person, where the forest thins, a hill is cut away, and a road
 * and a house appear as the zone's real recorded severity rises. Explicitly
 * illustrative, not a terrain or imagery reconstruction.
 *
 * Structure: each concern lives in its own file under ./scene/ (Terrain,
 * Forest, Settlement) so it can be reworked independently; this file only
 * composes them with the lights, fog and camera. Locomotion lives in
 * PlayerController.
 *
 * @react-three/fiber's Canvas is SSR-safe on its own (it renders an inert
 * <canvas> wrapper during the server pass and defers all WebGL work to
 * effects), so no client-only mount gate is needed here.
 */
export function GroundScene({ zoneId, severity, reducedMotion, inputRef }: GroundSceneProps) {
  const layout = useMemo(() => sceneLayoutForZone(zoneId), [zoneId]);
  const trees = useMemo(() => generateTreeSlots(layout, TREE_COUNT), [layout]);
  const severityFraction = clamp01(severity / 100);

  // Only the first-frame camera position: PlayerController owns it after
  // that. Computed once per layout so slider moves never reset the player.
  const initialCamera = useMemo((): [number, number, number] => {
    const { x, z } = layout.spawn;
    return [x, terrainHeight(x, z, layout, 0) + EYE_HEIGHT, z];
  }, [layout]);

  return (
    <Canvas
      shadows={false}
      dpr={[1, 1.75]}
      camera={{ fov: 65, near: 0.1, far: 400, position: initialCamera }}
      className="h-full w-full"
    >
      <color attach="background" args={[SKY_COLOR]} />
      <fog attach="fog" args={[SKY_COLOR, 40, 170]} />
      <hemisphereLight args={[SKY_COLOR, "#7d8a5c", 0.95]} />
      <directionalLight position={[60, 90, 35]} intensity={1.2} />
      <Terrain layout={layout} severityFraction={severityFraction} />
      <Forest layout={layout} trees={trees} severityFraction={severityFraction} />
      <Settlement layout={layout} severityFraction={severityFraction} />
      <PlayerController
        layout={layout}
        trees={trees}
        severityFraction={severityFraction}
        inputRef={inputRef}
        reducedMotion={reducedMotion}
      />
    </Canvas>
  );
}
