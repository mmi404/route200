"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";
import {
  JOYSTICK_RADIUS,
  TOUCH_LOOK_SENSITIVITY,
  clampJoystickOrigin,
  inJoystickZone,
  joystickOutput,
  mergeMove,
  type MoveAxes,
} from "../_lib/touchInput";

/**
 * The mutable input the frame loop reads (PlayerController). Written by DOM
 * event handlers, never React state, so nothing re-renders per frame.
 * `lookYaw` / `lookPitch` are accumulated radians since the last frame; the
 * consumer reads them and zeroes them.
 *
 * Keyboard and touch each keep their own movement axes and are merged
 * (mergeMove) into this object whenever either changes, so neither one
 * overwrites the other.
 */
export interface WalkInput {
  moveX: number;
  moveZ: number;
  lookYaw: number;
  lookPitch: number;
  sprint: boolean;
}

export type StepTimeDirection = -1 | 1;

type UseWalkInputOptions = {
  /** Called to step the time slider; repeats while the key is held. */
  onStepTime: (direction: StepTimeDirection) => void;
  /** An overlay (the bottom card) the joystick ring must stay clear of. */
  avoidRef?: RefObject<HTMLElement | null>;
};

/** Elements the hook drives directly (transforms are written per move event,
 *  never through React state). Attach each to the matching DOM node. */
export interface JoystickRefs {
  /** Full-size layer; its padding carries the safe-area insets. */
  layerRef: RefObject<HTMLDivElement | null>;
  /** The ring, moved to wherever the thumb lands. */
  baseRef: RefObject<HTMLDivElement | null>;
  /** The knob, offset from the ring's centre. */
  knobRef: RefObject<HTMLDivElement | null>;
}

const LOOK_SENSITIVITY = 0.0022;
/** Pixels of drag before a mouse press counts as a look-drag, not a click. */
const DRAG_THRESHOLD = 4;
/** Pixels a look finger must travel before it counts as interaction. */
const TOUCH_LOOK_THRESHOLD = 6;
/** Gap kept between the joystick ring and the screen edge or the card. */
const JOYSTICK_MARGIN = 8;
const STEP_REPEAT_DELAY_MS = 350;
const STEP_REPEAT_INTERVAL_MS = 90;

const FORWARD = ["KeyW", "ArrowUp"];
const BACK = ["KeyS", "ArrowDown"];
const LEFT = ["KeyA", "ArrowLeft"];
const RIGHT = ["KeyD", "ArrowRight"];
const SPRINT = ["ShiftLeft", "ShiftRight"];
const TIME_BACK = ["KeyQ", "BracketLeft"];
const TIME_FORWARD = ["KeyE", "BracketRight"];
const ARROWS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

function subscribeLock(callback: () => void): () => void {
  document.addEventListener("pointerlockchange", callback);
  return () => document.removeEventListener("pointerlockchange", callback);
}
const getLocked = () => document.pointerLockElement !== null;
const getLockedOnServer = () => false;

/** True when key presses belong to the focused element, not the scene. */
function keyBelongsToFocusedControl(target: EventTarget | null, code: string): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  const tag = target.tagName;
  // Buttons are deliberately not listed: none of the keys the scene uses
  // (WASD, arrows, Q / E, brackets, Shift) does anything on a button, and a
  // button left focused by a click must not freeze walking.
  if (tag === "TEXTAREA" || tag === "SELECT") return true;
  if (tag === "INPUT") {
    // The time slider keeps its native arrow-key stepping, but a focused
    // slider (left focused after a drag) must not swallow WASD / Q / E.
    return (target as HTMLInputElement).type === "range" ? ARROWS.has(code) : true;
  }
  return false;
}

/**
 * Keyboard, mouse and touch input for the walkable scene.
 *
 * Attach `hostRef` (callback ref) to the element that contains the canvas.
 * Mouse: click it to request pointer lock (raw mouse looks, Esc releases);
 * when the pointer is not locked, holding the left button and dragging also
 * looks, so browsers that refuse pointer lock (and automated tests) work.
 * Touch: a finger that lands in the lower-left starts a floating joystick
 * (drawn by the `joystick` refs), any other finger drags to look, and the
 * two work at once. Touch never requests pointer lock.
 */
