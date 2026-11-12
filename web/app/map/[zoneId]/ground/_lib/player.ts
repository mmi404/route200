/**
 * Pure first-person movement step for Ground View. Plain numbers only (no
 * React, no three.js) so it can be unit-tested and reused by any controller.
 *
 * Conventions match three.js: at yaw 0 the player looks down -Z; a positive
 * yaw turns left (counter-clockwise seen from above); positive pitch looks
 * up. 1 unit = 1 metre.
 */

export interface PlayerState {
  x: number;
  z: number;
  /** Eye (camera) height in world space. */
  y: number;
  yaw: number;
  pitch: number;
  vx: number;
  vz: number;
}

export interface PlayerInput {
  /** Strafe, -1 (left) .. 1 (right). */
  moveX: number;
  /** Forward, -1 (back) .. 1 (forward). */
  moveZ: number;
  /** Radians to add to yaw this step (already scaled by sensitivity). */
  lookYaw: number;
  /** Radians to add to pitch this step. */
  lookPitch: number;
  sprint: boolean;
}

export interface PlayerWorld {
  heightAt(x: number, z: number): number;
  walkRadius: number;
  /** Circles the player cannot enter (tree trunks, the house). */
  obstacles: ReadonlyArray<{ x: number; z: number; r: number }>;
  /** Oriented boxes the player cannot enter (building walls). `yaw` rotates
   *  the box about Y the way three.js does: local +X maps to
   *  (cos yaw, -sin yaw), local +Z to (sin yaw, cos yaw). */
  boxes?: ReadonlyArray<{ x: number; z: number; yaw: number; halfW: number; halfD: number }>;
  /** Skip acceleration smoothing and eye-height easing. */
  reducedMotion?: boolean;
}

export const WALK_SPEED = 4.2;
export const SPRINT_SPEED = 7.5;
export const EYE_HEIGHT = 1.7;
export const MIN_EYE_HEIGHT = 1.2;
export const PLAYER_RADIUS = 0.35;
/** Extra clearance kept from flat walls, so a wall never fills the whole view. */
export const WALL_STANDOFF = 0.35;
export const MAX_PITCH = 1.25;
export const MAX_DT = 0.05;
// 48 degrees: comfortably above the steepest grade anywhere inside the
// walkable disc of Teknaf's real Copernicus DEM terrain (measured max
// 43.4 degrees, mean 27.9 degrees), so every real hillside stays climbable
// (slower the steeper it gets), while a genuinely vertical face (a wall, or
// the encircling synthetic ridge) still exceeds it and stays blocked. The
// original 38 degrees was tuned only against the synthetic hand-built
// hill, which never needed anyone to climb real, measured terrain.
export const MAX_CLIMB_ANGLE = (48 * Math.PI) / 180;
/** Exponential damping rates, 1/s. Higher is snappier. */
const ACCEL_RATE = 10;
const BRAKE_RATE = 13;
const EYE_RATE = 12;
/** Boundary: damping starts this far inside walkRadius, hard clamp this far outside. */
const EDGE_SOFT = 5;
const EDGE_HARD = 3;

