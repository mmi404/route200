"use client";

import { Component, type ReactNode } from "react";

type GroundBoundaryProps = {
  /** Shown instead of the scene if it cannot start or crashes. */
  fallback: ReactNode;
  children: ReactNode;
};

type GroundBoundaryState = { failed: boolean };

/**
 * Catches what R3F rethrows from the Canvas: a failed WebGL context
 * (`new WebGLRenderer` throws when none can be created) or any error inside
 * the scene, so the visitor gets a calm message instead of a blank page.
 */
export class GroundBoundary extends Component<GroundBoundaryProps, GroundBoundaryState> {
  state: GroundBoundaryState = { failed: false };

  static getDerivedStateFromError(): GroundBoundaryState {
    return { failed: true };
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
