import { describe, expect, it } from "vitest";
import {
  JOYSTICK_DEAD_ZONE,
  JOYSTICK_RADIUS,
  clampJoystickOrigin,
  inJoystickZone,
  joystickOutput,
  mergeMove,
} from "./touchInput";

describe("joystickOutput", () => {
  it("is exactly idle at the centre and inside the dead zone", () => {
    expect(joystickOutput(0, 0)).toEqual({ moveX: 0, moveZ: 0, sprint: false, knobX: 0, knobY: 0 });
    const inside = JOYSTICK_RADIUS * JOYSTICK_DEAD_ZONE * 0.9;
    const out = joystickOutput(inside, 0);
    expect(out.moveX).toBe(0);
    expect(out.moveZ).toBe(0);
    expect(out.knobX).toBeCloseTo(inside);
  });

  it("walks forward when pushed up the screen", () => {
    const out = joystickOutput(0, -JOYSTICK_RADIUS * 0.6);
    expect(out.moveZ).toBeGreaterThan(0.4);
    expect(out.moveX).toBeCloseTo(0);
    expect(out.sprint).toBe(false);
  });

  it("walks back when pushed down and strafes with x", () => {
    expect(joystickOutput(0, JOYSTICK_RADIUS * 0.6).moveZ).toBeLessThan(-0.4);
    expect(joystickOutput(JOYSTICK_RADIUS * 0.6, 0).moveX).toBeGreaterThan(0.4);
    expect(joystickOutput(-JOYSTICK_RADIUS * 0.6, 0).moveX).toBeLessThan(-0.4);
  });

  it("grows continuously from zero at the dead-zone edge to one at the rim", () => {
    const edge = joystickOutput(JOYSTICK_RADIUS * JOYSTICK_DEAD_ZONE + 0.001, 0).moveX;
    expect(edge).toBeGreaterThanOrEqual(0);
    expect(edge).toBeLessThan(0.01);
    expect(joystickOutput(JOYSTICK_RADIUS, 0).moveX).toBeCloseTo(1);
  });

  it("clamps magnitude and knob to the rim when dragged far past it", () => {
    const out = joystickOutput(300, -400);
    expect(Math.hypot(out.moveX, out.moveZ)).toBeCloseTo(1);
    expect(Math.hypot(out.knobX, out.knobY)).toBeCloseTo(JOYSTICK_RADIUS);
    expect(out.moveX).toBeGreaterThan(0);
    expect(out.moveZ).toBeGreaterThan(0);
  });

  it("sprints only past 90% of the radius", () => {
    expect(joystickOutput(0, -JOYSTICK_RADIUS * 0.85).sprint).toBe(false);
    expect(joystickOutput(0, -JOYSTICK_RADIUS * 0.9).sprint).toBe(true);
    expect(joystickOutput(0, -JOYSTICK_RADIUS * 2).sprint).toBe(true);
  });

  it("handles a degenerate radius without NaN", () => {
    expect(joystickOutput(10, 10, 0).moveX).toBe(0);
  });
});

describe("mergeMove", () => {
  const idle = { moveX: 0, moveZ: 0, sprint: false };

  it("passes either source through when the other is idle", () => {
    const touch = { moveX: 0.5, moveZ: 0.25, sprint: false };
    expect(mergeMove(idle, touch)).toEqual(touch);
    expect(mergeMove(touch, idle)).toEqual(touch);
  });

  it("adds and clamps, and lets opposite inputs cancel", () => {
    const merged = mergeMove({ moveX: 0, moveZ: 1, sprint: false }, { moveX: 0, moveZ: 0.8, sprint: false });
    expect(merged.moveZ).toBe(1);
    const cancel = mergeMove({ moveX: -1, moveZ: 0, sprint: false }, { moveX: 1, moveZ: 0, sprint: false });
    expect(cancel.moveX).toBe(0);
  });

  it("sprints if either source sprints", () => {
    expect(mergeMove({ ...idle, sprint: true }, idle).sprint).toBe(true);
    expect(mergeMove(idle, { ...idle, sprint: true }).sprint).toBe(true);
    expect(mergeMove(idle, idle).sprint).toBe(false);
  });
});

describe("inJoystickZone", () => {
  it("is the lower-left of the scene", () => {
    expect(inJoystickZone(100, 600, 390, 724)).toBe(true);
    expect(inJoystickZone(300, 600, 390, 724)).toBe(false);
    expect(inJoystickZone(100, 100, 390, 724)).toBe(false);
  });
});

describe("clampJoystickOrigin", () => {
  const bounds = { left: 8, top: 8, right: 382, bottom: 500 };

  it("leaves a stick that already fits where it is", () => {
    expect(clampJoystickOrigin(150, 300, bounds)).toEqual({ x: 150, y: 300 });
  });

  it("keeps the whole ring inside the bounds", () => {
    const pushed = clampJoystickOrigin(10, 520, bounds);
    expect(pushed.x).toBe(8 + JOYSTICK_RADIUS);
    expect(pushed.y).toBe(500 - JOYSTICK_RADIUS);
  });

  it("centres on an axis that is too small", () => {
    const tiny = clampJoystickOrigin(0, 0, { left: 0, top: 0, right: 40, bottom: 40 });
    expect(tiny).toEqual({ x: 20, y: 20 });
  });
});
