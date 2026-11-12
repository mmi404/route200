"use client";

// A Client Component (still server-rendered on first load) because every
// figure on this page goes through formatStatNumber() for Bengali digits,
// and that helper lives in the "use client" CountUp module: a Server
// Component cannot call it. DailyStrip and ConceptPreview are only
// imported from here, so they sit inside this same boundary. The pack
// itself is plain manifest JSON, safe to pass in from page.tsx.
import Image from "next/image";
import Link from "next/link";
import {
  formatCitationDate,
  formatStatNumber,
  SectionLabel,
  SourceCitation,
  StatCallout,
} from "@/app/components";
import { format, t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import { evidenceImageUrls, SAR_IMAGE_SIZE, type EvidencePack } from "../_lib/packs";
import { despeckleWindow, parseEventWindow } from "../_lib/timeline";
import { ConceptPreview } from "./ConceptPreview";
import { DailyStrip } from "./DailyStrip";
import { EvidenceZoneHeading } from "./EvidenceZoneHeading";

type EvidenceReportProps = {
  zoneId: string;
  pack: EvidencePack;
  locale: Locale;
};

/**
 * The evidence page for a zone that has a pack. Server-rendered straight
 * from the manifest: every date, scene ID, count and image path below is
 * read from it (or derived from its dates), never restated by hand. The
 * three numbered sections are real measurement; section 04 is the
 * concept preview, on its own visually distinct band.
 */
export function EvidenceReport({ zoneId, pack, locale }: EvidenceReportProps) {
  const copy = translations.zoneEvidence;
  const { manifest } = pack;
  const pair = manifest.before_after;
  const timeline = manifest.july_event_timeline;
  const urls = evidenceImageUrls(pack);

  const beforeDate = formatCitationDate(pair.before_date);
  const afterDate = formatCitationDate(pair.after_date);
  const filter = despeckleWindow(pair.despeckle_note);
  const eventWindow = parseEventWindow(timeline.event_window);
  const days = timeline.daily_optical_precip;
  const passes = timeline.sar_passes;

  // The optical blackout: every day the manifest marks unavailable.
  const blackoutDays = days.filter((day) => !day.optical_available);
  const blackoutSet = new Set(blackoutDays.map((day) => day.date));
  const blackoutStart = blackoutDays[0]?.date;
  const blackoutEnd = blackoutDays[blackoutDays.length - 1]?.date;
  // Radar passes from the first blind day to the end of the event window.
  const radarThroughGap = blackoutStart
    ? passes.filter(
        (pass) => pass.date >= blackoutStart && (!eventWindow || pass.date <= eventWindow.end),
      )
    : [];

  const fmt = (value: number, decimals = 0) => formatStatNumber(value, { decimals, locale });

  return (
    <main className="flex flex-col">
      <header className="frame flex flex-col gap-6 pb-12 pt-section-tight">
        <Link
          href={`/map?zone=${zoneId}`}
          className="type-small self-start text-ink-muted hover:text-river"
        >
          {t(translations.zoneExplore.backToMap, locale)}
        </Link>
        <SectionLabel>{t(copy.title, locale)}</SectionLabel>
        <div className="flex flex-col gap-2">
          <EvidenceZoneHeading zoneId={zoneId} locale={locale} />
        </div>
        <p className="type-lede max-w-column text-ink-muted">{t(copy.lede, locale)}</p>
        <p className="type-meta text-ink-subtle">
          {format(t(copy.builtOn, locale), { date: formatCitationDate(manifest.generated) })}
        </p>
      </header>

      {/* 01: before and after */}
      <section aria-labelledby="before-after-heading" className="frame">
        <div className="flex flex-col gap-6 border-t border-rule py-section-tight">
          <SectionLabel index={1}>{t(copy.beforeAfterLabel, locale)}</SectionLabel>
          <h2 id="before-after-heading" className="type-h2 max-w-column">
            {format(t(copy.beforeAfterHeading, locale), { days: fmt(pair.gap_days) })}
          </h2>
          <p className="type-body max-w-column text-ink-muted">{t(copy.beforeAfterBody, locale)}</p>

          <div className="grid grid-cols-1 gap-gutter sm:grid-cols-2 lg:max-w-wide">
            <SarFigure
              src={urls.before}
              alt={format(t(copy.beforeAlt, locale), { date: beforeDate })}
              caption={format(t(copy.beforeCaption, locale), { date: beforeDate })}
              dateTime={pair.before_date}
            />
            <SarFigure
              src={urls.after}
              alt={format(t(copy.afterAlt, locale), { date: afterDate })}
              caption={format(t(copy.afterCaption, locale), { date: afterDate })}
              dateTime={pair.after_date}
            />
          </div>

          <SourceCitation
            source={pair.source}
            detail={
              <span className="break-all">
                {format(t(copy.scenePairDetail, locale), {
                  before: pair.before_scene_id,
                  after: pair.after_scene_id,
                })}
              </span>
            }
            date={pair.before_date}
            dateEnd={pair.after_date}
            note={
              filter
                ? format(t(copy.despeckleNote, locale), {
                    window: `${fmt(filter.width)}×${fmt(filter.height)}`,
                  })
                : pair.despeckle_note
            }
            lang={locale}
            className="lg:max-w-wide"
          />
        </div>
      </section>

      {/* 02: the difference map and its stats */}
      <section aria-labelledby="change-heading" className="frame">
        <div className="flex flex-col gap-6 border-t border-rule py-section-tight">
          <SectionLabel index={2}>{t(copy.changeLabel, locale)}</SectionLabel>
          <h2 id="change-heading" className="type-h2 max-w-column">
            {t(copy.changeHeading, locale)}
          </h2>
          <p className="type-body max-w-column text-ink-muted">{t(copy.changeBody, locale)}</p>

          <div className="grid grid-cols-1 gap-x-gutter gap-y-10 lg:grid-cols-12">
            <figure className="flex flex-col gap-3 lg:col-span-7">
              <Image
                src={urls.diff}
                width={SAR_IMAGE_SIZE.width}
                height={SAR_IMAGE_SIZE.height}
                unoptimized
                alt={format(t(copy.diffAlt, locale), { before: beforeDate, after: afterDate })}
                className="block h-auto w-full border border-rule"
              />
              <figcaption className="type-meta flex flex-col gap-1 text-ink-muted sm:flex-row sm:flex-wrap sm:gap-x-4">
                <span>{t(copy.legendRed, locale)}</span>
                <span>{t(copy.legendBlue, locale)}</span>
                <span>{t(copy.legendNeutral, locale)}</span>
              </figcaption>
            </figure>

            <div className="flex flex-col gap-8 lg:col-span-5">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-3 lg:grid-cols-1">
                <StatCallout
                  size="md"
                  value={pair.mean_diff_db}
                  decimals={2}
                  prefix={pair.mean_diff_db > 0 ? "+" : undefined}
                  suffix=" dB"
                  locale={locale}
                  label={t(copy.statMeanLabel, locale)}
                  source={format(t(copy.statPixelsSource, locale), {
                    count: fmt(pair.valid_pixel_count),
                  })}
                />
                <StatCallout
                  size="md"
                  value={pair.pct_pixels_dropped_gt3db}
                  decimals={2}
                  suffix="%"
                  locale={locale}
                  label={t(copy.statDroppedLabel, locale)}
                />
                <StatCallout
                  size="md"
                  value={pair.pct_pixels_risen_gt3db}
                  decimals={2}
                  suffix="%"
                  locale={locale}
                  label={t(copy.statRisenLabel, locale)}
                />
              </div>
              <SourceCitation
                source={pair.source}
                date={pair.before_date}
                dateEnd={pair.after_date}
                note={t(copy.thresholdNote, locale)}
                lang={locale}
              />
              {pair.coverage_note && (
                <figure className="flex flex-col gap-2">
                  <figcaption className="type-eyebrow text-ink-muted">
                    {t(copy.manifestNoteLabel, locale)}
                  </figcaption>
                  <blockquote lang="en" className="type-small border-l-2 border-rule pl-4 text-ink-muted">
                    {pair.coverage_note}
                  </blockquote>
                </figure>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 03: the July 2026 event */}
      <section aria-labelledby="july-heading" className="frame">
        <div className="flex flex-col gap-6 border-t border-rule py-section-tight">
          <SectionLabel index={3}>{t(copy.julyLabel, locale)}</SectionLabel>
          <h2 id="july-heading" className="type-h2 max-w-column">
            {t(copy.julyHeading, locale)}
          </h2>
          {eventWindow && days.length > 0 && (
            <p className="type-body max-w-column text-ink-muted">
              {format(t(copy.julyBody, locale), {
                start: formatCitationDate(eventWindow.start),
                end: formatCitationDate(eventWindow.end),
                passes: fmt(passes.length),
                first: formatCitationDate(days[0].date),
                last: formatCitationDate(days[days.length - 1].date),
              })}
            </p>
          )}

          <h3 className="type-h3 mt-4">{t(copy.radarPassesHeading, locale)}</h3>
          <ol className="grid grid-cols-2 gap-gutter sm:grid-cols-3 lg:grid-cols-5">
            {passes.map((pass) => {
              const date = formatCitationDate(pass.date);
              const blind = blackoutSet.has(pass.date);
              return (
                <li key={pass.scene_id}>
                  <figure className="flex flex-col gap-2">
                    <Image
                      src={urls.sarPass(pass.file)}
                      width={SAR_IMAGE_SIZE.width}
                      height={SAR_IMAGE_SIZE.height}
                      unoptimized
                      alt={format(t(copy.radarPassAlt, locale), { date })}
                      className={`block h-auto w-full ${blind ? "border-2 border-ink" : "border border-rule"}`}
                    />
                    <figcaption className="flex flex-col gap-1">
                      <time dateTime={pass.date} className="type-meta text-ink">
                        {date}
                      </time>
                      {blind && (
                        <span className="type-meta font-medium text-ink">
                          {t(copy.radarPassDuringBlackout, locale)}
                        </span>
                      )}
                    </figcaption>
                  </figure>
                </li>
              );
            })}
          </ol>
          {passes.length > 0 && (
            <SourceCitation
              source={pair.source}
              detail={
                <span className="break-all">
                  {format(t(copy.radarScenesDetail, locale), {
                    ids: passes.map((pass) => pass.scene_id).join(", "),
                  })}
                </span>
              }
              date={passes[0].date}
              dateEnd={passes[passes.length - 1].date}
              lang={locale}
            />
          )}

          <h3 className="type-h3 mt-8">{t(copy.dailyHeading, locale)}</h3>
          <p className="type-body max-w-column text-ink-muted">{t(copy.dailyBody, locale)}</p>
          <DailyStrip pack={pack} locale={locale} />

          {blackoutStart && blackoutEnd && (
            <div className="mt-8 flex max-w-column flex-col gap-4 border-t-2 border-ink pt-4">
              <h3 className="type-h3">
                {format(t(copy.blackoutHeading, locale), { count: fmt(blackoutDays.length) })}
              </h3>
              <p className="type-body text-ink-muted">
                {format(t(copy.blackoutBody, locale), {
                  start: formatCitationDate(blackoutStart),
                  end: formatCitationDate(blackoutEnd),
                  dates: radarThroughGap.map((pass) => formatCitationDate(pass.date)).join(", "),
                })}
              </p>
              {/* The manifest's own note, verbatim, so the claim above is
                  checkable against the record the pipeline wrote. */}
              <figure className="flex flex-col gap-2">
                <figcaption className="type-eyebrow text-ink-muted">
                  {t(copy.manifestNoteLabel, locale)}
                </figcaption>
                <blockquote lang="en" className="type-small border-l-2 border-rule pl-4 text-ink-muted">
                  {timeline.optical_blackout_note}
                </blockquote>
              </figure>
            </div>
          )}

          <div className="mt-8 flex max-w-column flex-col gap-3 border-t border-rule pt-4">
            <h3 className="type-h3">{t(copy.methodHeading, locale)}</h3>
            <p className="type-small text-ink-muted">{t(copy.methodBody, locale)}</p>
          </div>
        </div>
      </section>

      {/* 04: concept preview, not real data */}
      <ConceptPreview locale={locale} index={4} />
    </main>
  );
}

function SarFigure({
  src,
  alt,
  caption,
  dateTime,
}: {
  src: string;
  alt: string;
  caption: string;
  dateTime: string;
}) {
  return (
    <figure className="flex flex-col gap-2">
      <Image
        src={src}
        width={SAR_IMAGE_SIZE.width}
        height={SAR_IMAGE_SIZE.height}
        unoptimized
        alt={alt}
        className="block h-auto w-full border border-rule"
      />
      <figcaption className="type-meta text-ink">
        <time dateTime={dateTime}>{caption}</time>
      </figcaption>
    </figure>
  );
}
