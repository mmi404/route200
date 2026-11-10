import * as THREE from "three";
import {
  baseHeight,
  generateDistantTreeSlots,
  generateLogSlots,
  generateUndergrowthSlots,
  isSeverityStatic,
  logAmount,
  smoothstep,
  stumpAmount,
  surfaceFromBase,
  terrainHeightFromBase,
  treeVisibilityFromCleared,
  undergrowthVisibility,
  type LogSlot,
  type SceneLayout,
  type SurfaceSample,
  type TreeSlot,
  type UndergrowthSlot,
} from "../../_lib/terrain";

/**
 * The imperative half of the forest: slot bookkeeping and instance-matrix
 * writes, kept out of the React component so a slider tick is one flat loop
 * with no allocation. A rig is built once per layout; `init` writes colours
 * and every matrix that can never change, `update` re-evaluates only the
 * instances near the scar, the road and the house.
 */

export type Quality = "high" | "low";

/** How many of each layer to draw. `nearLod` 1 draws every tree with the
 *  low-detail build (the low-quality tier keeps the triangle count down). */
export const QUALITY = {
  high: { distantTrees: 2600, undergrowth: 4400, logs: 22, nearLod: 0 },
  low: { distantTrees: 900, undergrowth: 1500, logs: 10, nearLod: 1 },
} as const;

/** Beyond walkRadius + this, trees use the low-detail build; beyond walkRadius
 *  + the second pad, the cheapest ridge build. */
const LOD1_PAD = 12;
const LOD2_PAD = 40;
/** Nominal tree base-ground sink so root flare buries into slopes, metres. */
const SINK = 0.08;
/** Tree visibility band (from `treeVisibility`) over which a tree is felled. */
const FELL_START = 0.45;
const FELL_END = 0.7;
/** How far a felled tree tips over while vanishing, radians. */
const FALL_ANGLE = 1.15;

