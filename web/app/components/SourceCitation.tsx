import type { ReactNode } from "react";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/**
 * "2026-07-18" -> "18 Jul 2026". Parsed by hand, not through Date, so the
 * server and the browser can never disagree because of a timezone.
 * Accepts full ISO timestamps too (only the date part is used).
 */
export function formatCitationDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return iso;
  const [, year, month, day] = match;
  return `${Number(day)} ${MONTHS[Number(month) - 1]} ${year}`;
}

type SourceCitationProps = {
  /** Who produced the data: "ESA Copernicus Sentinel-1 GRD", "CEGIS". */
  source: ReactNode;
  /** Link to the dataset, scene or publication. */
  href?: string;
  /** Extra specifics: a scene ID, a pass window, a survey name. */
  detail?: ReactNode;
  /** ISO date of the observation or publication ("2026-07-18"). */
  date?: string;
  /** A second date for a range ("2026-07-06" to "2026-07-24"). */
  dateEnd?: string;
  /**
   * Limitation or method note. Route200 outputs are decision support, not
   * forecasts; say so where a figure could be read as a prediction.
   */
  note?: ReactNode;
  /** Leading label. Defaults to "Source". */
  label?: string;
  as?: "p" | "div" | "figcaption";
  tone?: "default" | "inverse";
  className?: string;
};

/**
 * The "about this data" line that sits under every map, chart and stat
 * group (OWID / Earth Observatory style): a hairline, then the source in
 * the mono data voice, then an optional method or limitation note.
 */
export function SourceCitation({
  source,
  href,
  detail,
  date,
  dateEnd,
  note,
  label = "Source",
  as: Tag = "p",
  tone = "default",
  className = "",
}: SourceCitationProps) {
  const inverse = tone === "inverse";
  const dateText = date
    ? dateEnd
      ? `${formatCitationDate(date)} to ${formatCitationDate(dateEnd)}`
      : formatCitationDate(date)
    : undefined;

  return (
    <Tag
      className={`type-meta border-t pt-2 ${
        inverse
          ? "border-paper-muted/40 text-paper-muted"
          : "border-rule text-ink-subtle"
      } ${className}`}
    >
      <span className="block">
        <span
          className={`mr-2 font-medium uppercase tracking-[0.08em] [&:lang(bn)]:tracking-normal ${
            inverse ? "text-paper" : "text-ink-muted"
          }`}
        >
          {label}
        </span>
        {href ? (
          <a
            href={href}
            className={`underline decoration-1 underline-offset-[0.2em] ${
              inverse
                ? "decoration-paper-muted/50 hover:text-river-light"
                : "decoration-ink-subtle/40 hover:text-river"
            }`}
            target={href.startsWith("http") ? "_blank" : undefined}
            rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
          >
            {source}
          </a>
        ) : (
          source
        )}
        {detail && <span>, {detail}</span>}
        {dateText && (
          <>
            <span aria-hidden="true">{" · "}</span>
            <time dateTime={date}>{dateText}</time>
          </>
        )}
      </span>
      {note && <span className="mt-1 block">{note}</span>}
    </Tag>
  );
}
