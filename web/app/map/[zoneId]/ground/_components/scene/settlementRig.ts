import * as THREE from "three";
import { LOOK } from "../../_lib/look";
import {
  FENCE_SLAT_SPACING,
  createRng,
  houseAppear,
  houseToWorld,
  roadAppear,
  settlementPlan,
  smoothstep,
  terrainHeight,
  type SceneLayout,
  type SettlementPlan,
} from "../../_lib/terrain";
import {
  EAVE_Y,
  PLINTH_BASE,
  PLINTH_TOP,
  POLE_WIRE_OFFSETS,
  ROOF,
  ROOF_PITCH,
  SHED,
  SHED_LENGTH,
  SHED_PITCH,
  SLOPE_LENGTH,
  VERANDA,
  VERANDA_LENGTH,
  VERANDA_PITCH,
} from "./houseGeometry";
import { instanceTint } from "./forestRig";

/**
 * Imperative half of the settlement: every position, scale and visibility the
 * slider drives. The house is built in stages out of sub-ranges of
 * `houseAppear` (plinth, frame, walls, roof, then the homestead around it),
 * each piece scaled about its own base inside an unscaled, positioned group.
 */

export interface SettlementMeshes {
  house: THREE.Group | null;
  plinth: THREE.Mesh | null;
  frame: THREE.Mesh | null;
  walls: THREE.Mesh | null;
  openings: THREE.Mesh | null;
  trim: THREE.Mesh | null;
  veranda: THREE.Mesh | null;
  shed: THREE.Mesh | null;
  logStack: THREE.Mesh | null;
  clothes: THREE.Mesh | null;
  clothLine: THREE.LineSegments | null;
  sheets: THREE.InstancedMesh | null;
  rafters: THREE.InstancedMesh | null;
  slats: THREE.InstancedMesh | null;
  rails: THREE.InstancedMesh | null;
  bananas: THREE.InstancedMesh | null;
  poles: THREE.InstancedMesh | null;
  stones: THREE.InstancedMesh | null;
  wires: THREE.LineSegments | null;
}

export function emptyMeshes(): SettlementMeshes {
  return {
    house: null, plinth: null, frame: null, walls: null, openings: null, trim: null,
    veranda: null, shed: null, logStack: null, clothes: null, clothLine: null,
    sheets: null, rafters: null, slats: null, rails: null, bananas: null,
    poles: null, stones: null, wires: null,
  };
}

/** A ref callback that files a mounted object under `key` in `store`. */
export function bindMesh<K extends keyof SettlementMeshes>(store: SettlementMeshes, key: K) {
  return (node: SettlementMeshes[K] | null): void => {
    store[key] = node as SettlementMeshes[K];
  };
}

const HOUSE_SHEETS = ROOF.sheetsPerSlope * 2;
const VERANDA_SHEETS = 5;
const SHED_SHEETS = 3;
export const SHEET_COUNT = HOUSE_SHEETS + VERANDA_SHEETS + SHED_SHEETS;
export const RAFTER_COUNT = ROOF.sheetsPerSlope * 2;
const WIRE_SEGMENTS = 8;
const WIRES_PER_SPAN = POLE_WIRE_OFFSETS.length;

function range(value: number, a: number, b: number): number {
  return smoothstep(value, a, b);
}

export class SettlementRig {
  readonly plan: SettlementPlan;
  readonly slatCount: number;
  readonly railCount: number;
  readonly poleCount: number;
  readonly stoneCount: number;
  readonly wireVertexCount: number;
  readonly bananaCount: number;
  readonly clothLineVertexCount = 6;

  private readonly layout: SceneLayout;
  private readonly slatPos: Array<{ lx: number; lz: number; h: number }> = [];
  private readonly railStations: number[] = [];
  private readonly wirePositions: Float32Array;
  private readonly dummy = new THREE.Object3D();
  private readonly qA = new THREE.Quaternion();
  private readonly qB = new THREE.Quaternion();
  private readonly axisX = new THREE.Vector3(1, 0, 0);
  private readonly axisY = new THREE.Vector3(0, 1, 0);
  private readonly color = new THREE.Color();
  private readonly poleHeights: Float32Array;
  private readonly poleK: Float32Array;
  private readonly slatGround: Float32Array;
  private readonly slatK: Float32Array;

