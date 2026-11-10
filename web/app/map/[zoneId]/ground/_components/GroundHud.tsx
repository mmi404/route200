"use client";

import type { ReactNode } from "react";
import { SeverityBadge } from "@/app/components";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import type { SeverityBand } from "@/lib/types";
import type { JoystickRefs } from "./useWalkInput";

/** Presentational pieces of the Ground View HUD. State lives in GroundView. */

const copy = translations.groundView;

function fade(reducedMotion: boolean): string {
  return reducedMotion ? "" : "transition-opacity duration-500";
}

/**
 * The walk stick, drawn as DOM so the canvas never re-renders for it. It is
 * invisible until a thumb lands; useWalkInput then writes the ring's and the
 * knob's transforms straight to these nodes. The layer's padding carries the
 * device safe-area insets, which the hook reads to keep the ring on screen.
 */
export function JoystickLayer({ layerRef, baseRef, knobRef }: JoystickRefs) {
  return (
    <div
      ref={layerRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20"
      style={{
        padding:
          "env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)",
      }}
    >
      <div
        ref={baseRef}
        className="absolute left-0 top-0 -ml-14 -mt-14 size-28 rounded-full border-2 border-paper/70 bg-ink/30 opacity-0 transition-opacity duration-150 motion-reduce:transition-none"
      >
        <div
          ref={knobRef}
          className="absolute left-1/2 top-1/2 -ml-6 -mt-6 size-12 rounded-full bg-paper/85 shadow-map"
        />
      </div>
    </div>
  );
}

function Key({ children }: { children: ReactNode }) {
  return (
    <kbd className="type-meta inline-flex h-6 min-w-6 items-center justify-center rounded-xs border border-paper/45 bg-paper/10 px-1.5 text-paper">
      {children}
    </kbd>
  );
}

function LegendItem({ keys, label }: { keys: string[]; label: string }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span className="inline-flex gap-0.5">
        {keys.map((key) => (
          <Key key={key}>{key}</Key>
        ))}
      </span>
      <span className="type-small text-paper">{label}</span>
    </span>
  );
}

type LegendProps = {
  locale: Locale;
  touchUi: boolean;
  visible: boolean;
  locked: boolean;
  reducedMotion: boolean;
};

/**
 * The short controls legend: key caps on desktop, one line on touch. It is
 * decorative to the pointer (never intercepts it) and fades out once the
 * visitor starts moving; the "?" button brings it back.
 */
export function ControlsLegend({ locale, touchUi, visible, locked, reducedMotion }: LegendProps) {
  return (
    <div
      aria-hidden={!visible}
      className={`pointer-events-none w-max max-w-[calc(100vw-1.5rem)] rounded-xs bg-ink/65 px-3 py-2 ${fade(reducedMotion)} ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      {touchUi ? (
        <p className="type-small text-center text-paper">{t(copy.legendTouch, locale)}</p>
      ) : (
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          <LegendItem keys={["W", "A", "S", "D"]} label={t(copy.legendWalk, locale)} />
          <LegendItem keys={["Shift"]} label={t(copy.legendRun, locale)} />
          <LegendItem keys={["Q", "E"]} label={t(copy.legendTime, locale)} />
          <LegendItem
            keys={["Esc"]}
            label={t(locked ? copy.legendEscLocked : copy.legendEsc, locale)}
          />
        </div>
      )}
    </div>
  );
}

type ControlsToggleProps = {
  locale: Locale;
  pressed: boolean;
  onToggle: () => void;
};

export function ControlsToggle({ locale, pressed, onToggle }: ControlsToggleProps) {
  const label = t(copy.controlsToggle, locale);
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      onClick={onToggle}
      className="type-small inline-flex size-9 items-center justify-center rounded-xs bg-surface/95 font-medium text-ink shadow-map hover:text-river [@media(pointer:coarse)]:size-11"
    >
      <span aria-hidden="true">?</span>
    </button>
  );
}

type ReadoutProps = {
  locale: Locale;
  band: SeverityBand;
  /** False before the zone's first recorded event: there is nothing to
   *  estimate yet, so the readout says so instead of showing a band. */
  recorded: boolean;
};

/**
 * Live readout of the zone's severity band at the scrubbed date. The value
 * is interpolated between recorded events (severityAtDay), so it is labelled
 * an estimate and shows the band only, never a number.
 */
export function SeverityReadout({ locale, band, recorded }: ReadoutProps) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xs bg-surface/95 px-3 py-2 shadow-map">
      <span className="type-meta text-ink-subtle">{t(copy.readoutLabel, locale)}</span>
      {recorded ? (
        <SeverityBadge band={band} lang={locale} />
      ) : (
        <span className="type-meta font-medium text-ink">
          {t(translations.common.noData, locale)}
        </span>
      )}
    </div>
  );
}
