import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";
import { formatCitationDate, formatStatNumber, SourceCitation } from "@/app/components";
import { format, t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import { DAILY_TILE_SIZE, evidenceImageUrls, type EvidencePack } from "../_lib/packs";
import { contiguousRuns, dayOfMonth, parseEventWindow } from "../_lib/timeline";

type DailyStripProps = {
  pack: EvidencePack;
  locale: Locale;
};

/**
 * The July day-by-day strip: one column per manifest day, rows for the
 * optical tile, its rough cloud share, the rainfall tile and whether a
 * radar pass came over. Direct-labelled like StripChart.tsx (no hover-only
 * tooltip): the disaster window and the optical blackout are drawn as
 * brackets over the exact columns they cover, computed from the manifest.
 *
 * Days with `optical_available: false` get an explicit hatched "none" tile,
 * never the black PNG the download produced for them, which would read as
 * a real (night-time or burnt) photo.
 *
 * Wider than a phone, so it scrolls sideways inside its own box with the
 * row labels pinned; the page itself never scrolls horizontally.
 */
export function DailyStrip({ pack, locale }: DailyStripProps) {
  const copy = translations.zoneEvidence;
  const timeline = pack.manifest.july_event_timeline;
  const days = timeline.daily_optical_precip;
  const urls = evidenceImageUrls(pack);

  if (days.length === 0) return null;

  const eventWindow = parseEventWindow(timeline.event_window);
  const windowRuns = eventWindow
    ? contiguousRuns(
        days.map((day) => day.date >= eventWindow.start && day.date <= eventWindow.end),
      )
    : [];
  const blackoutRuns = contiguousRuns(days.map((day) => !day.optical_available));
  const passDates = new Set(timeline.sar_passes.map((pass) => pass.date));

  // Column 1 is the row label; day i sits in grid column i + 2.
  const gridStyle: CSSProperties = {
    gridTemplateColumns: `minmax(7.5rem, max-content) repeat(${days.length}, minmax(2.75rem, 1fr))`,
  };
  const spanColumns = (run: { start: number; end: number }): CSSProperties => ({
    gridColumn: `${run.start + 2} / ${run.end + 3}`,
  });

  return (
    <figure className="flex flex-col gap-3">
      {/* relative: the sr-only labels inside are absolutely positioned, and
          without a positioned scroll box they escape its clipping and
          widen the whole page on a phone. */}
      <div className="relative overflow-x-auto pb-2">
        <div className="grid items-end gap-x-1 gap-y-2" style={gridStyle}>
          {/* Row 1: the disaster window bracket. */}
          <RowLabel row={1} />
          {windowRuns.map((run) => (
            <div key={`window-${run.start}`} className="flex flex-col gap-1" style={{ ...spanColumns(run), gridRow: 1 }}>
              <span className="type-meta whitespace-nowrap font-medium text-ink">
                {t(copy.eventWindowBracket, locale)}
              </span>
              <span aria-hidden="true" className="h-2 border-x-2 border-t-2 border-ink" />
            </div>
          ))}

          {/* Row 2: day of month, direct labels. */}
          <RowLabel row={2}>{t(copy.rowDay, locale)}</RowLabel>
          {days.map((day, index) => {
            const inWindow = windowRuns.some((run) => index >= run.start && index <= run.end);
            return (
              <time
                key={`day-${day.date}`}
                dateTime={day.date}
                title={formatCitationDate(day.date)}
                className={`type-meta text-center ${inWindow ? "font-medium text-ink" : "text-ink-subtle"}`}
                style={{ gridColumn: index + 2, gridRow: 2 }}
              >
                {formatStatNumber(dayOfMonth(day.date), { locale, grouping: false })}
              </time>
            );
          })}

          {/* Row 3: optical tiles, or an explicit no-coverage tile. */}
          <RowLabel row={3}>{t(copy.rowOptical, locale)}</RowLabel>
          {days.map((day, index) => {
            const date = formatCitationDate(day.date);
            return (
              <div key={`optical-${day.date}`} style={{ gridColumn: index + 2, gridRow: 3 }}>
                {day.optical_available ? (
                  <Image
                    src={urls.optical(day.date)}
                    width={DAILY_TILE_SIZE.width}
                    height={DAILY_TILE_SIZE.height}
                    unoptimized
                    alt={format(t(copy.opticalAlt, locale), { date })}
                    title={date}
                    className="block h-auto w-full"
                  />
                ) : (
                  <NoCoverageTile
                    label={t(copy.noCoverageTile, locale)}
                    title={format(t(copy.noCoverageTileTitle, locale), { date })}
                  />
                )}
              </div>
            );
          })}

          {/* Row 4: the blackout bracket, directly under the tiles it names. */}
          <RowLabel row={4} />
          {blackoutRuns.map((run) => (
            <div key={`blackout-${run.start}`} className="flex flex-col gap-1" style={{ ...spanColumns(run), gridRow: 4 }}>
              <span aria-hidden="true" className="h-2 border-x-2 border-b-2 border-ink" />
              <span className="type-meta whitespace-nowrap font-medium text-ink">
                {t(copy.blackoutBracket, locale)}
              </span>
            </div>
          ))}

          {/* Row 5: rough cloud share. Blank (not 0) on blackout days. */}
          <RowLabel row={5}>{t(copy.rowCloud, locale)}</RowLabel>
          {days.map((day, index) => (
            <span
              key={`cloud-${day.date}`}
              className="type-meta text-center text-ink-muted"
              style={{ gridColumn: index + 2, gridRow: 5 }}
            >
              {day.cloud_fraction === null
                ? ""
                : `${formatStatNumber(Math.round(day.cloud_fraction * 100), { locale })}%`}
            </span>
          ))}

          {/* Row 6: rainfall tiles, real on every day including the blackout. */}
          <RowLabel row={6}>{t(copy.rowRain, locale)}</RowLabel>
          {days.map((day, index) => (
            <div key={`rain-${day.date}`} style={{ gridColumn: index + 2, gridRow: 6 }}>
              <Image
                src={urls.precip(day.date)}
                width={DAILY_TILE_SIZE.width}
                height={DAILY_TILE_SIZE.height}
                unoptimized
                alt={format(t(copy.rainAlt, locale), { date: formatCitationDate(day.date) })}
                title={formatCitationDate(day.date)}
                // The IMERG tiles are transparent wherever the layer has
                // nothing to draw; the well backing keeps each tile's
                // extent visible so a mostly empty day doesn't read as a
                // missing image.
                className="block h-auto w-full bg-well"
              />
            </div>
          ))}

          {/* Row 7: which days a Sentinel-1 pass came over. */}
          <RowLabel row={7}>{t(copy.rowRadar, locale)}</RowLabel>
          {days.map((day, index) => (
            <span
              key={`radar-${day.date}`}
              className="flex h-4 items-center justify-center"
              style={{ gridColumn: index + 2, gridRow: 7 }}
            >
              {passDates.has(day.date) && (
                <span
                  className="size-2.5 rounded-full bg-river"
                  title={format(t(copy.radarPassMark, locale), {
                    date: formatCitationDate(day.date),
                  })}
                >
                  <span className="sr-only">
                    {format(t(copy.radarPassMark, locale), { date: formatCitationDate(day.date) })}
                  </span>
                </span>
              )}
            </span>
          ))}
        </div>
      </div>

      <p className="type-meta text-ink-subtle sm:hidden">{t(copy.dailyScrollHint, locale)}</p>

      <SourceCitation
        as="figcaption"
        source={`${pack.opticalSource}; ${pack.precipSource}`}
        date={days[0].date}
        dateEnd={days[days.length - 1].date}
        note={t(copy.cloudProxyNote, locale)}
        lang={locale}
        className="max-w-column"
      />
    </figure>
  );
}

/** Pinned left so the row names stay readable while the strip scrolls. */
function RowLabel({ row, children }: { row: number; children?: ReactNode }) {
  return (
    <span
      className="type-meta sticky left-0 z-10 self-center bg-paper pr-3 text-ink-muted"
      style={{ gridColumn: 1, gridRow: row }}
    >
      {children}
    </span>
  );
}

function NoCoverageTile({ label, title }: { label: string; title: string }) {
  return (
    <div
      title={title}
      className="flex aspect-[4/3] w-full items-center justify-center bg-well ring-1 ring-inset ring-ink/25 [background-image:repeating-linear-gradient(135deg,var(--color-rule)_0_1.5px,transparent_1.5px_6px)]"
    >
      <span aria-hidden="true" className="type-meta bg-well px-0.5 text-ink-muted">
        {label}
      </span>
      <span className="sr-only">{title}</span>
    </div>
  );
}
