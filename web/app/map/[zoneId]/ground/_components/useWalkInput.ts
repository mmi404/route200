"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type RefObject } from "react";

/**
 * The mutable input the frame loop reads (PlayerController). Written by DOM
 * event handlers, never React state, so nothing re-renders per frame.
 * `lookYaw` / `lookPitch` are accumulated radians since the last frame; the
 * consumer reads them and zeroes them.
 *
 * TOUCH SEAM: a touch joystick / look pad should write into this same
 * object (moveX/moveZ in -1..1, lookYaw/lookPitch as accumulated radians,
 * sprint). Keyboard handling below overwrites moveX/moveZ whenever a key
 * changes, so a touch layer that coexists with the keyboard should keep its
 * own values and merge them where marked "MERGE POINT" in the hook.
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
};

const LOOK_SENSITIVITY = 0.0022;
/** Pixels of drag before a mouse press counts as a look-drag, not a click. */
const DRAG_THRESHOLD = 4;
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
  if (tag === "TEXTAREA" || tag === "SELECT" || tag === "BUTTON") return true;
  if (tag === "INPUT") {
    // The time slider keeps its native arrow-key stepping, but a focused
    // slider (left focused after a drag) must not swallow WASD / Q / E.
    return (target as HTMLInputElement).type === "range" ? ARROWS.has(code) : true;
  }
  return false;
}

/**
 * Keyboard + mouse look for the walkable scene.
 *
 * Attach `hostRef` (callback ref) to the element that contains the canvas.
 * Click it to request pointer lock (raw mouse looks, Esc releases). When
 * the pointer is not locked, holding the left button and dragging also
 * looks, so browsers that refuse pointer lock (and automated tests) work.
 */
export function useWalkInput({ onStepTime }: UseWalkInputOptions): {
  hostRef: (element: HTMLElement | null) => void;
  inputRef: RefObject<WalkInput>;
  locked: boolean;
  /** True once the visitor has moved, looked or locked the pointer. */
  interacted: boolean;
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

  const [host, setHost] = useState<HTMLElement | null>(null);
  const [interacted, setInteracted] = useState(false);
  const locked = useSyncExternalStore(subscribeLock, getLocked, getLockedOnServer);

  useEffect(() => {
    if (!host) return;
    const input = inputRef.current;
    const held = new Set<string>();
    let didInteract = false;
    const markInteracted = () => {
      if (didInteract) return;
      didInteract = true;
      setInteracted(true);
    };

    const syncMove = () => {
      const any = (codes: string[]) => codes.some((code) => held.has(code));
      // MERGE POINT: combine keyboard axes with any touch joystick values here.
      input.moveZ = (any(FORWARD) ? 1 : 0) - (any(BACK) ? 1 : 0);
      input.moveX = (any(RIGHT) ? 1 : 0) - (any(LEFT) ? 1 : 0);
      input.sprint = any(SPRINT);
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

    const releaseAll = () => {
      held.clear();
      syncMove();
      repeatingCode = null;
      stopRepeat();
      dragging = false;
    };

    // Mouse look. `dragging` is the unlocked left-button drag mode.
    let dragging = false;
    let dragMoved = 0;
    let lastX = 0;
    let lastY = 0;

    const addLook = (dx: number, dy: number) => {
      // Mouse right turns right (yaw decreases), mouse down looks down.
      input.lookYaw -= dx * LOOK_SENSITIVITY;
      input.lookPitch -= dy * LOOK_SENSITIVITY;
    };

    const onMouseDown = (event: MouseEvent) => {
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
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    document.addEventListener("pointerlockchange", onLockChange);
    host.addEventListener("mousedown", onMouseDown);
    host.addEventListener("click", onClick);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("pointerlockchange", onLockChange);
      host.removeEventListener("mousedown", onMouseDown);
      host.removeEventListener("click", onClick);
      releaseAll();
      // Leaving the page (or losing the canvas) must hand the mouse back.
      if (document.pointerLockElement === host) document.exitPointerLock();
    };
  }, [host]);

  return { hostRef: setHost, inputRef, locked, interacted };
}
