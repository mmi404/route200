import { ButtonLink } from "@/app/components";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";

type FooterProps = {
  locale: Locale;
};

/**
 * Footer (DESIGN_SPEC.md 7a#6). Full-bleed ink band, unnumbered. The
 * closing copy's two sentences, then the repeated hero CTAs in their
 * inverse tone, then a ruled credits block naming data sources and the
 * team.
 */
export function Footer({ locale }: FooterProps) {
  const copy = translations.footer;

  return (
    <footer className="w-full bg-ink py-section-tight">
      <div className="frame flex flex-col gap-10">
        <div className="reveal flex flex-col gap-4">
          <h2 className="type-h2 max-w-wide text-paper">{t(copy.heading, locale)}</h2>
          <p className="type-lede max-w-column text-paper-muted">{t(copy.paragraph, locale)}</p>
        </div>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
          <ButtonLink href="/map" size="lg" tone="inverse">
            {t(copy.ctaPrimary, locale)}
          </ButtonLink>
          <ButtonLink href="#alerts" variant="secondary" size="lg" tone="inverse">
            {t(copy.ctaSecondary, locale)}
          </ButtonLink>
        </div>

        <div className="flex flex-col gap-2 border-t border-paper-muted/40 pt-6">
          <p className="type-meta text-paper-muted">{t(copy.creditsData, locale)}</p>
          <p className="type-meta text-paper-muted">{t(copy.creditsTeam, locale)}</p>
        </div>
      </div>
    </footer>
  );
}
