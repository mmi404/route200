import type { ReactNode } from "react";

type SectionLabelProps = {
  children: ReactNode;
  /** Section number, rendered zero-padded ("02") in the river accent. */
  index?: number;
  /** Element to render. Use "h2" only when no visible heading follows. */
  as?: "p" | "span" | "div" | "h2";
  /** "inverse" for use on the ink band (footer). */
  tone?: "default" | "inverse";
  className?: string;
  id?: string;
};

/**
 * Small-caps mono eyebrow above a section heading, newsroom style: the
 * section number in river, a 32px hairline, then the label in caps.
 *
 * Purely a wayfinding label. The section's real heading is the h2 that
 * follows it.
 */
export function SectionLabel({
  children,
  index,
  as: Tag = "p",
  tone = "default",
  className = "",
  id,
}: SectionLabelProps) {
  const inverse = tone === "inverse";
  return (
    <Tag
      id={id}
      className={`type-eyebrow flex items-center gap-3 ${
        inverse ? "text-paper-muted" : "text-ink-muted"
      } ${className}`}
    >
      {index !== undefined && (
        <>
          <span
            className={`tabular-nums ${inverse ? "text-river-light" : "text-river"}`}
          >
            {String(index).padStart(2, "0")}
          </span>
          <span aria-hidden="true" className="h-px w-8 shrink-0 bg-current" />
        </>
      )}
      <span>{children}</span>
    </Tag>
  );
}
