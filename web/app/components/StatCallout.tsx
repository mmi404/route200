import type { ReactNode } from "react";
import { CountUp, type NumberFormatOptions } from "./CountUp";

type StatCalloutProps = NumberFormatOptions & {
  value: number;
  /** Text set before the number at reduced size, e.g. "~". */
  prefix?: string;
  /** Unit set after the number at reduced size: "%", "+", " km²". */
  suffix?: string;
  /** What the number counts. One short sentence, no trailing period needed. */
  label: ReactNode;
  /** Where the number comes from. Required in spirit: unsourced stats are
   *  how civic data loses trust. Rendered in the mono data voice. */
  source?: ReactNode;
  /** "lg" for the landing problem section, "md" for panels and rails. */
  size?: "lg" | "md";
  /** Color of the figure. "severe" only for loss-of-life or alert figures. */
  accent?: "ink" | "river" | "severe";
  tone?: "default" | "inverse";
  /** Count up once on first scroll into view. Off for years and IDs. */
  countUp?: boolean;
  className?: string;
};

const ACCENT: Record<NonNullable<StatCalloutProps["accent"]>, string> = {
  ink: "text-ink",
  river: "text-river",
  severe: "text-sev-severe-ink",
};

/**
 * A single sourced figure, set like a newspaper stat box: a heavy rule on
 * top, a condensed tabular number, a short label, then the source line.
 * No card, no icon, no background. Lay several side by side in a grid; the
 * top rules line up into one continuous band.
 */
export function StatCallout({
  value,
  prefix,
  suffix,
  label,
  source,
  size = "lg",
  accent = "ink",
  tone = "default",
  countUp = true,
  decimals,
  grouping,
  locale,
  className = "",
}: StatCalloutProps) {
  const inverse = tone === "inverse";
  return (
    <figure
      className={`flex flex-col border-t-2 pt-3 ${
        inverse ? "border-paper" : "border-ink"
      } ${className}`}
    >
      <p
        className={`type-stat ${inverse ? "text-paper" : ACCENT[accent]}`}
        style={
          size === "md"
            ? { fontSize: "calc(var(--text-stat) * 0.62)" }
            : undefined
        }
      >
        {prefix && <span className="mr-0.5 text-[0.6em]">{prefix}</span>}
        <CountUp
          value={value}
          decimals={decimals}
          grouping={grouping}
          locale={locale}
          animate={countUp}
        />
        {suffix && <span className="ml-0.5 text-[0.6em]">{suffix}</span>}
      </p>
      <figcaption className="mt-3 flex flex-col gap-2">
        <span
          className={`type-small max-w-[26ch] ${
            inverse ? "text-paper" : "text-ink-muted"
          }`}
        >
          {label}
        </span>
        {source && (
          <span
            className={`type-meta ${inverse ? "text-paper-muted" : "text-ink-subtle"}`}
          >
            {source}
          </span>
        )}
      </figcaption>
    </figure>
  );
}
