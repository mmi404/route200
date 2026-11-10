"use client";

import { formatCitationDate } from "@/app/components";
import { format, t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import type { ChangeEvent, SeverityBand } from "@/lib/types";
import { severityToBand } from "@/lib/types";
import { dateRangeOfEvents, dayIndexToIso, isoToDayIndex } from "../../_lib/severity";
import styles from "../../_components/date-range-slider.module.css";

type ExploreScrubberProps = {
  locale: Locale;
  /** This zone's full chronological event history (never empty: the caller
   *  renders translations.zoneExplore.noHistory instead of this component
   *  when it is). */
  history: ChangeEvent[];
  day: number;
  onChangeAction: (day: number) => void;
  className?: string;
  /** Tighter layout for floating HUDs: the "Scrub through time" label stays
   *  for screen readers but is not drawn. */
  compact?: boolean;
};

// Literal class strings so Tailwind's static scan can see them (same
// reasoning as StripChart.tsx's FILL_CLASS).
const TICK_CLASS: Record<SeverityBand, string> = {
  low: "bg-sev-low",
  moderate: "bg-sev-moderate",
  high: "bg-sev-high",
  severe: "bg-sev-severe",
};

/**
 * A single-handle scrub slider over one zone's real event history, driving
 * which recorded date TerrainCanvas's drape currently shows (PROGRESS.md,
 * "Phase 2: 3D terrain explore", M10). Not DateRangeSlider.tsx: that is a
 * two-handle window filter for the 2D map's zone list, this is a single
 * "what does the surface look like on this date" scrub, with every real
 * event date marked as a tick on the track so the known history is visible
 * before anyone touches it.
 */
export function ExploreScrubber({
  locale,
  history,
  day,
  onChangeAction,
  className = "",
  compact = false,
}: ExploreScrubberProps) {
  const copy = translations.zoneExplore;
  const bounds = dateRangeOfEvents(history);
  const minDay = isoToDayIndex(bounds.low);
  const maxDay = isoToDayIndex(bounds.high);
  const span = Math.max(1, maxDay - minDay);
  const valuePct = ((Math.min(Math.max(day, minDay), maxDay) - minDay) / span) * 100;

  return (
    <div className={className}>
      <p className={compact ? "sr-only" : "type-eyebrow mb-3 text-ink-muted"}>
        {t(copy.scrubLabel, locale)}
      </p>
      <div className="relative h-5">
        <div
          aria-hidden="true"
          className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-rule"
        />
        <div
          aria-hidden="true"
          className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-river"
          style={{ left: 0, right: `${100 - valuePct}%` }}
        />
        {history.map((event) => {
          const tickDay = isoToDayIndex(event.dateRangeEnd);
          const pct = ((tickDay - minDay) / span) * 100;
          const band = severityToBand(event.severity).band;
          return (
            <span
              key={event.id}
              aria-hidden="true"
              className={`absolute top-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-1 ring-surface ${TICK_CLASS[band]}`}
              style={{ left: `${pct}%` }}
            />
          );
        })}
        <input
          type="range"
          className={styles.rangeInput}
          aria-label={t(copy.scrubAriaLabel, locale)}
          min={minDay}
          max={maxDay}
          value={day}
          onChange={(event) => onChangeAction(Number(event.target.value))}
        />
      </div>
      <div className={`type-meta flex justify-between text-ink-subtle ${compact ? "mt-1" : "mt-2"}`}>
        <span>{formatCitationDate(bounds.low)}</span>
        <span className="font-medium text-ink">
          {format(t(copy.asOfDate, locale), { date: formatCitationDate(dayIndexToIso(day)) })}
        </span>
      </div>
    </div>
  );
}
