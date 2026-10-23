import { SectionLabel } from "@/app/components";
import { AlertSignupForm } from "@/app/alerts/_components/AlertSignupForm";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";

type AlertsSectionProps = {
  locale: Locale;
};

/**
 * "Get alerts" (DESIGN_SPEC.md 7a#5). The actual signup form, not a link
 * to /alerts: AlertSignupForm is owned by the alerts build (section 8) and
 * imported directly here, driven by the same resolved `locale` as the
 * rest of the page rather than its own independent toggle.
 */
export function AlertsSection({ locale }: AlertsSectionProps) {
  const copy = translations.alertsSection;

  return (
    <section id="alerts" className="frame py-section">
      <div className="grid grid-cols-1 gap-x-gutter gap-y-10 lg:grid-cols-12">
        <div className="reveal col-span-1 flex flex-col gap-4 lg:col-span-6">
          <SectionLabel index={4}>{t(copy.sectionLabel, locale)}</SectionLabel>
          <h2 className="type-h2 max-w-column">{t(copy.heading, locale)}</h2>
          <p className="type-body max-w-column text-ink-muted">{t(copy.paragraph, locale)}</p>
        </div>

        <div className="col-span-1 flex lg:col-span-6 lg:justify-end">
          <AlertSignupForm locale={locale} />
        </div>
      </div>
    </section>
  );
}
