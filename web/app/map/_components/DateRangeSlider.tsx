"use client";

import { formatCitationDate } from "@/app/components";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import { dayIndexToIso, isoToDayIndex, type DateWindow } from "../_lib/severity";
import styles from "./date-range-slider.module.css";

type DateRangeSliderProps = {
  locale: Locale;
  /** The full span available to drag within (the real event date range). */
  bounds: DateWindow;
  value: DateWindow;
  onChangeAction: (window: DateWindow) => void;
  className?: string;
};

/**
 * A two-handle date window over the real range of change events
 * (DESIGN_SPEC.md: "a ruled slider over the 2026-04-22 to 2026-10-21 range
 * of events"). Two overlapping native range inputs, each only interactive
 * at its own thumb, is the standard accessible way to get a real dual
 * slider without a dependency.
 */
export function DateRangeSlider({
  locale,
  bounds,
  value,
  onChangeAction,
  className = "",
}: DateRangeSliderProps) {
  const copy = translations.mapPage;
  const minDay = isoToDayIndex(bounds.low);
  const maxDay = isoToDayIndex(bounds.high);
  const lowDay = isoToDayIndex(value.low);
  const highDay = isoToDayIndex(value.high);
  const span = Math.max(1, maxDay - minDay);
  const lowPct = ((lowDay - minDay) / span) * 100;
  const highPct = ((highDay - minDay) / span) * 100;

  return (
    <div className={className}>
      <p className="type-eyebrow mb-3 text-ink-muted">{t(copy.dateWindowLabel, locale)}</p>
      <div className="relative h-5">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-river"
          style={{ left: `${lowPct}%`, right: `${100 - highPct}%` }}
        />
        <input
          type="range"
          className={styles.rangeInput}
          aria-label={t(copy.dateWindowStartAriaLabel, locale)}
          min={minDay}
          max={maxDay}
          value={lowDay}
          onChange={(event) => {
            const next = Math.min(Number(event.target.value), highDay);
            onChangeAction({ low: dayIndexToIso(next), high: value.high });
          }}
        />
        <input
          type="range"
          className={styles.rangeInput}
          aria-label={t(copy.dateWindowEndAriaLabel, locale)}
          min={minDay}
          max={maxDay}
          value={highDay}
          onChange={(event) => {
            const next = Math.max(Number(event.target.value), lowDay);
            onChangeAction({ low: value.low, high: dayIndexToIso(next) });
          }}
        />
      </div>
      <div className="type-meta mt-2 flex justify-between text-ink-subtle">
        <span>{formatCitationDate(value.low)}</span>
        <span>{formatCitationDate(value.high)}</span>
      </div>
    </div>
  );
}
