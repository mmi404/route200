import type { ChangeEvent, SeverityBand } from "@/lib/types";
import { severityToBand } from "@/lib/types";
import { formatCitationDate } from "@/app/components";
import { format, t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";

type StripChartProps = {
  locale: Locale;
  /** Chronological, full history (not limited to the date window): the
   *  chart's job is to show the shift the window is cutting into. */
  events: ChangeEvent[];
  className?: string;
};

// Literal class strings per band so Tailwind's static scan can see them.
const FILL_CLASS: Record<SeverityBand, string> = {
  low: "fill-sev-low",
  moderate: "fill-sev-moderate",
  high: "fill-sev-high",
  severe: "fill-sev-severe",
};

const WIDTH = 280;
const HEIGHT = 108;
const BAR_TOP = 16;
const BAR_BOTTOM = 72;
const BAR_SPAN = BAR_BOTTOM - BAR_TOP;

/**
 * A direct-labelled strip chart of one zone's change events: bars colored
 * by band, dates set under each bar (OWID style, no hover-only tooltip).
 * Inline SVG, since this is a handful of points, not a general chart.
 */
export function StripChart({ locale, events, className = "" }: StripChartProps) {
  const copy = translations.mapPage;

  if (events.length === 0) {
    return (
      <p className={`type-small text-ink-subtle ${className}`}>
        {t(copy.noEventsRecorded, locale)}
      </p>
    );
  }

  const barWidth = Math.min(36, (WIDTH / events.length) * 0.6);
  const gap = events.length > 1 ? (WIDTH - barWidth) / (events.length - 1) : 0;

  return (
    <figure className={className}>
      <figcaption className="type-eyebrow mb-2 text-ink-muted">
        {t(copy.changeSeverityOverTime, locale)}
      </figcaption>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={format(t(copy.stripChartAriaLabel, locale), {
          start: formatCitationDate(events[0].dateRangeEnd),
          end: formatCitationDate(events[events.length - 1].dateRangeEnd),
        })}
        className="w-full"
      >
        <line
          x1={0}
          y1={BAR_BOTTOM}
          x2={WIDTH}
          y2={BAR_BOTTOM}
          className="stroke-rule"
          strokeWidth={1}
        />
        {events.map((event, index) => {
          const band = severityToBand(event.severity).band;
          const x = events.length === 1 ? WIDTH / 2 - barWidth / 2 : index * gap;
          const barHeight = Math.max(2, (event.severity / 100) * BAR_SPAN);
          const y = BAR_BOTTOM - barHeight;
          return (
            <g key={event.id}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={barHeight}
                className={`${FILL_CLASS[band]} stroke-ink/25`}
                strokeWidth={1}
              />
              <text
                x={x + barWidth / 2}
                y={y - 5}
                textAnchor="middle"
                className="fill-ink font-mono"
                fontSize={10}
              >
                {Math.round(event.severity)}
              </text>
              <text
                x={x + barWidth / 2}
                y={BAR_BOTTOM + 16}
                textAnchor="middle"
                className="fill-ink-subtle font-mono"
                fontSize={9}
              >
                {formatCitationDate(event.dateRangeEnd)}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
