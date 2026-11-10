"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { EYE_HEIGHT, stepPlayer, type PlayerInput, type PlayerState } from "../_lib/player";
import {
  HOUSE_SIZE,
  houseAppear,
  terrainHeight,
  treeVisibility,
  type SceneLayout,
  type TreeSlot,
} from "../_lib/terrain";
import type { WalkInput } from "./useWalkInput";

declare global {
  interface Window {
    /** Dev/QA only (never set in production builds): the player's live state. */
    __groundDebug?: {
      x: number;
      y: number;
      z: number;
      yaw: number;
      pitch: number;
      groundY: number;
    };
  }
}

type PlayerControllerProps = {
  layout: SceneLayout;
  trees: TreeSlot[];
  /** Current 0..1 severity. Read through a ref inside the frame loop. */
  severityFraction: number;
  inputRef: RefObject<WalkInput>;
  reducedMotion: boolean;
};

type Obstacle = { x: number; z: number; r: number };

const TRUNK_RADIUS = 0.35;
const CELL = 8;
/** Trunks within this distance of the player are collision candidates. */
const NEAR = 3;

function cellKey(cx: number, cz: number): number {
  return (cx + 512) * 1024 + (cz + 512);
}

/** Spatial hash of tree indices, built once per layout. */
function buildTreeGrid(trees: TreeSlot[]): Map<number, number[]> {
  const grid = new Map<number, number[]>();
  trees.forEach((tree, index) => {
    const key = cellKey(Math.floor(tree.x / CELL), Math.floor(tree.z / CELL));
    const bucket = grid.get(key);
    if (bucket) bucket.push(index);
    else grid.set(key, [index]);
  });
  return grid;
}

/** The house as a few circles along its long axis (a circle for a 6 x 4.5 m
 *  box would either clip the walls or leave the corners walkable). */
function houseCircles(layout: SceneLayout): Obstacle[] {
  const { x, z, yaw } = layout.house;
  // Local +X (long axis) in world x/z for a rotation of `yaw` about Y.
  const ax = Math.cos(yaw);
  const az = -Math.sin(yaw);
  // Local +Z (depth axis).
  const bx = Math.sin(yaw);
  const bz = Math.cos(yaw);
  const r = HOUSE_SIZE.depth / 4;
  const circles: Obstacle[] = [];
  for (let i = -2; i <= 2; i++) {
    for (const j of [-1, 1]) {
      const along = (i * (HOUSE_SIZE.width - 2 * r)) / 4;
      const across = j * (HOUSE_SIZE.depth / 2 - r);
      circles.push({ x: x + ax * along + bx * across, z: z + az * along + bz * across, r });
    }
  }
  return circles;
}

/**
 * First-person controller inside the R3F Canvas. Each frame it turns the
 * shared input ref into a PlayerInput, runs the pure stepPlayer, and writes
 * the camera. Ground height is read at the CURRENT severity (via a ref), so
 * the player rides the ground down as the hill is cut while scrubbing.
 */
export function PlayerController({
  layout,
  trees,
  severityFraction,
  inputRef,
  reducedMotion,
}: PlayerControllerProps) {
  const severityRef = useRef(severityFraction);
  const reducedRef = useRef(reducedMotion);
  useEffect(() => {
    severityRef.current = severityFraction;
    reducedRef.current = reducedMotion;
  });

  const grid = useMemo(() => buildTreeGrid(trees), [trees]);
  const house = useMemo(() => houseCircles(layout), [layout]);
  const playerRef = useRef<{ layout: SceneLayout; state: PlayerState } | null>(null);

  useFrame((frame, delta) => {
    const sev = severityRef.current;
    const camera = frame.camera;
    const heightAt = (x: number, z: number) => terrainHeight(x, z, layout, sev);

    // (Re)place the camera at the spawn on mount and when the layout changes.
    if (!playerRef.current || playerRef.current.layout !== layout) {
      const { x, z, yaw } = layout.spawn;
      playerRef.current = {
        layout,
        state: { x, z, y: heightAt(x, z) + EYE_HEIGHT, yaw, pitch: 0, vx: 0, vz: 0 },
      };
      camera.rotation.order = "YXZ";
    }

    const raw = inputRef.current;
    const input: PlayerInput = {
      moveX: raw.moveX,
      moveZ: raw.moveZ,
      lookYaw: raw.lookYaw,
      lookPitch: raw.lookPitch,
      sprint: raw.sprint,
    };
    raw.lookYaw = 0;
    raw.lookPitch = 0;

    const current = playerRef.current.state;
    const obstacles: Obstacle[] = [];
    const cx = Math.floor(current.x / CELL);
    const cz = Math.floor(current.z / CELL);
    for (let ix = cx - 1; ix <= cx + 1; ix++) {
      for (let iz = cz - 1; iz <= cz + 1; iz++) {
        const bucket = grid.get(cellKey(ix, iz));
        if (!bucket) continue;
        for (const index of bucket) {
          const tree = trees[index];
          if (Math.abs(tree.x - current.x) > NEAR || Math.abs(tree.z - current.z) > NEAR) continue;
          const visible = treeVisibility(tree, layout, sev);
          if (visible > 0.5) {
            obstacles.push({ x: tree.x, z: tree.z, r: TRUNK_RADIUS * tree.baseScale * visible });
          }
        }
      }
    }
    if (houseAppear(sev) > 0.5) obstacles.push(...house);

    const next = stepPlayer(current, input, delta, {
      heightAt,
      walkRadius: layout.walkRadius,
      obstacles,
      reducedMotion: reducedRef.current,
    });
    playerRef.current.state = next;

    camera.position.set(next.x, next.y, next.z);
    camera.rotation.set(next.pitch, next.yaw, 0);

    if (process.env.NODE_ENV !== "production") {
      window.__groundDebug = {
        x: next.x,
        y: next.y,
        z: next.z,
        yaw: next.yaw,
        pitch: next.pitch,
        groundY: heightAt(next.x, next.z),
      };
    }
  });

  return null;
}