  constructor(layout: SceneLayout) {
    this.layout = layout;
    this.plan = settlementPlan(layout);
    const rng = createRng(layout.seed + 777);

    // Fence slats along the path, with a rail station every 8th slat.
    const path = this.plan.fence;
    for (let s = 0; s < path.length - 1; s++) {
      const a = path[s];
      const b = path[s + 1];
      const len = Math.hypot(b.lx - a.lx, b.lz - a.lz);
      const n = Math.round(len / FENCE_SLAT_SPACING);
      for (let i = 0; i < n; i++) {
        const t = i / n;
        if (i % 8 === 0) this.railStations.push(this.slatPos.length);
        this.slatPos.push({
          lx: a.lx + (b.lx - a.lx) * t + (rng() - 0.5) * 0.04,
          lz: a.lz + (b.lz - a.lz) * t + (rng() - 0.5) * 0.04,
          h: 0.85 + rng() * 0.4,
        });
      }
    }
    const last = path[path.length - 1];
    this.railStations.push(this.slatPos.length);
    this.slatPos.push({ lx: last.lx, lz: last.lz, h: 1.0 });
    this.slatCount = this.slatPos.length;
    this.railCount = (this.railStations.length - 1) * 2;
    this.poleCount = this.plan.poles.length;
    this.stoneCount = this.plan.stones.length;
    this.bananaCount = this.plan.bananas.length;
    const spans = Math.max(0, this.poleCount - 1);
    this.wireVertexCount = spans * WIRES_PER_SPAN * WIRE_SEGMENTS * 2;
    this.wirePositions = new Float32Array(this.wireVertexCount * 3);
    this.poleHeights = new Float32Array(this.poleCount);
    this.poleK = new Float32Array(this.poleCount);
    this.slatGround = new Float32Array(this.slatCount);
    this.slatK = new Float32Array(this.slatCount);
  }

  /** Colours that never change. */
  init(m: SettlementMeshes): void {
    const rng = createRng(this.layout.seed + 4242);
    if (m.sheets) {
      for (let n = 0; n < SHEET_COUNT; n++) {
        const rust = rng() < 0.2;
        const base = rust ? LOOK.house.roofRust : LOOK.house.roofTin;
        this.color.set(base);
        const v = 0.88 + rng() * 0.22;
        this.color.setRGB(this.color.r * v, this.color.g * v, this.color.b * v * (rust ? 1 : 0.98 + rng() * 0.06));
        m.sheets.setColorAt(n, this.color);
      }
      if (m.sheets.instanceColor) m.sheets.instanceColor.needsUpdate = true;
    }
    if (m.bananas) {
      for (let i = 0; i < this.bananaCount; i++) m.bananas.setColorAt(i, instanceTint(this.color, i, 77));
      if (m.bananas.instanceColor) m.bananas.instanceColor.needsUpdate = true;
    }
    if (m.slats) {
      for (let i = 0; i < this.slatCount; i++) m.slats.setColorAt(i, instanceTint(this.color, i, 55, 0.8));
      if (m.slats.instanceColor) m.slats.instanceColor.needsUpdate = true;
    }
    if (m.stones) {
      for (let i = 0; i < this.stoneCount; i++) m.stones.setColorAt(i, instanceTint(this.color, i, 66, 0.8));
      if (m.stones.instanceColor) m.stones.instanceColor.needsUpdate = true;
    }
    const line = m.clothLine;
    if (line) {
      const { a, b } = this.plan.clothesline;
      const dx = b.lx - a.lx;
      const dz = b.lz - a.lz;
      const pos = line.geometry.attributes.position;
      const pts: Array<[number, number, number]> = [];
      for (let i = 0; i <= 3; i++) {
        const t = i / 3;
        pts.push([dx * t, 2.3 - 0.12 * 4 * t * (1 - t), dz * t]);
      }
      for (let i = 0; i < 3; i++) {
        pos.setXYZ(i * 2, ...pts[i]);
        pos.setXYZ(i * 2 + 1, ...pts[i + 1]);
      }
      pos.needsUpdate = true;
    }
  }

  update(m: SettlementMeshes, severityFraction: number): void {
    this.updateRoadside(m, severityFraction);
    this.updateHouse(m, severityFraction);
  }

  // ---- Road furniture ------------------------------------------------------

