import { SectionLabel, StatCallout } from "@/app/components";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";

type ProblemSectionProps = {
  locale: Locale;
};

/**
 * "The problem" (DESIGN_SPEC.md 7a#2). Copy comes from translations.ts's
 * `problem` group, split across the three source paragraphs with the
 * three stat figures inserted between paragraphs two and three, then the
 * closing sentence repeated as a pulled quote, newspaper style.
 */
export function ProblemSection({ locale }: ProblemSectionProps) {
  const copy = translations.problem;

  return (
    <section className="frame flex flex-col py-section">
      <div className="grid grid-cols-4 gap-x-gutter sm:grid-cols-12">
        <div className="reveal col-span-4 flex flex-col gap-4 sm:col-span-8 sm:col-start-2">
          <SectionLabel index={1}>{t(copy.sectionLabel, locale)}</SectionLabel>
          <h2 className="type-h2 max-w-column">{t(copy.heading, locale)}</h2>
        </div>

        <div className="col-span-4 mt-8 flex flex-col gap-5 sm:col-span-8 sm:col-start-2">
          <p className="type-body max-w-column text-ink-muted">{t(copy.paragraph1, locale)}</p>
          <p className="type-body max-w-column text-ink-muted">{t(copy.paragraph2, locale)}</p>
        </div>

        <div className="reveal col-span-4 mt-10 sm:col-span-12 sm:col-start-1">
          <div className="grid grid-cols-1 gap-x-gutter gap-y-8 sm:grid-cols-3">
            <StatCallout
              value={2004}
              grouping={false}
              countUp={false}
              locale={locale}
              label={t(copy.statCegisYearLabel, locale)}
              source={t(copy.statCegisSource, locale)}
            />
            <StatCallout
              value={37}
              suffix="%"
              locale={locale}
              label={t(copy.statYouthLabel, locale)}
              source={t(copy.statYouthSource, locale)}
            />
            <StatCallout
              value={50}
              suffix="+"
              accent="severe"
              locale={locale}
              label={t(copy.statDeathsLabel, locale)}
              source={t(copy.statDeathsSource, locale)}
            />
          </div>
        </div>

        <div className="col-span-4 mt-10 flex flex-col gap-5 sm:col-span-8 sm:col-start-2">
          <p className="type-body max-w-column text-ink-muted">{t(copy.paragraph3, locale)}</p>
        </div>

        <div className="reveal col-span-4 mt-10 border-t-2 border-ink pt-6 sm:col-span-10 sm:col-start-2">
          <p className="type-h2 max-w-wide">{t(copy.pullQuote, locale)}</p>
        </div>
      </div>
    </section>
  );
}
