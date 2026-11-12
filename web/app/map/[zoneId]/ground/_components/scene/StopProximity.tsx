"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import type { RealDataStop } from "../../_lib/terrain";

const NEAR_RADIUS = 8;

type StopProximityProps = {
  stops: RealDataStop[];
  onChange: (stop: RealDataStop | null) => void;
};

/**
 * Reports the nearest real-data stop within NEAR_RADIUS metres of the
 * player, or null, calling back only when that answer changes (not every
 * frame). Reads the camera's own position rather than plumbing the
 * player's position through another prop: PlayerController already writes
 * it there every frame.
 */
export function StopProximity({ stops, onChange }: StopProximityProps) {
  const lastRef = useRef<RealDataStop | null>(null);

  useFrame((state) => {
    if (stops.length === 0) return;
    const { x, z } = state.camera.position;
    let nearest: RealDataStop | null = null;
    let bestDist = NEAR_RADIUS;
    for (const stop of stops) {
      const d = Math.hypot(x - stop.x, z - stop.z);
      if (d < bestDist) {
        bestDist = d;
        nearest = stop;
      }
    }
    if (nearest !== lastRef.current) {
      lastRef.current = nearest;
      onChange(nearest);
    }
  });

  return null;
}