  private updateRoadside(m: SettlementMeshes, sev: number): void {
    const layout = this.layout;
    const ra = roadAppear(sev);
    const d = this.dummy;
    const n = this.poleCount;
    const poles = m.poles;
    const heights = this.poleHeights;
    const ks = this.poleK;
    if (poles) {
      d.rotation.set(0, 0, 0, "YXZ");
      this.plan.poles.forEach((p, i) => {
        const k = range(ra, 0.3 + 0.45 * (i / Math.max(1, n)), 0.55 + 0.4 * (i / Math.max(1, n)));
        const y = terrainHeight(p.x, p.z, layout, sev);
        heights[i] = y;
        ks[i] = k;
        d.position.set(p.x, y, p.z);
        d.rotation.y = p.yaw;
        d.scale.set(1, k <= 0.002 ? 0 : k, 1);
        d.updateMatrix();
        poles.setMatrixAt(i, d.matrix);
      });
      poles.instanceMatrix.needsUpdate = true;
    }

    // Wires between consecutive standing poles, sagging in the middle.
    const wires = m.wires;
    if (wires) {
      const out = this.wirePositions;
      let v = 0;
      let spansDrawn = 0;
      for (let i = 0; i < n - 1; i++) {
        if (ks[i] < 0.98 || ks[i + 1] < 0.98) break;
        spansDrawn++;
        const pa = this.plan.poles[i];
        const pb = this.plan.poles[i + 1];
        const span = Math.hypot(pb.x - pa.x, pb.z - pa.z);
        const sag = 0.035 * span;
        for (const [ox, oy] of POLE_WIRE_OFFSETS) {
          const ax = pa.x + Math.cos(pa.yaw) * ox;
          const az = pa.z - Math.sin(pa.yaw) * ox;
          const bx = pb.x + Math.cos(pb.yaw) * ox;
          const bz = pb.z - Math.sin(pb.yaw) * ox;
          const ay = heights[i] + oy;
          const by = heights[i + 1] + oy;
          for (let s = 0; s < WIRE_SEGMENTS; s++) {
            for (let e = 0; e < 2; e++) {
              const t = (s + e) / WIRE_SEGMENTS;
              out[v++] = ax + (bx - ax) * t;
              out[v++] = ay + (by - ay) * t - sag * 4 * t * (1 - t);
              out[v++] = az + (bz - az) * t;
            }
          }
        }
      }
      const attr = wires.geometry.attributes.position;
      (attr.array as Float32Array).set(out);
      attr.needsUpdate = true;
      wires.geometry.setDrawRange(0, spansDrawn * WIRES_PER_SPAN * WIRE_SEGMENTS * 2);
    }

    const stones = m.stones;
    if (stones) {
      d.rotation.set(0, 0, 0, "YXZ");
      this.plan.stones.forEach((st, i) => {
        const k = range(ra, 0.2, 0.5);
        d.position.set(st.x, terrainHeight(st.x, st.z, layout, sev) - 0.05, st.z);
        d.rotation.y = st.yaw;
        d.scale.set(st.size * k, st.size * k * 0.8, st.size * k * 1.1);
        d.updateMatrix();
        stones.setMatrixAt(i, d.matrix);
      });
      stones.instanceMatrix.needsUpdate = true;
    }
  }

  // ---- House and homestead -------------------------------------------------

  private groundLocal(lx: number, lz: number, houseY: number, sev: number): number {
    const w = houseToWorld(this.layout, lx, lz);
    return terrainHeight(w.x, w.z, this.layout, sev) - houseY;
  }

  private slopeSheet(
    d: THREE.Object3D,
    sheets: THREE.InstancedMesh,
    n: number,
    x: number,
    y: number,
    z: number,
    pitch: number,
    flip: boolean,
    scaleZ: number,
  ): void {
    this.qA.setFromAxisAngle(this.axisX, pitch);
    if (flip) {
      this.qB.setFromAxisAngle(this.axisY, Math.PI);
      this.qA.premultiply(this.qB);
    }
    d.position.set(x, y, z);
    d.quaternion.copy(this.qA);
    d.scale.set(1, 1, Math.max(scaleZ, 0.0001));
    d.updateMatrix();
    sheets.setMatrixAt(n, d.matrix);
  }

