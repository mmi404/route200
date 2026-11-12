import { describe, expect, it } from "vitest";
import {
  EYE_HEIGHT,
  MAX_PITCH,
  PLAYER_RADIUS,
  SPRINT_SPEED,
  WALK_SPEED,
  stepPlayer,
  type PlayerInput,
  type PlayerState,
  type PlayerWorld,
} from "./player";

const IDLE: PlayerInput = { moveX: 0, moveZ: 0, lookYaw: 0, lookPitch: 0, sprint: false };

function start(overrides: Partial<PlayerState> = {}): PlayerState {
  return { x: 0, z: 0, y: EYE_HEIGHT, yaw: 0, pitch: 0, vx: 0, vz: 0, ...overrides };
}

function flatWorld(overrides: Partial<PlayerWorld> = {}): PlayerWorld {
  return { heightAt: () => 0, walkRadius: 52, obstacles: [], ...overrides };
}

function run(
  state: PlayerState,
  input: Partial<PlayerInput>,
  seconds: number,
  world: PlayerWorld,
  dt = 1 / 60,
): PlayerState {
  let current = state;
  const steps = Math.round(seconds / dt);
  for (let i = 0; i < steps; i++) current = stepPlayer(current, { ...IDLE, ...input }, dt, world);
  return current;
}

