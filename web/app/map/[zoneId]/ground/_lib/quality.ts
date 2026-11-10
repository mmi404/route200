/**
 * Picks the render quality tier for Ground View from what the device
 * reports. Pure: the caller reads the browser once and passes numbers in.
 */

export type GroundQuality = "high" | "low";

export interface DeviceCapabilities {
  /** `(pointer: coarse)` matches: a finger is the primary pointer. */
  coarsePointer: boolean;
  viewportWidth: number;
  viewportHeight: number;
  /** navigator.hardwareConcurrency, when reported. */
  hardwareConcurrency?: number;
  /** navigator.deviceMemory in GB (Chromium only, capped at 8). */
  deviceMemory?: number;
}

/** A viewport whose short side is at most this wide is a phone, in either
 *  orientation. Tablets (768 and up) are not. */
export const PHONE_SHORT_SIDE = 600;
export const LOW_CORE_COUNT = 4;
export const LOW_MEMORY_GB = 4;

export function decideQuality(caps: DeviceCapabilities, override?: string | null): GroundQuality {
  if (override === "low" || override === "high") return override;
  const shortSide = Math.min(caps.viewportWidth, caps.viewportHeight);
  if (caps.coarsePointer && shortSide <= PHONE_SHORT_SIDE) return "low";
  const cores = caps.hardwareConcurrency;
  if (typeof cores === "number" && cores > 0 && cores <= LOW_CORE_COUNT) return "low";
  const memory = caps.deviceMemory;
  if (typeof memory === "number" && memory > 0 && memory <= LOW_MEMORY_GB) return "low";
  return "high";
}