function smooth01(value: number, edge0: number, edge1: number): number {
  const t = Math.max(0, Math.min(1, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

export function stepPlayer(
  state: PlayerState,
  input: PlayerInput,
  dtRaw: number,
  world: PlayerWorld,
): PlayerState {
  const dt = Math.min(Math.max(dtRaw, 0), MAX_DT);
  const instant = world.reducedMotion === true;

  const yaw = state.yaw + input.lookYaw;
  const pitch = Math.max(-MAX_PITCH, Math.min(MAX_PITCH, state.pitch + input.lookPitch));

  // Desired velocity in world space. forward = (-sin yaw, -cos yaw),
  // right = (cos yaw, -sin yaw).
  let mx = input.moveX;
  let mz = input.moveZ;
  const mLen = Math.hypot(mx, mz);
  if (mLen > 1) {
    mx /= mLen;
    mz /= mLen;
  }
  const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  let tx = (cos * mx - sin * mz) * speed;
  let tz = (-sin * mx - cos * mz) * speed;

  // Slope: uphill motion slows with steepness and is removed entirely past
  // MAX_CLIMB_ANGLE, leaving the sideways part so the player slides along a
  // steep face instead of sticking. Downhill is never boosted.
  let uphillX = 0;
  let uphillZ = 0;
  let allowedFactor = 1;
  {
    const e = 0.6;
    const gx = (world.heightAt(state.x + e, state.z) - world.heightAt(state.x - e, state.z)) / (2 * e);
    const gz = (world.heightAt(state.x, state.z + e) - world.heightAt(state.x, state.z - e)) / (2 * e);
    const gLen = Math.hypot(gx, gz);
    if (gLen > 1e-6) {
      uphillX = gx / gLen;
      uphillZ = gz / gLen;
      const angle = Math.atan(gLen);
      allowedFactor = angle >= MAX_CLIMB_ANGLE ? 0 : 1 - Math.pow(angle / MAX_CLIMB_ANGLE, 1.5);
      const uphill = tx * uphillX + tz * uphillZ;
      if (uphill > 0) {
        tx -= uphillX * uphill * (1 - allowedFactor);
        tz -= uphillZ * uphill * (1 - allowedFactor);
      }
    }
  }

  // Smooth acceleration / braking.
  let vx: number;
  let vz: number;
  if (instant) {
    vx = tx;
    vz = tz;
  } else {
    const wantsMove = tx !== 0 || tz !== 0;
    const k = 1 - Math.exp(-(wantsMove ? ACCEL_RATE : BRAKE_RATE) * dt);
    vx = state.vx + (tx - state.vx) * k;
    vz = state.vz + (tz - state.vz) * k;
  }

  // Momentum must not carry the player up a face the target velocity already
  // refuses: cap the smoothed velocity's uphill part to what is allowed.
  if (allowedFactor < 1) {
    const uphillSpeed = vx * uphillX + vz * uphillZ;
    const cap = speed * allowedFactor;
    if (uphillSpeed > cap) {
      vx -= uphillX * (uphillSpeed - cap);
      vz -= uphillZ * (uphillSpeed - cap);
    }
  }

  // Boundary: damp outward radial velocity near the edge of the walkable disc.
  const r0 = Math.hypot(state.x, state.z);
  if (r0 > world.walkRadius - EDGE_SOFT && r0 > 1e-6) {
    const nx = state.x / r0;
    const nz = state.z / r0;
    const out = vx * nx + vz * nz;
    if (out > 0) {
      const keep = 1 - smooth01(r0, world.walkRadius - EDGE_SOFT, world.walkRadius + EDGE_HARD);
      vx -= nx * out * (1 - keep);
      vz -= nz * out * (1 - keep);
    }
  }

  let x = state.x + vx * dt;
  let z = state.z + vz * dt;

  // Obstacles: push out of each circle and drop the velocity into it.
  for (const o of world.obstacles) {
    const dx = x - o.x;
    const dz = z - o.z;
    const minDist = o.r + PLAYER_RADIUS;
    const d2 = dx * dx + dz * dz;
    if (d2 >= minDist * minDist) continue;
    const d = Math.sqrt(d2);
    // Exactly on the centre: push along the direction of travel, else +x.
    const nx = d > 1e-6 ? dx / d : vx !== 0 || vz !== 0 ? -vx / Math.hypot(vx, vz) : 1;
    const nz = d > 1e-6 ? dz / d : vx !== 0 || vz !== 0 ? -vz / Math.hypot(vx, vz) : 0;
    x = o.x + nx * minDist;
    z = o.z + nz * minDist;
    const into = vx * nx + vz * nz;
    if (into < 0) {
      vx -= nx * into;
      vz -= nz * into;
    }
  }

  // Walls: push out of each oriented box along its nearest face and drop
  // the velocity into that face, so the player slides along the wall.
  for (const b of world.boxes ?? []) {
    const cos = Math.cos(b.yaw);
    const sin = Math.sin(b.yaw);
    const dx = x - b.x;
    const dz = z - b.z;
    const lx = dx * cos - dz * sin;
    const lz = dx * sin + dz * cos;
    const hw = b.halfW + PLAYER_RADIUS + WALL_STANDOFF;
    const hd = b.halfD + PLAYER_RADIUS + WALL_STANDOFF;
    if (Math.abs(lx) >= hw || Math.abs(lz) >= hd) continue;
    const penX = hw - Math.abs(lx);
    const penZ = hd - Math.abs(lz);
    let nlx = 0;
    let nlz = 0;
    if (penX < penZ) nlx = lx >= 0 ? 1 : -1;
    else nlz = lz >= 0 ? 1 : -1;
    const outLx = nlx !== 0 ? nlx * hw : lx;
    const outLz = nlz !== 0 ? nlz * hd : lz;
    x = b.x + outLx * cos + outLz * sin;
    z = b.z - outLx * sin + outLz * cos;
    const nx = nlx * cos + nlz * sin;
    const nz = -nlx * sin + nlz * cos;
    const into = vx * nx + vz * nz;
    if (into < 0) {
      vx -= nx * into;
      vz -= nz * into;
    }
  }

  // Last-resort safety clamp.
  const r = Math.hypot(x, z);
  const hardR = world.walkRadius + EDGE_HARD;
  if (r > hardR) {
    x = (x / r) * hardR;
    z = (z / r) * hardR;
  }

  // Eye height: eased toward ground + EYE_HEIGHT, never below ground + MIN.
  const ground = world.heightAt(x, z);
  const target = ground + EYE_HEIGHT;
  let y = instant ? target : state.y + (target - state.y) * (1 - Math.exp(-EYE_RATE * dt));
  y = Math.max(y, ground + MIN_EYE_HEIGHT);

  return { x, z, y, yaw, pitch, vx, vz };
}
