type FloatingControlsProps = {
  onZoomInAction: () => void;
  onZoomOutAction: () => void;
};

/**
 * Zoom controls floating over the map canvas, the only thing besides
 * MapLibre's own attribution control that gets shadow-map
 * (DESIGN_SPEC.md: "Shadow: only shadow-map, only on controls floating
 * over the map canvas").
 *
 * The "Compare dates" before/after swipe described alongside this in
 * DESIGN_SPEC.md is deliberately not built in this pass: implementing the
 * swipe control well (a second raster source, a clip-path drag handle,
 * its own date pair) was judged better spent as a follow-up than shipped
 * half-working next to a polished rail and inspect panel.
 */
export function FloatingControls({
  onZoomInAction,
  onZoomOutAction,
}: FloatingControlsProps) {
  return (
    // overflow-hidden clips each button's own focus-visible outline, since
    // the default outline-offset (2px, set globally) draws it outside the
    // button's box and into the clipped region. Each button pulls its
    // outline inward instead (focus-visible:outline-offset-[-2px]) so it
    // stays inside the clip and is actually visible on focus.
    <div className="absolute right-4 top-4 z-10 flex flex-col overflow-hidden rounded-xs bg-surface shadow-map">
      <button
        type="button"
        onClick={onZoomInAction}
        aria-label="Zoom in"
        className="flex h-10 w-10 items-center justify-center border-b border-rule text-ink transition-colors duration-(--duration-fast) ease-editorial hover:bg-well focus-visible:outline-offset-[-2px]"
      >
        +
      </button>
      <button
        type="button"
        onClick={onZoomOutAction}
        aria-label="Zoom out"
        className="flex h-10 w-10 items-center justify-center text-ink transition-colors duration-(--duration-fast) ease-editorial hover:bg-well focus-visible:outline-offset-[-2px]"
      >
        −
      </button>
    </div>
  );
}