describe("stepPlayer", () => {
  it("walks forward along the yaw direction at roughly walk speed", () => {
    // yaw 0 looks down -Z.
    const end = run(start(), { moveZ: 1 }, 3, flatWorld());
    expect(end.x).toBeCloseTo(0, 5);
    expect(end.z).toBeLessThan(0);
    // 3 s with ease-in: a bit under 3 * WALK_SPEED.
    expect(-end.z).toBeGreaterThan(WALK_SPEED * 3 * 0.8);
    expect(-end.z).toBeLessThan(WALK_SPEED * 3 * 1.02);

    // Turned 90 degrees left (yaw +pi/2), forward is -X.
    const left = run(start({ yaw: Math.PI / 2 }), { moveZ: 1 }, 2, flatWorld());
    expect(left.x).toBeLessThan(-WALK_SPEED * 2 * 0.8);
    expect(Math.abs(left.z)).toBeLessThan(0.01);
  });

  it("strafes right relative to yaw and does not exceed speed on diagonals", () => {
    const right = run(start(), { moveX: 1 }, 2, flatWorld());
    expect(right.x).toBeGreaterThan(WALK_SPEED * 2 * 0.8);
    const diagonal = run(start(), { moveX: 1, moveZ: 1 }, 4, flatWorld());
    expect(Math.hypot(diagonal.vx, diagonal.vz)).toBeLessThanOrEqual(WALK_SPEED + 1e-6);
  });

  it("sprints faster than walking", () => {
    const walk = run(start(), { moveZ: 1 }, 3, flatWorld());
    const sprint = run(start(), { moveZ: 1, sprint: true }, 3, flatWorld());
    expect(-sprint.z).toBeGreaterThan(-walk.z * 1.5);
    expect(Math.hypot(sprint.vx, sprint.vz)).toBeLessThanOrEqual(SPRINT_SPEED + 1e-6);
  });

  it("accelerates and decelerates smoothly instead of teleporting", () => {
    const first = stepPlayer(start(), { ...IDLE, moveZ: 1 }, 1 / 60, flatWorld());
    expect(Math.hypot(first.vx, first.vz)).toBeLessThan(WALK_SPEED * 0.5);
    const moving = run(start(), { moveZ: 1 }, 2, flatWorld());
    const stopped = stepPlayer(moving, IDLE, 1 / 60, flatWorld());
    expect(Math.hypot(stopped.vx, stopped.vz)).toBeGreaterThan(0);
    expect(Math.hypot(stopped.vx, stopped.vz)).toBeLessThan(Math.hypot(moving.vx, moving.vz));
    const rest = run(moving, {}, 2, flatWorld());
    expect(Math.hypot(rest.vx, rest.vz)).toBeLessThan(0.01);
  });

  it("skips smoothing in reduced-motion mode", () => {
    const first = stepPlayer(start(), { ...IDLE, moveZ: 1 }, 1 / 60, flatWorld({ reducedMotion: true }));
    expect(Math.hypot(first.vx, first.vz)).toBeCloseTo(WALK_SPEED, 5);
  });

  it("cannot leave walkRadius + 3 however long forward is held", () => {
    const world = flatWorld({ walkRadius: 52 });
    let state = start({ yaw: Math.PI / 2 }); // heading -X
    for (let i = 0; i < 60 * 60; i++) {
      state = stepPlayer(state, { ...IDLE, moveZ: 1, sprint: true }, 1 / 60, world);
      expect(Math.hypot(state.x, state.z)).toBeLessThanOrEqual(55 + 1e-6);
    }
    expect(Math.hypot(state.x, state.z)).toBeGreaterThan(50);
  });

  it("cannot walk up a cliff, and slides along it instead of sticking", () => {
    // A vertical wall along x = 5.
    const world = flatWorld({ heightAt: (x) => (x > 5 ? 20 : 0) });
    // Facing +X (yaw -pi/2) and walking into the wall.
    const blocked = run(start({ yaw: -Math.PI / 2 }), { moveZ: 1, sprint: true }, 5, world);
    expect(blocked.x).toBeLessThan(5.1);
    // Diagonal into the wall: x is held back but z keeps moving.
    const slide = run(start({ yaw: -Math.PI / 2 }), { moveZ: 1, moveX: -1, sprint: true }, 3, world);
    expect(slide.x).toBeLessThan(5.1);
    expect(Math.abs(slide.z)).toBeGreaterThan(5);
  });

  it("slows on a walkable uphill and is not boosted downhill", () => {
    const slope = (angleDeg: number) => (x: number) => x * Math.tan((angleDeg * Math.PI) / 180);
    const flat = run(start({ yaw: -Math.PI / 2 }), { moveZ: 1 }, 3, flatWorld());
    const up = run(start({ yaw: -Math.PI / 2 }), { moveZ: 1 }, 3, flatWorld({ heightAt: slope(20) }));
    const down = run(start({ yaw: -Math.PI / 2 }), { moveZ: 1 }, 3, flatWorld({ heightAt: slope(-20) }));
    expect(up.x).toBeGreaterThan(0);
    expect(up.x).toBeLessThan(flat.x * 0.9);
    expect(down.x).toBeCloseTo(flat.x, 1);
  });

  it("climbs a steep real-DEM-like slope (43 degrees) slowly instead of stalling", () => {
    // Teknaf's real heightmap peaks at ~43.4 degrees inside the walkable
    // disc (PROGRESS.md "Phase 6"); a visitor must still be able to reach
    // it, just slowly, not be hard-blocked the way a true cliff is.
    const slope = (x: number) => x * Math.tan((43 * Math.PI) / 180);
    const up = run(start({ yaw: -Math.PI / 2 }), { moveZ: 1, sprint: true }, 6, flatWorld({ heightAt: slope }));
    expect(up.x).toBeGreaterThan(1);
  });

  it("is pushed out of an obstacle and slides along it", () => {
    const world = flatWorld({ obstacles: [{ x: 0, z: -3, r: 1 }] });
    // Walk straight at the centre of the circle.
    const straight = run(start(), { moveZ: 1 }, 3, world);
    expect(Math.hypot(straight.x, straight.z + 3)).toBeGreaterThanOrEqual(1 + PLAYER_RADIUS - 1e-6);
    expect(straight.z).toBeGreaterThan(-3);
    // Starting inside the circle gets ejected.
    const inside = stepPlayer(start({ x: 0, z: -3.2 }), IDLE, 1 / 60, world);
    expect(Math.hypot(inside.x, inside.z + 3)).toBeGreaterThanOrEqual(1 + PLAYER_RADIUS - 1e-6);
    // Off-centre approach slides around instead of stopping dead.
    const offset = run(start({ x: 0.5 }), { moveZ: 1 }, 4, world);
    expect(offset.z).toBeLessThan(-3.5);
  });

  it("keeps eye height tracking the ground, never below ground + 1.2", () => {
    const hill = flatWorld({ heightAt: (x) => Math.sin(x * 0.2) * 3 });
    let state = start({ yaw: -Math.PI / 2 });
    for (let i = 0; i < 60 * 10; i++) {
      state = stepPlayer(state, { ...IDLE, moveZ: 1, sprint: true }, 1 / 60, hill);
      expect(state.y).toBeGreaterThanOrEqual(hill.heightAt(state.x, state.z) + 1.2 - 1e-9);
    }
    const settled = run(state, {}, 3, hill);
    expect(settled.y).toBeCloseTo(hill.heightAt(settled.x, settled.z) + EYE_HEIGHT, 2);
  });

  it("rides the ground when it drops (cut hill) rather than hovering", () => {
    let state = run(start({ y: 5 }), {}, 0.05, flatWorld({ heightAt: () => 3 }));
    state = run(state, {}, 2, flatWorld({ heightAt: () => 0 }));
    expect(state.y).toBeCloseTo(EYE_HEIGHT, 1);
  });

  it("clamps pitch and integrates yaw", () => {
    const up = stepPlayer(start(), { ...IDLE, lookPitch: 10 }, 1 / 60, flatWorld());
    expect(up.pitch).toBe(MAX_PITCH);
    const down = stepPlayer(start(), { ...IDLE, lookPitch: -10 }, 1 / 60, flatWorld());
    expect(down.pitch).toBe(-MAX_PITCH);
    const turned = stepPlayer(start({ yaw: 1 }), { ...IDLE, lookYaw: 0.5 }, 1 / 60, flatWorld());
    expect(turned.yaw).toBeCloseTo(1.5, 10);
  });

  it("clamps huge dt (tab-switch spikes)", () => {
    const end = stepPlayer(start({ vz: -WALK_SPEED }), { ...IDLE, moveZ: 1 }, 5, flatWorld());
    expect(-end.z).toBeLessThanOrEqual(WALK_SPEED * 0.05 + 1e-9);
  });
});

