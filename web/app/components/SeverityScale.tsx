import type { ReactNode } from "react";
import type { SeverityBand } from "@/lib/types";
import {
  ALERT_THRESHOLD,
  SEVERITY_RANGES,
  SEVERITY_SHORT_LABEL,
} from "@/lib/design-tokens";

type SeverityScaleProps = {
  /**
   * "horizontal": a segmented ramp with labels and 0/25/50/75/100 ticks.
   * Use on the landing page and anywhere the scale is explained.
   * "vertical": a compact key (swatch, name, range) for the map rail.
   */
  orientation?: "horizontal" | "vertical";
  /** Small caption above the scale, e.g. "Change severity, 0–100". */
  title?: ReactNode;
  /** Emphasise one band (e.g. the band of the zone being inspected). */
  highlight?: SeverityBand;
  /** Annotate where SMS and voice alerts start. */
  markAlertThreshold?: boolean;
  /** Optional per-band counts shown in the vertical key (e.g. zones). */
  counts?: Partial<Record<SeverityBand, number>>;
  lang?: "en" | "bn";
  className?: string;
};

const FILL: Record<SeverityBand, string> = {
  low: "bg-sev-low",
  moderate: "bg-sev-moderate",
  high: "bg-sev-high",
  severe: "bg-sev-severe",
};

const INK: Record<SeverityBand, string> = {
  low: "text-sev-low-ink",
  moderate: "text-sev-moderate-ink",
  high: "text-sev-high-ink",
  severe: "text-sev-severe-ink",
};

/**
 * The severity legend. Its cut points come from SEVERITY_BANDS in
 * lib/types.ts, so the legend can never disagree with the map.
 * Labelled directly (OWID style): no color-only key.
 */
export function SeverityScale({
  orientation = "horizontal",
  title,
  highlight,
  markAlertThreshold = false,
  counts,
  lang = "en",
  className = "",
}: SeverityScaleProps) {
  const labels = SEVERITY_SHORT_LABEL[lang];

  if (orientation === "vertical") {
    return (
      <figure className={className}>
        {title && (
          <figcaption className="type-eyebrow mb-3 text-ink-muted">
            {title}
          </figcaption>
        )}
        <ul className="flex flex-col">
          {[...SEVERITY_RANGES].reverse().map((range) => {
            const active = highlight === range.band;
            const dimmed = highlight !== undefined && !active;
            return (
              <li
                key={range.band}
                className={`type-meta grid grid-cols-[0.875rem_1fr_auto] items-center gap-x-2.5 border-t border-rule py-1.5 first:border-t-0 ${
                  dimmed ? "opacity-55" : ""
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`size-3.5 ring-1 ring-ink/25 ring-inset ${FILL[range.band]}`}
                />
                <span className={`font-medium ${INK[range.band]}`}>
                  {labels[range.band]}
                  {markAlertThreshold && range.min > ALERT_THRESHOLD && (
                    <span className="ml-2 font-normal text-ink-subtle">
                      {lang === "bn" ? "সতর্কবার্তা" : "alerts sent"}
                    </span>
                  )}
                </span>
                <span className="tabular-nums text-ink-subtle">
                  {counts?.[range.band] !== undefined
                    ? counts[range.band]
                    : `${range.min}–${range.max}`}
                </span>
              </li>
            );
          })}
        </ul>
      </figure>
    );
  }

  const alertIndex = SEVERITY_RANGES.findIndex(
    (range) => range.min > ALERT_THRESHOLD,
  );

  return (
    <figure className={`w-full max-w-[34rem] ${className}`}>
      {title && (
        <figcaption className="type-eyebrow mb-3 text-ink-muted">
          {title}
        </figcaption>
      )}
      <div className="relative">
        {markAlertThreshold && alertIndex > 0 && (
          <div
            className="type-meta absolute bottom-full mb-1.5 flex -translate-x-px items-end gap-1.5 whitespace-nowrap text-ink"
            style={{ left: `${ALERT_THRESHOLD}%` }}
          >
            <span aria-hidden="true" className="h-4 w-px bg-ink" />
            <span className="pb-0.5">
              {lang === "bn"
                ? `${ALERT_THRESHOLD}-এর উপরে সতর্কবার্তা`
                : `Alerts above ${ALERT_THRESHOLD}`}
            </span>
          </div>
        )}
        <ol
          className={`grid gap-px ${markAlertThreshold ? "mt-7" : ""}`}
          style={{
            // Segment widths follow the real score ranges, so a later change
            // to the band cut points redraws the scale correctly.
            gridTemplateColumns: SEVERITY_RANGES.map(
              (range, index) =>
                `${range.max - (index === 0 ? 0 : SEVERITY_RANGES[index - 1].max)}fr`,
            ).join(" "),
          }}
        >
          {SEVERITY_RANGES.map((range) => {
            const active = highlight === range.band;
            const dimmed = highlight !== undefined && !active;
            return (
              <li
                key={range.band}
                className={`flex flex-col gap-1.5 ${dimmed ? "opacity-45" : ""}`}
              >
                <span
                  aria-hidden="true"
                  className={`${active ? "h-4" : "h-2.5"} ${FILL[range.band]} ${
                    range.band === "low" ? "ring-1 ring-ink/15 ring-inset" : ""
                  }`}
                />
                <span className={`type-meta font-medium ${INK[range.band]}`}>
                  {labels[range.band]}
                  <span className="sr-only">
                    {`, ${range.min} to ${range.max}`}
                  </span>
                </span>
              </li>
            );
          })}
        </ol>
        <div
          aria-hidden="true"
          className="type-meta relative mt-0.5 h-5 tabular-nums text-ink-subtle"
        >
          {[0, ...SEVERITY_RANGES.map((range) => range.max)].map(
            (tick, index, ticks) => {
              const shift =
                index === 0
                  ? "translate-x-0"
                  : index === ticks.length - 1
                    ? "-translate-x-full"
                    : "-translate-x-1/2";
              return (
                <span
                  key={tick}
                  className={`absolute top-0 ${shift}`}
                  style={{ left: `${tick}%` }}
                >
                  {tick}
                </span>
              );
            },
          )}
        </div>
      </div>
    </figure>
  );
}
