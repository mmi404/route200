"use client";

import { useEffect, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import type { ChangeEvent, ZoneFeature } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
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
  locale: Locale;
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
  onSelectZoneAction: (id: string, viaKeyboard?: boolean) => void;
  selectedZone: ZoneFeature | null;
  selectedStatus: ZoneStatus | null;
  selectedHistory: ChangeEvent[];
  /** See ZoneRail's prop of the same name: moves focus into the inspect
   *  panel when the current selection came from the keyboard. */
  selectedZoneAutoFocus?: boolean;
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
  locale,
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
  selectedZoneAutoFocus = false,
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

  /** Advances to the next snap point in peek -> half -> full -> peek order,
   *  the same cycle a tap-without-drag on the handle already uses, now
   *  shared with the keyboard handler below so there is one place that
   *  knows the cycle order. */
  function cycleSnap() {
    const order: SheetSnap[] = ["peek", "half", "full"];
    onSnapChangeAction(order[(order.indexOf(snap) + 1) % order.length]);
  }

  function handlePointerUp() {
    if (movedRef.current && dragHeightPx !== null) {
      onSnapChangeAction(nearestSnap(dragHeightPx, viewportHeight));
    } else if (!movedRef.current) {
      cycleSnap();
    }
    dragStartRef.current = null;
    setDragHeightPx(null);
  }

  /** Enter/Space cycles the snap point the same way a tap on the handle
   *  does, since the handle is only reachable by drag or pointer tap
   *  otherwise, which a keyboard user can't perform. */
  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Enter" && event.key !== " " && event.key !== "Spacebar") {
      return;
    }
    event.preventDefault();
    cycleSnap();
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
        onKeyDown={handleKeyDown}
        // py-4 (16px top and bottom) takes the handle's tap target from
        // about 24px to about 37px, roughly half again as tall, without
        // overflowing the sheet's fixed 88px "peek" height once the
        // summary row below it is accounted for (a bigger step, py-6,
        // pushes the combined content past 88px and clips the summary
        // text). The visible drag dot stays the same 4px (h-1) thickness;
        // only the padding around it grew.
        className="flex shrink-0 cursor-grab items-center justify-center border-b border-rule py-4 touch-none active:cursor-grabbing focus-visible:outline-offset-[-2px]"
        role="button"
        tabIndex={0}
        aria-label={t(translations.mapPage.resizeZonePanel, locale)}
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
              locale={locale}
              zone={selectedZone}
              status={selectedStatus}
              history={selectedHistory}
              autoFocusBack={selectedZoneAutoFocus}
              onBack={onBackAction}
            />
          ) : (
            <ZoneListPanel
              locale={locale}
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