describe("stepPlayer walls", () => {
  // A 6 x 4.5 m box rotated a quarter turn, like the homestead.
  const box = { x: 0, z: -10, yaw: Math.PI / 2, halfW: 3, halfD: 2.25 };
  const world = flatWorld({ boxes: [box] });

  function insideBox(state: PlayerState): boolean {
    const cos = Math.cos(box.yaw);
    const sin = Math.sin(box.yaw);
    const dx = state.x - box.x;
    const dz = state.z - box.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    return Math.abs(lx) < box.halfW + PLAYER_RADIUS && Math.abs(lz) < box.halfD + PLAYER_RADIUS;
  }

  it("never lets the player through any face, including the middle of an end wall", () => {
    for (let k = 0; k < 16; k++) {
      const angle = (k / 16) * Math.PI * 2;
      const from = start({
        x: box.x + Math.sin(angle) * 9,
        z: box.z + Math.cos(angle) * 9,
        yaw: angle,
      });
      // yaw = angle looks back toward the box centre from that side.
      const end = run(from, { moveZ: 1, sprint: true }, 6, world);
      expect(insideBox(end)).toBe(false);
    }
  });

  it("slides along a wall instead of sticking", () => {
    const from = start({ x: 1.5, z: 0, yaw: 0.35 });
    const end = run(from, { moveZ: 1 }, 5, world);
    expect(insideBox(end)).toBe(false);
    expect(Math.abs(end.x - from.x)).toBeGreaterThan(1);
  });
});
