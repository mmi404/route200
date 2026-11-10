"use client";

import { useSyncExternalStore } from "react";
import { decideQuality, type GroundQuality } from "../_lib/quality";

const COARSE_QUERY = "(pointer: coarse)";

function subscribeCoarse(callback: () => void): () => void {
  const query = window.matchMedia(COARSE_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getCoarse = () => window.matchMedia(COARSE_QUERY).matches;
const getCoarseOnServer = () => false;

/** True when a finger is the device's primary pointer (phones, most tablets).
 *  The server and the first client render both see false, so the markup
 *  matches; a coarse device then switches right after hydration. */
export function useCoarsePointer(): boolean {
  return useSyncExternalStore(subscribeCoarse, getCoarse, getCoarseOnServer);
}

type QualityNavigator = Navigator & { deviceMemory?: number };

let decidedQuality: GroundQuality | null = null;

/** Read once, then frozen: rotating the phone or resizing the window must
 *  never flip the tier, because that rebuilds the whole scene. `?quality=low`
 *  or `?quality=high` in the URL overrides the decision (for testing). */
function decideOnce(): GroundQuality {
  if (decidedQuality) return decidedQuality;
  const nav = navigator as QualityNavigator;
  let override: string | null = null;
  try {
    override = new URLSearchParams(window.location.search).get("quality");
  } catch {
    // No usable location: fall through to the device read.
  }
  decidedQuality = decideQuality(
    {
      coarsePointer: getCoarse(),
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight,
      hardwareConcurrency: nav.hardwareConcurrency,
      deviceMemory: nav.deviceMemory,
    },
    override,
  );
  return decidedQuality;
}

const subscribeNever = () => () => {};
const getQualityOnServer = (): GroundQuality => "high";

/** The render tier for this session. Server snapshot is "high"; the scene
 *  (which only mounts after the zone data has loaded on the client) reads
 *  the real, session-stable value. */
export function useGroundQuality(): GroundQuality {
  return useSyncExternalStore(subscribeNever, decideOnce, getQualityOnServer);
}