export function useWalkInput({ onStepTime, avoidRef }: UseWalkInputOptions): {
  hostRef: (element: HTMLElement | null) => void;
  inputRef: RefObject<WalkInput>;
  joystick: JoystickRefs;
  locked: boolean;
  /** True once the visitor has moved, looked or locked the pointer. */
  interacted: boolean;
  /** True once a real touch has landed on the scene. */
  touchSeen: boolean;
} {
  const inputRef = useRef<WalkInput>({
    moveX: 0,
    moveZ: 0,
    lookYaw: 0,
    lookPitch: 0,
    sprint: false,
  });
  const stepRef = useRef(onStepTime);
  useEffect(() => {
    stepRef.current = onStepTime;
  });

  const layerRef = useRef<HTMLDivElement | null>(null);
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);

  const [host, setHost] = useState<HTMLElement | null>(null);
  const [interacted, setInteracted] = useState(false);
  const [touchSeen, setTouchSeen] = useState(false);
  const locked = useSyncExternalStore(subscribeLock, getLocked, getLockedOnServer);

  useEffect(() => {
    if (!host) return;
    const input = inputRef.current;
    const held = new Set<string>();
    let didInteract = false;
    let didTouch = false;
    const markInteracted = () => {
      if (didInteract) return;
      didInteract = true;
      setInteracted(true);
    };

    // The touch stick's own axes; merged with the keyboard's in syncMove.
    let touchMove: MoveAxes = { moveX: 0, moveZ: 0, sprint: false };

    const syncMove = () => {
      const any = (codes: string[]) => codes.some((code) => held.has(code));
      const keyboard: MoveAxes = {
        moveZ: (any(FORWARD) ? 1 : 0) - (any(BACK) ? 1 : 0),
        moveX: (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0),
        sprint: any(SPRINT),
      };
      const merged = mergeMove(keyboard, touchMove);
      input.moveX = merged.moveX;
      input.moveZ = merged.moveZ;
      input.sprint = merged.sprint;
    };

    let repeatDelay: ReturnType<typeof setTimeout> | undefined;
    let repeatTimer: ReturnType<typeof setInterval> | undefined;
    const stopRepeat = () => {
      clearTimeout(repeatDelay);
      clearInterval(repeatTimer);
      repeatDelay = undefined;
      repeatTimer = undefined;
    };
    const startRepeat = (direction: StepTimeDirection) => {
      stopRepeat();
      stepRef.current(direction);
      repeatDelay = setTimeout(() => {
        repeatTimer = setInterval(() => stepRef.current(direction), STEP_REPEAT_INTERVAL_MS);
      }, STEP_REPEAT_DELAY_MS);
    };

    let repeatingCode: string | null = null;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (keyBelongsToFocusedControl(event.target, event.code)) return;
      const code = event.code;
      if (TIME_BACK.includes(code) || TIME_FORWARD.includes(code)) {
        event.preventDefault();
        if (event.repeat || repeatingCode === code) return;
        repeatingCode = code;
        startRepeat(TIME_BACK.includes(code) ? -1 : 1);
        return;
      }
      if (
        FORWARD.includes(code) ||
        BACK.includes(code) ||
        LEFT.includes(code) ||
        RIGHT.includes(code) ||
        SPRINT.includes(code)
      ) {
        if (ARROWS.has(code)) event.preventDefault();
        held.add(code);
        syncMove();
        if (!SPRINT.includes(code)) markInteracted();
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      held.delete(event.code);
      syncMove();
      if (event.code === repeatingCode) {
        repeatingCode = null;
        stopRepeat();
      }
    };

    // ---- Touch: a floating joystick (lower-left) and one-finger look. ----
    // Tracked by pointer id so both can be down at once. Pointer capture
    // keeps each finger's events coming to the host wherever it travels.
    let joyId: number | null = null;
    let joyStartX = 0;
    let joyStartY = 0;
    let lookId: number | null = null;
    let lookX = 0;
    let lookY = 0;
    let lookTravel = 0;
    let lastPointerType = "mouse";

    const showJoystick = (visible: boolean) => {
      const base = baseRef.current;
      if (base) base.style.opacity = visible ? "1" : "0";
    };
    const moveKnob = (x: number, y: number) => {
      const knob = knobRef.current;
      if (knob) knob.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };
    const placeJoystick = (x: number, y: number) => {
      const base = baseRef.current;
      if (base) base.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    };

    const endJoystick = () => {
      joyId = null;
      touchMove = { moveX: 0, moveZ: 0, sprint: false };
      syncMove();
      moveKnob(0, 0);
      showJoystick(false);
    };

    const releaseTouches = () => {
      if (joyId !== null) endJoystick();
      lookId = null;
    };

    // Mouse look. `dragging` is the unlocked left-button drag mode.
    let dragging = false;
    let dragMoved = 0;
    let lastX = 0;
    let lastY = 0;

    const releaseAll = () => {
      held.clear();
      repeatingCode = null;
      stopRepeat();
      dragging = false;
      releaseTouches();
      syncMove();
    };

    /** Where the ring may sit: inside the safe area, clear of the card. */
    const joystickBounds = (rect: DOMRect) => {
      const pad = layerRef.current ? getComputedStyle(layerRef.current) : null;
      const inset = (value: string | undefined) => Number.parseFloat(value ?? "") || 0;
      const avoid = avoidRef?.current?.getBoundingClientRect();
      const bottomLimit = avoid ? Math.min(rect.height, avoid.top - rect.top) : rect.height;
      return {
        left: inset(pad?.paddingLeft) + JOYSTICK_MARGIN,
        top: inset(pad?.paddingTop) + JOYSTICK_MARGIN,
        right: rect.width - inset(pad?.paddingRight) - JOYSTICK_MARGIN,
        bottom: Math.min(rect.height - inset(pad?.paddingBottom), bottomLimit) - JOYSTICK_MARGIN,
      };
    };

    const onPointerDown = (event: PointerEvent) => {
      lastPointerType = event.pointerType;
      if (event.pointerType !== "touch") return;
      if (!didTouch) {
        didTouch = true;
        setTouchSeen(true);
      }
      // Stops the compatibility mouse events (and so a pointer-lock request)
      // that browsers synthesise after a tap.
      event.preventDefault();
      const rect = host.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      if (joyId === null && inJoystickZone(x, y, rect.width, rect.height)) {
        joyId = event.pointerId;
        joyStartX = x;
        joyStartY = y;
        const origin = clampJoystickOrigin(x, y, joystickBounds(rect));
        placeJoystick(origin.x, origin.y);
        moveKnob(0, 0);
        showJoystick(true);
      } else if (lookId === null) {
        lookId = event.pointerId;
        lookX = event.clientX;
        lookY = event.clientY;
        lookTravel = 0;
      } else {
        return;
      }
      try {
        host.setPointerCapture(event.pointerId);
      } catch {
        // Capture is best effort; pointerup / cancel still end the touch.
      }
    };

    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerType !== "touch") return;
      if (event.pointerId === joyId) {
        const rect = host.getBoundingClientRect();
        // Offset from where the finger first landed (not from the ring's
        // clamped centre), so a ring nudged clear of the card starts idle.
        const out = joystickOutput(
          event.clientX - rect.left - joyStartX,
          event.clientY - rect.top - joyStartY,
          JOYSTICK_RADIUS,
        );
        touchMove = { moveX: out.moveX, moveZ: out.moveZ, sprint: out.sprint };
        syncMove();
        moveKnob(out.knobX, out.knobY);
        if (out.moveX !== 0 || out.moveZ !== 0) markInteracted();
      } else if (event.pointerId === lookId) {
        const dx = event.clientX - lookX;
        const dy = event.clientY - lookY;
        lookX = event.clientX;
        lookY = event.clientY;
        lookTravel += Math.abs(dx) + Math.abs(dy);
        input.lookYaw -= dx * TOUCH_LOOK_SENSITIVITY;
        input.lookPitch -= dy * TOUCH_LOOK_SENSITIVITY;
        if (lookTravel > TOUCH_LOOK_THRESHOLD) markInteracted();
      }
    };

    const onPointerEnd = (event: PointerEvent) => {
      if (event.pointerId === joyId) endJoystick();
      else if (event.pointerId === lookId) lookId = null;
    };

    const onVisibility = () => {
      if (document.hidden) releaseAll();
    };

    const onContextMenu = (event: Event) => {
      // A long press on the scene would otherwise open the browser's menu.
      if (lastPointerType === "touch") event.preventDefault();
    };

    const addLook = (dx: number, dy: number) => {
      // Mouse right turns right (yaw decreases), mouse down looks down.
      input.lookYaw -= dx * LOOK_SENSITIVITY;
      input.lookPitch -= dy * LOOK_SENSITIVITY;
    };

    const onMouseDown = (event: MouseEvent) => {
      if (lastPointerType === "touch") return;
      if (event.button !== 0 || document.pointerLockElement) return;
      dragging = true;
      dragMoved = 0;
      lastX = event.clientX;
      lastY = event.clientY;
    };

    const onMouseMove = (event: MouseEvent) => {
      if (document.pointerLockElement) {
        addLook(event.movementX, event.movementY);
        markInteracted();
        return;
      }
      if (!dragging) return;
      const dx = event.clientX - lastX;
      const dy = event.clientY - lastY;
      lastX = event.clientX;
      lastY = event.clientY;
      dragMoved += Math.abs(dx) + Math.abs(dy);
      addLook(dx, dy);
      markInteracted();
    };

    const onMouseUp = () => {
      dragging = false;
    };

    const onClick = () => {
      // Touch never requests pointer lock.
      if (lastPointerType === "touch") return;
      // A drag that ended on the canvas is a look, not a request to lock.
      if (dragMoved > DRAG_THRESHOLD || document.pointerLockElement) {
        dragMoved = 0;
        return;
      }
      try {
        const request = host.requestPointerLock() as Promise<void> | undefined;
        request?.catch?.(() => {});
      } catch {
        // Lock refused: drag-to-look still works.
      }
    };

    const onLockChange = () => {
      if (document.pointerLockElement) markInteracted();
      else dragging = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("pointerlockchange", onLockChange);
    host.addEventListener("mousedown", onMouseDown);
    host.addEventListener("click", onClick);
    host.addEventListener("pointerdown", onPointerDown);
    host.addEventListener("pointermove", onPointerMove);
    host.addEventListener("pointerup", onPointerEnd);
    host.addEventListener("pointercancel", onPointerEnd);
    host.addEventListener("lostpointercapture", onPointerEnd);
    host.addEventListener("contextmenu", onContextMenu);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerlockchange", onLockChange);
      host.removeEventListener("mousedown", onMouseDown);
      host.removeEventListener("click", onClick);
      host.removeEventListener("pointerdown", onPointerDown);
      host.removeEventListener("pointermove", onPointerMove);
      host.removeEventListener("pointerup", onPointerEnd);
      host.removeEventListener("pointercancel", onPointerEnd);
      host.removeEventListener("lostpointercapture", onPointerEnd);
      host.removeEventListener("contextmenu", onContextMenu);
      releaseAll();
      // Leaving the page (or losing the canvas) must hand the mouse back.
      if (document.pointerLockElement === host) document.exitPointerLock();
    };
  }, [host, avoidRef]);

  const joystick: JoystickRefs = { layerRef, baseRef, knobRef };
  return { hostRef: setHost, inputRef, joystick, locked, interacted, touchSeen };
}
