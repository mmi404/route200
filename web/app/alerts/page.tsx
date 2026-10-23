import { Suspense } from "react";
import type { Metadata } from "next";
import { ButtonLink, SectionLabel } from "@/app/components";
import { AlertSignupForm } from "./_components/AlertSignupForm";
import { getLocale, type Locale } from "@/lib/locale";
import { t } from "@/lib/i18n";
import { translations } from "@/lib/translations";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const copy = translations.alertsPage;
  return {
    title: t(copy.metaTitle, locale),
    description: t(copy.metaDescription, locale),
  };
}

// Reading searchParams at the top of the page would opt the whole route
// into runtime rendering (Cache Components). Pushing that read into its
// own component, wrapped in Suspense below, keeps the copy column (and
// the rest of the static shell) prerenderable; only the zone pre-fill
// streams in at request time, same as the "push dynamic access down"
// pattern in Next's Cache Components guide.
async function ZonePrefilledForm({
  searchParams,
  locale,
}: Pick<PageProps<"/alerts">, "searchParams"> & { locale: Locale }) {
  const params = await searchParams;
  const zoneParam = params?.zone;
  const defaultZoneId = Array.isArray(zoneParam) ? zoneParam[0] : zoneParam;
  return <AlertSignupForm defaultZoneId={defaultZoneId} locale={locale} />;
}

export default async function AlertsPage(props: PageProps<"/alerts">) {
  // Resolved once here (the server entry) and passed as a prop into the
  // client form component, which must not call cookies() itself.
  const locale = await getLocale();
  const copy = translations.alertsPage;

  return (
    <main className="frame flex flex-col py-section-tight">
      <div className="grid grid-cols-1 gap-x-gutter gap-y-12 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-6">
          <SectionLabel>{t(copy.sectionLabel, locale)}</SectionLabel>
          <h1 className="type-h1 max-w-column">{t(copy.heading, locale)}</h1>
          <p className="type-lede max-w-column text-ink-muted">{t(copy.lede, locale)}</p>
          <p className="type-body max-w-column text-ink-muted">{t(copy.paragraph1, locale)}</p>
          <p className="type-body max-w-column text-ink-muted">{t(copy.paragraph2, locale)}</p>
          <p className="type-meta text-ink-subtle">{t(copy.coverageNote, locale)}</p>
          <div>
            <ButtonLink href="/map" variant="secondary" size="lg">
              {t(copy.ctaSeeMapFirst, locale)}
            </ButtonLink>
          </div>
        </div>

        <div className="flex lg:col-span-6 lg:justify-end">
          <Suspense fallback={<AlertSignupForm locale={locale} />}>
            <ZonePrefilledForm searchParams={props.searchParams} locale={locale} />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