  private setStage(mesh: THREE.Mesh | null, y: number, k: number, axis: "y" | "all" = "y"): void {
    if (!mesh) return;
    mesh.visible = k > 0.002;
    mesh.position.y = y;
    if (axis === "y") mesh.scale.set(1, Math.max(k, 0.0001), 1);
    else mesh.scale.setScalar(Math.max(k, 0.0001));
  }

  private updateHouse(m: SettlementMeshes, sev: number): void {
    const house = m.house;
    if (!house) return;
    const ha = houseAppear(sev);
    house.visible = ha > 0.001;
    if (ha <= 0.001) return;
    const layout = this.layout;
    const { x, z } = layout.house;
    const houseY = terrainHeight(x, z, layout, sev);
    house.position.set(x, houseY, z);

    const pK = range(ha, 0, 0.16);
    const fK = range(ha, 0.12, 0.32);
    const wK = range(ha, 0.28, 0.58);
    const vK = range(ha, 0.38, 0.58);
    const rK = range(ha, 0.5, 0.66);
    const tK = range(ha, 0.6, 0.7);
    const sK = range(ha, 0.64, 0.84);
    const verK = range(ha, 0.8, 0.9);

    this.setStage(m.plinth, PLINTH_BASE, pK);
    this.setStage(m.frame, PLINTH_TOP, fK);
    this.setStage(m.walls, PLINTH_TOP, wK);
    this.setStage(m.openings, PLINTH_TOP, wK > 0.92 ? 1 : 0);
    this.setStage(m.veranda, PLINTH_TOP - 0.1, vK);
    if (m.trim) {
      m.trim.visible = tK > 0.002;
      m.trim.position.y = PLINTH_TOP;
      m.trim.scale.set(Math.max(tK, 0.0001), 1, 1);
    }

    const d = this.dummy;
    const base = PLINTH_TOP;
    const rafters = m.rafters;
    if (rafters) {
      const per = ROOF.sheetsPerSlope;
      for (let i = 0; i < per; i++) {
        const xi = -3.2 + (6.4 * i) / (per - 1);
        const k = clamp01(rK * (per + 1) - i);
        for (let s = 0; s < 2; s++) {
          this.slopeSheet(d, rafters, i * 2 + s, xi, base + EAVE_Y, s === 0 ? ROOF.eaveZ : -ROOF.eaveZ, ROOF_PITCH, s === 1, k);
        }
      }
      rafters.instanceMatrix.needsUpdate = true;
      rafters.visible = rK > 0.002;
    }

    const sheets = m.sheets;
    if (sheets) {
      const per = ROOF.sheetsPerSlope;
      const sw = ROOF.sheetWidth;
      for (let i = 0; i < per; i++) {
        const xi = -((per * sw) / 2) + sw * (i + 0.5);
        for (let s = 0; s < 2; s++) {
          const n = i * 2 + s;
          const k = clamp01(sK * (HOUSE_SHEETS + 3) - n);
          this.slopeSheet(d, sheets, n, xi, base + EAVE_Y + 0.03, s === 0 ? ROOF.eaveZ : -ROOF.eaveZ, ROOF_PITCH, s === 1, k);
        }
      }
      const vScale = (VERANDA_LENGTH + 0.05) / (SLOPE_LENGTH + 0.04);
      for (let i = 0; i < VERANDA_SHEETS; i++) {
        const xi = -((VERANDA_SHEETS * sw) / 2) + sw * (i + 0.5);
        const k = clamp01(verK * (VERANDA_SHEETS + 2) - i);
        this.slopeSheet(d, sheets, HOUSE_SHEETS + i, xi, base + VERANDA.eaveY + 0.03, VERANDA.eaveZ + 0.1, VERANDA_PITCH, false, k * vScale);
      }

      // Cowshed roof.
      const shed = this.plan.shed;
      const shedGround = this.groundLocal(shed.lx, shed.lz, houseY, sev);
      const shedK = range(ha, 0.88, 0.96);
      const sScale = SHED_LENGTH / (SLOPE_LENGTH + 0.04);
      const hd = shed.depth / 2;
      for (let i = 0; i < SHED_SHEETS; i++) {
        const xi = shed.lx + (i - 1) * 0.8;
        const k = clamp01(shedK * (SHED_SHEETS + 1.5) - i);
        this.slopeSheet(
          d,
          sheets,
          HOUSE_SHEETS + VERANDA_SHEETS + i,
          xi,
          shedGround + SHED.backH + 0.03 - 0.25 * Math.tan(SHED_PITCH),
          shed.lz - hd - 0.25,
          SHED_PITCH,
          true,
          k * sScale,
        );
      }
      sheets.instanceMatrix.needsUpdate = true;
      sheets.visible = sK > 0.002 || verK > 0.002 || shedK > 0.002;

      // Cowshed frame, placed on its own ground.
      if (m.shed) {
        m.shed.position.x = shed.lx;
        m.shed.position.z = shed.lz;
        this.setStage(m.shed, shedGround, range(ha, 0.78, 0.9));
      }
    }

    this.updateYard(m, ha, houseY, sev);
  }