function hash01(i: number, salt: number): number {
  let h = Math.imul(i + 1, 374761393) ^ Math.imul(salt, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Seeded per-instance tint around white: value and a warm/cool shift, so
 *  neighbours differ while staying inside the palette family. */
export function instanceTint(out: THREE.Color, i: number, salt: number, spread = 1): THREE.Color {
  const v = 1 + (hash01(i, salt) * 2 - 1) * 0.17 * spread;
  const h = (hash01(i, salt + 17) * 2 - 1) * spread;
  return out.setRGB(v * (1 + 0.1 * h), v * (1 + 0.025 * h), v * (1 - 0.15 * h));
}

function speciesFor(variant: number, h: number): number {
  switch (variant) {
    case 0:
      return h < 0.5 ? 0 : 1;
    case 1:
      return h < 0.5 ? 2 : 3;
    case 2:
      return h < 0.45 ? (h < 0.225 ? 0 : 1) : 4;
    default:
      return h < 0.35 ? (h < 0.175 ? 2 : 3) : 5;
  }
}

export interface TreeGroupSpec {
  species: number;
  /** 0 = high detail, 1 = low detail, 2 = ridge (cheapest). */
  lod: 0 | 1 | 2;
  count: number;
}

export interface ForestMeshes {
  groups: Array<THREE.InstancedMesh | null>;
  stumps: THREE.InstancedMesh | null;
  logs: THREE.InstancedMesh | null;
}

export class ForestRig {
  readonly slots: TreeSlot[];
  readonly groupSpecs: TreeGroupSpec[] = [];
  readonly stumpCount: number;
  readonly logCount: number;

  private readonly layout: SceneLayout;
  private readonly baseY: Float32Array;
  private readonly species: Uint8Array;
  private readonly wide: Float32Array;
  private readonly dynamic: Uint8Array;
  private readonly fallAxisX: Float32Array;
  private readonly fallAxisZ: Float32Array;
  private readonly ground: Float32Array;
  private readonly vis: Float32Array;
  /** Per group: slot ids in instance order, and which instances are dynamic. */
  private readonly groupIds: Int32Array[] = [];
  private readonly groupDyn: Int32Array[] = [];
  private readonly stumpIds: Int32Array;
  private readonly stumpRadius: Float32Array;
  private readonly logs: LogSlot[];

  private readonly out: SurfaceSample = { height: 0, cleared: 0 };
  private readonly dummy = new THREE.Object3D();
  private readonly qYaw = new THREE.Quaternion();
  private readonly qTilt = new THREE.Quaternion();
  private readonly axis = new THREE.Vector3();
  private readonly color = new THREE.Color();

  constructor(
    layout: SceneLayout,
    near: TreeSlot[],
    quality: Quality,
    stumpRadiusBySpecies: number[],
  ) {
    this.layout = layout;
    this.slots = near.concat(generateDistantTreeSlots(layout, QUALITY[quality].distantTrees));
    const n = this.slots.length;
    this.baseY = new Float32Array(n);
    this.species = new Uint8Array(n);
    this.wide = new Float32Array(n);
    this.dynamic = new Uint8Array(n);
    this.fallAxisX = new Float32Array(n);
    this.fallAxisZ = new Float32Array(n);
    this.ground = new Float32Array(n);
    this.vis = new Float32Array(n);

    const lists = new Map<number, number[]>();
    const lod1Radius = layout.walkRadius + LOD1_PAD;
    const lod2Radius = layout.walkRadius + LOD2_PAD;
    const stumpList: number[] = [];
    this.slots.forEach((slot, i) => {
      this.baseY[i] = baseHeight(slot.x, slot.z, layout);
      this.species[i] = speciesFor(slot.variant, hash01(i, 11));
      this.wide[i] = 0.9 + hash01(i, 23) * 0.25;
      this.dynamic[i] = isSeverityStatic(slot.x, slot.z, layout) ? 0 : 1;
      // Tip over away from the scar centre, jittered.
      const away = Math.atan2(slot.z - layout.scarCenter.z, slot.x - layout.scarCenter.x) + (slot.jitter - 0.5) * 1.4;
      this.fallAxisX[i] = Math.sin(away);
      this.fallAxisZ[i] = -Math.cos(away);
      const dist = Math.hypot(slot.x, slot.z);
      // Ridge and far-slope slots (appended after the collidable near trees) are never close enough for the high build.
      const lod = dist > lod2Radius ? 2 : QUALITY[quality].nearLod === 1 || dist > lod1Radius || i >= near.length ? 1 : 0;
      const key = this.species[i] * 3 + lod;
      const list = lists.get(key);
      if (list) list.push(i);
      else lists.set(key, [i]);

      if (this.dynamic[i]) {
        const sev1 = surfaceFromBase(this.baseY[i], slot.x, slot.z, layout, 1, this.out);
        const v1 = treeVisibilityFromCleared(slot, sev1.cleared, layout, 1);
        if (v1 < 0.55 && stumpAmount(slot, v1, layout, 1) > 0.05) stumpList.push(i);
      }
    });
    for (const key of [...lists.keys()].sort((a, b) => a - b)) {
      const ids = Int32Array.from(lists.get(key) as number[]);
      this.groupSpecs.push({ species: Math.floor(key / 3), lod: (key % 3) as 0 | 1 | 2, count: ids.length });
      this.groupIds.push(ids);
      const dyn: number[] = [];
      ids.forEach((slotId, k) => {
        if (this.dynamic[slotId]) dyn.push(k);
      });
      this.groupDyn.push(Int32Array.from(dyn));
    }
    this.stumpIds = Int32Array.from(stumpList);
    this.stumpRadius = Float32Array.from(stumpList, (i) => stumpRadiusBySpecies[this.species[i]] ?? 1);
    this.stumpCount = stumpList.length;
    this.logs = generateLogSlots(layout, QUALITY[quality].logs);
    this.logCount = this.logs.length;
  }

  /** Colours and every matrix that no severity can change. */
  init(meshes: ForestMeshes): void {
    this.groupIds.forEach((ids, g) => {
      const mesh = meshes.groups[g];
      if (!mesh) return;
      ids.forEach((slotId, k) => {
        mesh.setColorAt(k, instanceTint(this.color, slotId, 5));
        if (!this.dynamic[slotId]) {
          const slot = this.slots[slotId];
          const ground = terrainHeightFromBase(this.baseY[slotId], slot.x, slot.z, this.layout, 0);
          this.writeTree(mesh, k, slotId, ground, 1);
        }
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
    });
    const stumps = meshes.stumps;
    if (stumps) {
      for (let k = 0; k < this.stumpCount; k++) stumps.setColorAt(k, instanceTint(this.color, this.stumpIds[k], 9, 0.7));
      if (stumps.instanceColor) stumps.instanceColor.needsUpdate = true;
    }
    const logs = meshes.logs;
    if (logs) {
      for (let k = 0; k < this.logCount; k++) logs.setColorAt(k, instanceTint(this.color, k, 13, 0.7));
      if (logs.instanceColor) logs.instanceColor.needsUpdate = true;
    }
  }

  /** Re-evaluate everything severity can change. */
  update(meshes: ForestMeshes, severityFraction: number): void {
    const layout = this.layout;
    for (let g = 0; g < this.groupIds.length; g++) {
      const mesh = meshes.groups[g];
      if (!mesh) continue;
      const ids = this.groupIds[g];
      const dyn = this.groupDyn[g];
      for (let d = 0; d < dyn.length; d++) {
        const k = dyn[d];
        const i = ids[k];
        const slot = this.slots[i];
        const s = surfaceFromBase(this.baseY[i], slot.x, slot.z, layout, severityFraction, this.out);
        const vis = treeVisibilityFromCleared(slot, s.cleared, layout, severityFraction);
        this.ground[i] = s.height;
        this.vis[i] = vis;
        this.writeTree(mesh, k, i, s.height, vis);
      }
      if (dyn.length) mesh.instanceMatrix.needsUpdate = true;
    }

    const stumps = meshes.stumps;
    if (stumps) {
      const d = this.dummy;
      d.rotation.set(0, 0, 0, "YXZ");
      for (let k = 0; k < this.stumpCount; k++) {
        const i = this.stumpIds[k];
        const slot = this.slots[i];
        const amount = stumpAmount(slot, this.vis[i], layout, severityFraction);
        if (amount <= 0.002) {
          d.scale.setScalar(0);
        } else {
          const sc = slot.baseScale * amount;
          d.scale.set(sc * this.stumpRadius[k], sc, sc * this.stumpRadius[k]);
        }
        d.position.set(slot.x, this.ground[i] - 0.03, slot.z);
        d.rotation.y = slot.rotationY;
        d.updateMatrix();
        stumps.setMatrixAt(k, d.matrix);
      }
      stumps.instanceMatrix.needsUpdate = true;
    }

    const logsMesh = meshes.logs;
    if (logsMesh) {
      const d = this.dummy;
      d.rotation.set(0, 0, 0, "YXZ");
      for (let k = 0; k < this.logCount; k++) {
        const log = this.logs[k];
        const amount = logAmount(log, layout, severityFraction);
        if (amount <= 0.002) {
          d.scale.setScalar(0);
          d.position.set(log.x, 0, log.z);
        } else {
          const dx = Math.cos(log.yaw);
          const dz = -Math.sin(log.yaw);
          const half = log.length / 2;
          const h1 = terrainHeightFromBase(baseHeight(log.x - dx * half, log.z - dz * half, layout), log.x - dx * half, log.z - dz * half, layout, severityFraction);
          const h2 = terrainHeightFromBase(baseHeight(log.x + dx * half, log.z + dz * half, layout), log.x + dx * half, log.z + dz * half, layout, severityFraction);
          const mid = (h1 + h2) / 2;
          d.position.set(log.x, mid + log.radius * 0.7, log.z);
          d.rotation.set(0, log.yaw, Math.atan2(h2 - h1, log.length), "YXZ");
          d.scale.set(log.length * amount, log.radius * amount, log.radius * amount);
        }
        d.updateMatrix();
        logsMesh.setMatrixAt(k, d.matrix);
      }
      logsMesh.instanceMatrix.needsUpdate = true;
    }
  }

  private writeTree(mesh: THREE.InstancedMesh, k: number, i: number, ground: number, vis: number): void {
    const slot = this.slots[i];
    const d = this.dummy;
    const standing = smoothstep(vis, FELL_START, FELL_END);
    if (standing <= 0.002) {
      d.scale.setScalar(0);
      d.position.set(slot.x, ground, slot.z);
      d.quaternion.identity();
    } else {
      const s = slot.baseScale * standing;
      const w = this.wide[i];
      d.scale.set(s * w, s, s * w);
      d.position.set(slot.x, ground - SINK, slot.z);
      this.qYaw.setFromAxisAngle(this.axis.set(0, 1, 0), slot.rotationY);
      const tilt = (1 - standing) * FALL_ANGLE;
      if (tilt > 0.001) {
        this.axis.set(this.fallAxisX[i], 0, this.fallAxisZ[i]);
        this.qTilt.setFromAxisAngle(this.axis, tilt);
        d.quaternion.copy(this.qTilt).multiply(this.qYaw);
      } else {
        d.quaternion.copy(this.qYaw);
      }
    }
    d.updateMatrix();
    mesh.setMatrixAt(k, d.matrix);
  }
}

// ---------------------------------------------------------------------------
// Undergrowth: ferns, shrubs, grass, big-leaf plants and saplings.
// ---------------------------------------------------------------------------

export class UndergrowthRig {
  readonly slots: UndergrowthSlot[];
  readonly kindCounts: number[];

  private readonly layout: SceneLayout;
  private readonly baseY: Float32Array;
  private readonly dynamic: Uint8Array;
  private readonly ids: Int32Array[];
  private readonly dyn: Int32Array[];
  private readonly out: SurfaceSample = { height: 0, cleared: 0 };
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();

  constructor(layout: SceneLayout, quality: Quality, kindTotal: number) {
    this.layout = layout;
    this.slots = generateUndergrowthSlots(layout, QUALITY[quality].undergrowth);
    this.baseY = new Float32Array(this.slots.length);
    this.dynamic = new Uint8Array(this.slots.length);
    const lists: number[][] = Array.from({ length: kindTotal }, () => []);
    this.slots.forEach((slot, i) => {
      this.baseY[i] = baseHeight(slot.x, slot.z, layout);
      this.dynamic[i] = isSeverityStatic(slot.x, slot.z, layout) ? 0 : 1;
      lists[slot.kind].push(i);
    });
    this.ids = lists.map((l) => Int32Array.from(l));
    this.kindCounts = lists.map((l) => l.length);
    this.dyn = this.ids.map((ids) => {
      const out: number[] = [];
      ids.forEach((slotId, k) => {
        if (this.dynamic[slotId]) out.push(k);
      });
      return Int32Array.from(out);
    });
  }

  init(meshes: Array<THREE.InstancedMesh | null>): void {
    this.ids.forEach((ids, kind) => {
      const mesh = meshes[kind];
      if (!mesh) return;
      ids.forEach((slotId, k) => {
        mesh.setColorAt(k, instanceTint(this.color, slotId, 31, 1.1));
        if (!this.dynamic[slotId]) {
          const slot = this.slots[slotId];
          this.write(mesh, k, slotId, terrainHeightFromBase(this.baseY[slotId], slot.x, slot.z, this.layout, 0), 1);
        }
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  update(meshes: Array<THREE.InstancedMesh | null>, severityFraction: number): void {
    for (let kind = 0; kind < this.ids.length; kind++) {
      const mesh = meshes[kind];
      if (!mesh) continue;
      const ids = this.ids[kind];
      const dyn = this.dyn[kind];
      for (let d = 0; d < dyn.length; d++) {
        const k = dyn[d];
        const i = ids[k];
        const slot = this.slots[i];
        const s = surfaceFromBase(this.baseY[i], slot.x, slot.z, this.layout, severityFraction, this.out);
        this.write(mesh, k, i, s.height, undergrowthVisibility(slot, s.cleared));
      }
      if (dyn.length) mesh.instanceMatrix.needsUpdate = true;
    }
  }

  private write(mesh: THREE.InstancedMesh, k: number, i: number, ground: number, vis: number): void {
    const slot = this.slots[i];
    const d = this.dummy;
    d.scale.setScalar(vis <= 0.002 ? 0 : slot.scale * vis);
    d.position.set(slot.x, ground - 0.03, slot.z);
    d.rotation.set(0, slot.rotationY, 0);
    d.updateMatrix();
    mesh.setMatrixAt(k, d.matrix);
  }
}
