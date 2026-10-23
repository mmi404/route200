import { severityToBand, type SeverityBand } from "@/lib/types";
import { SEVERITY_SHORT_LABEL } from "@/lib/design-tokens";

type SeveritySource =
  | { score: number; band?: never }
  | { band: SeverityBand; score?: never };

type SeverityBadgeProps = SeveritySource & {
  /**
   * "inline": square swatch + band word in text-safe ink. Default; use in
   * running text, tables, zone lists.
   * "solid": filled chip. Use once per view for the current state of the
   * thing being inspected (inspect panel header, alert preview).
   */
  variant?: "inline" | "solid";
  /** Append the raw score as "62/100". Only possible when `score` is given. */
  showScore?: boolean;
  lang?: "en" | "bn";
  className?: string;
};

// Literal class strings per band so Tailwind can see them.
const SWATCH: Record<SeverityBand, string> = {
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

const SOLID: Record<SeverityBand, string> = {
  low: "bg-sev-low text-ink",
  moderate: "bg-sev-moderate text-ink",
  high: "bg-sev-high text-paper",
  severe: "bg-sev-severe text-paper",
};

// Screen-reader-only prefix, inline bilingual via the `lang` prop like this
// component's own SEVERITY_SHORT_LABEL, not duplicated in translations.ts.
const SR_PREFIX: Record<"en" | "bn", string> = {
  en: "Severity: ",
  bn: "তীব্রতা: ",
};

/**
 * Severity band marker. Takes either the engine's raw 0-100 `score` (the
 * band is derived with severityToBand, never guessed) or a known `band`.
 * Color is never the only signal: the band word is always printed.
 */
export function SeverityBadge({
  score,
  band: bandProp,
  variant = "inline",
  showScore = false,
  lang = "en",
  className = "",
}: SeverityBadgeProps) {
  const info = score !== undefined ? severityToBand(score) : undefined;
  const band = info?.band ?? bandProp ?? "low";
  const word = SEVERITY_SHORT_LABEL[lang][band];
  const scoreText =
    showScore && info ? `${Math.round(info.score)}/100` : undefined;
  const title = info?.label;

  if (variant === "solid") {
    return (
      <span
        title={title}
        className={`type-meta inline-flex h-6 items-center gap-2 rounded-xs px-2 font-medium ${SOLID[band]} ${className}`}
      >
        <span className="sr-only">{SR_PREFIX[lang]}</span>
        <span className="uppercase tracking-[0.06em] [&:lang(bn)]:tracking-normal">{word}</span>
        {scoreText && <span className="tabular-nums opacity-80">{scoreText}</span>}
      </span>
    );
  }

  return (
    <span
      title={title}
      className={`type-meta inline-flex items-center gap-1.5 font-medium ${className}`}
    >
      <span
        aria-hidden="true"
        className={`size-2.5 shrink-0 ring-1 ring-ink/25 ring-inset ${SWATCH[band]}`}
      />
      <span className="sr-only">{SR_PREFIX[lang]}</span>
      <span className={INK[band]}>{word}</span>
      {scoreText && (
        <span className="tabular-nums font-normal text-ink-subtle">
          {scoreText}
        </span>
      )}
    </span>
  );
}
