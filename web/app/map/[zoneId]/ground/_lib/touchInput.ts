/**
 * Pure maths for the touch controls of Ground View: the floating joystick,
 * where it may start, and how touch axes combine with keyboard axes. Plain
 * numbers only (no DOM, no React) so it can be unit-tested.
 */

/** Joystick travel from its centre to its rim, in CSS pixels. */
export const JOYSTICK_RADIUS = 56;
/** Fraction of the radius inside which the stick reads as centred. */
export const JOYSTICK_DEAD_ZONE = 0.12;
/** Fraction of the radius past which the stick also sprints. */
export const JOYSTICK_SPRINT_AT = 0.9;
/** Radians of look per pixel of one-finger drag. */
export const TOUCH_LOOK_SENSITIVITY = 0.005;

export interface MoveAxes {
  /** Strafe, -1 (left) .. 1 (right). */
  moveX: number;
  /** Forward, -1 (back) .. 1 (forward). */
  moveZ: number;
  sprint: boolean;
}

export interface JoystickOutput extends MoveAxes {
  /** Knob offset from the stick's centre in pixels, clamped to the radius. */
  knobX: number;
  knobY: number;
}

const IDLE: JoystickOutput = { moveX: 0, moveZ: 0, sprint: false, knobX: 0, knobY: 0 };

/**
 * Turns a finger offset from where the stick was pressed (screen pixels,
 * +x right, +y down) into walk axes. Screen up is forward. Inside the dead
 * zone the output is exactly zero; outside it the magnitude is rescaled so
 * it grows smoothly from 0 at the dead-zone edge to 1 at the rim, keeping
 * the direction of the finger. The knob is clamped to the rim.
 */
export function joystickOutput(
  dx: number,
  dy: number,
  radius: number = JOYSTICK_RADIUS,
  deadZone: number = JOYSTICK_DEAD_ZONE,
  sprintAt: number = JOYSTICK_SPRINT_AT,
): JoystickOutput {
  if (!(radius > 0)) return { ...IDLE };
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return { ...IDLE };
  const ux = dx / dist;
  const uy = dy / dist;
  const ratio = dist / radius;
  const knob = Math.min(dist, radius);
  const knobX = ux * knob;
  const knobY = uy * knob;
  if (ratio <= deadZone) return { moveX: 0, moveZ: 0, sprint: false, knobX, knobY };
  const magnitude = Math.min(1, (ratio - deadZone) / (1 - deadZone));
  return {
    moveX: ux * magnitude,
    // Screen up (negative y) walks forward.
    moveZ: -uy * magnitude,
    sprint: ratio >= sprintAt,
    knobX,
    knobY,
  };
}

function clampAxis(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

/** Keyboard and touch both drive movement: axes add (then clamp to -1..1),
 *  so opposite inputs cancel and neither overwrites the other. */
export function mergeMove(a: MoveAxes, b: MoveAxes): MoveAxes {
  return {
    moveX: clampAxis(a.moveX + b.moveX),
    moveZ: clampAxis(a.moveZ + b.moveZ),
    sprint: a.sprint || b.sprint,
  };
}

/** A touch that starts in the lower-left of the scene is the walk stick;
 *  anywhere else it looks around. Coordinates are relative to the scene. */
export function inJoystickZone(x: number, y: number, width: number, height: number): boolean {
  return x < width * 0.5 && y > height * 0.35;
}

export interface Bounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Keeps a stick of the given radius wholly inside `bounds`. If the bounds
 *  are too small on an axis the stick is centred on it. */
export function clampJoystickOrigin(
  x: number,
  y: number,
  bounds: Bounds,
  radius: number = JOYSTICK_RADIUS,
): { x: number; y: number } {
  const clamp = (value: number, lo: number, hi: number) =>
    hi < lo ? (lo + hi) / 2 : Math.max(lo, Math.min(hi, value));
  return {
    x: clamp(x, bounds.left + radius, bounds.right - radius),
    y: clamp(y, bounds.top + radius, bounds.bottom - radius),
  };
}
