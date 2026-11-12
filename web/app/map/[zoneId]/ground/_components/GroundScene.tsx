"use client";

import { useEffect, useMemo, type RefObject } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { LOOK } from "../_lib/look";
import { EYE_HEIGHT } from "../_lib/player";
import type { RealTerrain } from "../_lib/realTerrain";
import {
  clamp01,
  generateTreeSlots,
  realTerrainStops,
  sceneLayoutForZone,
  terrainHeight,
  type RealDataStop,
} from "../_lib/terrain";
import { PlayerController } from "./PlayerController";
import type { WalkInput } from "./useWalkInput";
import { Forest } from "./scene/Forest";
import { Settlement } from "./scene/Settlement";
import { Atmosphere } from "./scene/Atmosphere";
import { Stops } from "./scene/Stops";
import { StopProximity } from "./scene/StopProximity";
import { Terrain, type GroundQuality } from "./scene/Terrain";

type GroundSceneProps = {
  zoneId: string;
  /** Continuous 0-100 severity for the currently scrubbed day. */
  severity: number;
  reducedMotion: boolean;
  inputRef: RefObject<WalkInput>;
  /** "low" trades fidelity for speed: coarser terrain, no antialiasing, lower pixel ratio. */
  quality?: GroundQuality;
  /** Called when the WebGL context is lost and does not come back. */
  onContextFailed?: () => void;
  /** Real elevation/density/disturbance grids for this zone, or null for
   *  every zone without a ground terrain pack (see _lib/realTerrain.ts). */
  realTerrain?: RealTerrain | null;
  /** Called whenever the nearest real-data stop within range changes. */
  onNearStopChange?: (stop: RealDataStop | null) => void;
};

const TREE_COUNT = 1400;
/** How long a lost context gets to be restored before the view gives up. */
const CONTEXT_RESTORE_MS = 4000;

/**
 * Watches the renderer's canvas. A lost context is normally restored by the
 * browser within moments (three.js rebuilds its state); only if it is still
 * gone after CONTEXT_RESTORE_MS is the failure reported.
 */
function ContextGuard({ onFail }: { onFail: () => void }) {
  const canvas = useThree((state) => state.gl.domElement);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onLost = (event: Event) => {
      // Without this the browser never attempts a restore.
      event.preventDefault();
      clearTimeout(timer);
      timer = setTimeout(onFail, CONTEXT_RESTORE_MS);
    };
    const onRestored = () => clearTimeout(timer);
    canvas.addEventListener("webglcontextlost", onLost);
    canvas.addEventListener("webglcontextrestored", onRestored);
    return () => {
      clearTimeout(timer);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
    };
  }, [canvas, onFail]);
  return null;
}

/**
 * The Ground View 3D scene (PROGRESS.md, "Phase 3: Ground View" and "Phase
 * 5: Real ground terrain"): a human-scale (1 unit = 1 metre) jungle the
 * visitor walks through in first person, where the forest thins, a hill is
 * cut away, and a road and a house appear as the zone's real recorded
 * severity rises. For a zone with a real terrain pack (`realTerrain`,
 * Teknaf today), the hill height, tree/undergrowth density and the
 * disturbance shape are real satellite measurements (see _lib/terrain.ts
 * and _lib/realTerrain.ts); every other zone, and the road/house for every
 * zone, stays the original stylized illustration.
 *
 * Structure: each concern lives in its own file under ./scene/ (Terrain,
 * Forest, Settlement) so it can be reworked independently; this file only
 * composes them with the lights, fog and camera. Locomotion lives in
 * PlayerController.
 *
 * Frames are driven by requestAnimationFrame (R3F's default "always"
 * loop), which browsers stop in hidden tabs, so nothing renders while the
 * tab is in the background.
 *
 * @react-three/fiber's Canvas is SSR-safe on its own (it renders an inert
 * <canvas> wrapper during the server pass and defers all WebGL work to
 * effects), so no client-only mount gate is needed here.
 */
export function GroundScene({
  zoneId,
  severity,
  reducedMotion,
  inputRef,
  quality = "high",
  onContextFailed,
  realTerrain,
  onNearStopChange,
}: GroundSceneProps) {
  const layout = useMemo(
    () => sceneLayoutForZone(zoneId, realTerrain ?? undefined),
    [zoneId, realTerrain],
  );
  const trees = useMemo(() => generateTreeSlots(layout, TREE_COUNT), [layout]);
  const stops = useMemo(() => realTerrainStops(layout), [layout]);
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
      dpr={quality === "high" ? [1, 1.75] : [1, 1.25]}
      gl={{
        antialias: quality === "high",
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: LOOK.atmosphere.exposure,
      }}
      camera={{ fov: 65, near: 0.1, far: 800, position: initialCamera }}
      className="h-full w-full"
    >
      {onContextFailed && <ContextGuard onFail={onContextFailed} />}
      <Atmosphere layout={layout} reducedMotion={reducedMotion} />
      <Terrain layout={layout} severityFraction={severityFraction} quality={quality} />
      <Forest
        layout={layout}
        trees={trees}
        severityFraction={severityFraction}
        quality={quality}
        reducedMotion={reducedMotion}
      />
      <Settlement layout={layout} severityFraction={severityFraction} />
      <Stops layout={layout} stops={stops} />
      {onNearStopChange && <StopProximity stops={stops} onChange={onNearStopChange} />}
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
