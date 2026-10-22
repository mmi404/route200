"use client";

import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { ChangeEvent, ZoneFeature } from "@/lib/types";
import type {
  DateWindow,
  KindFilter,
  ZoneListEntry,
  ZoneStatus,
} from "../_lib/severity";
import { InspectPanel } from "./InspectPanel";
import { ZoneListPanel } from "./ZoneListPanel";

export type SheetSnap = "peek" | "half" | "full";

const PEEK_HEIGHT = 88;

type SeverityCounts = Partial<Record<"low" | "moderate" | "high" | "severe", number>>;

type MobileSheetProps = {
  snap: SheetSnap;
  onSnapChangeAction: (snap: SheetSnap) => void;
  summary: string;
  kindFilter: KindFilter;
  onKindFilterChangeAction: (value: KindFilter) => void;
  dataRange: DateWindow;
  dateWindow: DateWindow;
  onDateWindowChangeAction: (window: DateWindow) => void;
  counts: SeverityCounts;
  entries: ZoneListEntry[];
  hoveredZoneId: string | null;
  onHoverZoneAction: (id: string | null) => void;
  onSelectZoneAction: (id: string) => void;
  selectedZone: ZoneFeature | null;
  selectedStatus: ZoneStatus | null;
  selectedHistory: ChangeEvent[];
  onBackAction: () => void;
  reducedMotion: boolean;
  className?: string;
};

function heightForSnap(snap: SheetSnap, viewportHeight: number): number {
  if (snap === "peek") return PEEK_HEIGHT;
  if (snap === "half") return Math.round(viewportHeight * 0.5);
  return Math.round(viewportHeight * 0.92);
}

function nearestSnap(heightPx: number, viewportHeight: number): SheetSnap {
  const candidates: [SheetSnap, number][] = [
    ["peek", heightForSnap("peek", viewportHeight)],
    ["half", heightForSnap("half", viewportHeight)],
    ["full", heightForSnap("full", viewportHeight)],
  ];
  return candidates.reduce((best, candidate) =>
    Math.abs(candidate[1] - heightPx) < Math.abs(best[1] - heightPx) ? candidate : best,
  )[0];
}

/**
 * Mobile (<1024px) bottom sheet: the rail's desktop content, reusing the
 * same list/inspect pieces, inside a sheet with peek/half/full snap points
 * (DESIGN_SPEC.md 7b). Drag the handle to resize; it snaps to the nearest
 * point on release. A tap on the handle cycles through the points for
 * anyone who can't drag.
 */
export function MobileSheet({
  snap,
  onSnapChangeAction,
  summary,
  kindFilter,
  onKindFilterChangeAction,
  dataRange,
  dateWindow,
  onDateWindowChangeAction,
  counts,
  entries,
  hoveredZoneId,
  onHoverZoneAction,
  onSelectZoneAction,
  selectedZone,
  selectedStatus,
  selectedHistory,
  onBackAction,
  reducedMotion,
  className = "",
}: MobileSheetProps) {
  // Tracks the viewport for the half/full snap heights, which are
  // fractions of it. A resize subscription, not a derived-state effect.
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 800 : window.innerHeight,
  );
  useEffect(() => {
    const onResize = () => setViewportHeight(window.innerHeight);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Only set while a drag is in progress; null means "use the snap point's
  // height", so there is nothing to keep in sync via an effect.
  const [dragHeightPx, setDragHeightPx] = useState<number | null>(null);
  const dragStartRef = useRef<{ y: number; height: number } | null>(null);
  const movedRef = useRef(false);

  const heightPx = dragHeightPx ?? heightForSnap(snap, viewportHeight);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    dragStartRef.current = { y: event.clientY, height: heightPx };
    movedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragStartRef.current) return;
    const delta = dragStartRef.current.y - event.clientY;
    if (Math.abs(delta) > 4) movedRef.current = true;
    const next = Math.min(
      viewportHeight * 0.92,
      Math.max(PEEK_HEIGHT, dragStartRef.current.height + delta),
    );
    setDragHeightPx(next);
  }

  function handlePointerUp() {
    if (movedRef.current && dragHeightPx !== null) {
      onSnapChangeAction(nearestSnap(dragHeightPx, viewportHeight));
    } else if (!movedRef.current) {
      const order: SheetSnap[] = ["peek", "half", "full"];
      onSnapChangeAction(order[(order.indexOf(snap) + 1) % order.length]);
    }
    dragStartRef.current = null;
    setDragHeightPx(null);
  }

  return (
    <div
      style={{ height: `${heightPx}px` }}
      className={`fixed inset-x-0 bottom-0 z-20 flex flex-col rounded-t-xs border-t border-rule bg-surface shadow-map lg:hidden ${
        dragHeightPx !== null || reducedMotion
          ? ""
          : "transition-[height] duration-(--duration-base) ease-editorial"
      } ${className}`}
    >
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="flex shrink-0 cursor-grab items-center justify-center border-b border-rule py-2.5 touch-none active:cursor-grabbing"
        role="button"
        tabIndex={0}
        aria-label="Resize the zone panel"
      >
        <span aria-hidden="true" className="h-1 w-10 rounded-full bg-rule" />
      </div>

      {snap === "peek" ? (
        <div className="flex items-center px-gutter py-3">
          <p className="type-small text-ink-muted">{summary}</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-gutter py-4">
          {selectedZone && selectedStatus ? (
            <InspectPanel
              zone={selectedZone}
              status={selectedStatus}
              history={selectedHistory}
              onBack={onBackAction}
            />
          ) : (
            <ZoneListPanel
              kindFilter={kindFilter}
              onKindFilterChangeAction={onKindFilterChangeAction}
              dataRange={dataRange}
              dateWindow={dateWindow}
              onDateWindowChangeAction={onDateWindowChangeAction}
              counts={counts}
              entries={entries}
              hoveredZoneId={hoveredZoneId}
              onHoverZoneAction={onHoverZoneAction}
              onSelectZoneAction={onSelectZoneAction}
            />
          )}
        </div>
      )}
    </div>
  );
}
