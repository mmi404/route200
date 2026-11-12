import { formatStatNumber, SectionLabel, StatCallout } from "@/app/components";
import { SEVERITY_SHORT_LABEL } from "@/lib/design-tokens";
import { format, t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import { SEVERITY_BANDS, severityToBand, type SeverityBand } from "@/lib/types";

/**
 * A hand-picked example value for the concept gauge. It is not computed
 * from any data and must never be wired to a real zone: no risk model
 * exists yet (docs/ARCHITECTURE.md, "Planned: trained risk prediction").
 */
const ILLUSTRATIVE_SCORE = 72;

// Literal class strings per band so Tailwind's static scan can see them
// (same table as app/map/_components/StripChart.tsx).
const FILL_CLASS: Record<SeverityBand, string> = {
  low: "fill-sev-low",
  moderate: "fill-sev-moderate",
  high: "fill-sev-high",
  severe: "fill-sev-severe",
};

type ConceptPreviewProps = {
  locale: Locale;
  index: number;
};

/**
 * "Where this goes next": the one part of the evidence page that is not
 * real data. Set on the inverse ink band so the boundary with the measured
 * sections above is unmistakable, with a "Concept preview, not a trained
 * model" bar pinned under the site header for as long as any of the
 * section is on screen. The planned inputs and labels are the ones
 * ML_Data_Sources_DRAFT.md sections 4 and 5 name; the gauge is a labelled
 * example, not a prediction.
 */
export function ConceptPreview({ locale, index }: ConceptPreviewProps) {
  const copy = translations.zoneEvidence;
  const inputs = [
    { title: copy.inputSarTitle, body: copy.inputSarBody },
    { title: copy.inputSlopeTitle, body: copy.inputSlopeBody },
    { title: copy.inputRainTitle, body: copy.inputRainBody },
  ];

  return (
    <section aria-labelledby="concept-heading" className="bg-ink">
      <div className="sticky top-header z-20 border-b border-paper-muted/40 bg-ink">
        <p className="frame type-eyebrow flex items-center gap-3 py-3 text-paper">
          <span aria-hidden="true" className="h-px w-8 shrink-0 bg-current" />
          {t(copy.conceptBadge, locale)}
        </p>
      </div>

      <div className="frame grid grid-cols-1 gap-x-gutter gap-y-12 py-section-tight lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-7">
          <SectionLabel index={index} tone="inverse">
            {t(copy.conceptLabel, locale)}
          </SectionLabel>
          <h2 id="concept-heading" className="type-h2 max-w-column text-paper">
            {t(copy.conceptHeading, locale)}
          </h2>
          <p className="type-lede max-w-column text-paper-muted">{t(copy.conceptBody, locale)}</p>
          <p className="type-body max-w-column border-l-2 border-paper pl-4 text-paper">
            {t(copy.conceptStatus, locale)}
          </p>

          <h3 className="type-h3 mt-4 text-paper">{t(copy.plannedInputsHeading, locale)}</h3>
          <ol className="flex max-w-column flex-col">
            {inputs.map((input, position) => (
              <li
                key={input.title.en}
                className="grid grid-cols-[2rem_1fr] gap-x-2 border-t border-paper-muted/40 py-4"
              >
                <span className="type-meta tabular-nums text-river-light">
                  {formatStatNumber(position + 1, { locale })}
                </span>
                <span className="flex flex-col gap-1">
                  <span className="type-small font-medium text-paper">{t(input.title, locale)}</span>
                  <span className="type-small text-paper-muted">{t(input.body, locale)}</span>
                </span>
              </li>
            ))}
          </ol>

          <h3 className="type-h3 mt-4 text-paper">{t(copy.labelsHeading, locale)}</h3>
          <p className="type-small max-w-column text-paper-muted">{t(copy.labelsBody, locale)}</p>
        </div>

        <aside className="flex flex-col gap-4 lg:col-span-5 lg:pt-16">
          <h3 className="type-h3 text-paper">{t(copy.gaugeHeading, locale)}</h3>
          <IllustrativeGauge locale={locale} />
          <p className="type-meta max-w-column text-paper-muted">{t(copy.gaugeFootnote, locale)}</p>
        </aside>
      </div>
    </section>
  );
}

const GAUGE_WIDTH = 280;
const TRACK_Y = 22;
const TRACK_HEIGHT = 12;

function IllustrativeGauge({ locale }: { locale: Locale }) {
  const copy = translations.zoneEvidence;
  const { band } = severityToBand(ILLUSTRATIVE_SCORE);
  const bandWord = SEVERITY_SHORT_LABEL[locale][band];
  const x = (score: number) => (score / 100) * GAUGE_WIDTH;
  const markerX = x(ILLUSTRATIVE_SCORE);

  return (
    <div className="flex flex-col gap-3">
      {/* Kept right against the figure, not in a tooltip or footnote. */}
      <p className="type-eyebrow self-start border border-paper px-2 py-1 text-paper">
        {t(copy.gaugeIllustrative, locale)}
      </p>
      <StatCallout
        tone="inverse"
        size="md"
        value={ILLUSTRATIVE_SCORE}
        suffix={` / ${formatStatNumber(100, { locale })}`}
        countUp={false}
        locale={locale}
        label={t(copy.gaugeLabel, locale)}
      />
      <svg
        viewBox={`0 0 ${GAUGE_WIDTH} 64`}
        role="img"
        aria-label={format(t(copy.gaugeAriaLabel, locale), {
          score: formatStatNumber(ILLUSTRATIVE_SCORE, { locale }),
          band: bandWord,
        })}
        className="w-full max-w-sm"
      >
        {SEVERITY_BANDS.map((definition, position) => {
          const lower = position === 0 ? 0 : SEVERITY_BANDS[position - 1].max;
          return (
            <rect
              key={definition.band}
              x={x(lower)}
              y={TRACK_Y}
              width={x(definition.max) - x(lower)}
              height={TRACK_HEIGHT}
              className={FILL_CLASS[definition.band]}
            />
          );
        })}
        <line
          x1={markerX}
          x2={markerX}
          y1={TRACK_Y - 8}
          y2={TRACK_Y + TRACK_HEIGHT + 8}
          className="stroke-paper"
          strokeWidth={2}
        />
        <text
          x={markerX}
          y={TRACK_Y - 11}
          textAnchor="middle"
          className="fill-paper font-mono"
          fontSize={10}
        >
          {bandWord}
        </text>
        <text x={0} y={TRACK_Y + TRACK_HEIGHT + 20} className="fill-paper-muted font-mono" fontSize={9}>
          {formatStatNumber(0, { locale })}
        </text>
        <text
          x={GAUGE_WIDTH}
          y={TRACK_Y + TRACK_HEIGHT + 20}
          textAnchor="end"
          className="fill-paper-muted font-mono"
          fontSize={9}
        >
          {formatStatNumber(100, { locale })}
        </text>
      </svg>
    </div>
  );
}