  private updateYard(m: SettlementMeshes, ha: number, houseY: number, sev: number): void {
    const d = this.dummy;
    d.rotation.set(0, 0, 0, "YXZ");

    const slats = m.slats;
    const rails = m.rails;
    const n = this.slatCount;
    if (slats) {
      const ground = this.slatGround;
      const ks = this.slatK;
      for (let i = 0; i < n; i++) {
        const p = this.slatPos[i];
        const gy = this.groundLocal(p.lx, p.lz, houseY, sev);
        const k = range(ha, 0.74 + 0.2 * (i / n), 0.78 + 0.2 * (i / n));
        ground[i] = gy;
        ks[i] = k;
        d.position.set(p.lx, gy, p.lz);
        d.rotation.y = 0;
        d.scale.set(1, k <= 0.002 ? 0 : p.h * k, 1);
        d.updateMatrix();
        slats.setMatrixAt(i, d.matrix);
      }
      slats.instanceMatrix.needsUpdate = true;

      if (rails) {
        for (let j = 0; j < this.railStations.length - 1; j++) {
          const ia = this.railStations[j];
          const ib = this.railStations[j + 1];
          const a = this.slatPos[ia];
          const b = this.slatPos[ib];
          const dx = b.lx - a.lx;
          const dz = b.lz - a.lz;
          const len = Math.hypot(dx, dz);
          const k = Math.min(ks[ia], ks[ib]);
          for (let r = 0; r < 2; r++) {
            const lift = r === 0 ? 0.35 : 0.85;
            const ya = ground[ia] + lift;
            const yb = ground[ib] + lift;
            d.position.set(a.lx, ya, a.lz);
            d.rotation.set(0, Math.atan2(-dz, dx), Math.atan2(yb - ya, len), "YXZ");
            d.scale.set(k <= 0.002 ? 0 : len * k, 1, 1);
            d.updateMatrix();
            rails.setMatrixAt(j * 2 + r, d.matrix);
          }
        }
        d.rotation.set(0, 0, 0, "YXZ");
        rails.instanceMatrix.needsUpdate = true;
      }
    }

    const bananas = m.bananas;
    if (bananas) {
      this.plan.bananas.forEach((b, i) => {
        const k = range(ha, 0.84 + 0.04 * i, 0.9 + 0.04 * i);
        d.position.set(b.lx, this.groundLocal(b.lx, b.lz, houseY, sev) - 0.03, b.lz);
        d.rotation.y = b.yaw;
        d.scale.setScalar(k <= 0.002 ? 0 : b.scale * k);
        d.updateMatrix();
        bananas.setMatrixAt(i, d.matrix);
      });
      bananas.instanceMatrix.needsUpdate = true;
    }

    const stack = this.plan.logStack;
    if (m.logStack) {
      m.logStack.position.x = stack.lx;
      m.logStack.position.z = stack.lz;
      m.logStack.rotation.y = stack.yaw;
      this.setStage(m.logStack, this.groundLocal(stack.lx, stack.lz, houseY, sev), range(ha, 0.86, 0.94));
    }

    const { a } = this.plan.clothesline;
    const lineY = this.groundLocal(a.lx, a.lz, houseY, sev);
    const lineK = range(ha, 0.9, 1);
    for (const mesh of [m.clothes, m.clothLine]) {
      if (!mesh) continue;
      mesh.position.set(a.lx, lineY, a.lz);
      mesh.visible = lineK > 0.002;
      mesh.scale.set(1, Math.max(lineK, 0.0001), 1);
    }
  }
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
