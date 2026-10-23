import { formatStatNumber, SeverityBadge, SeverityScale } from "@/app/components";
import { ZONE_KIND_LABEL } from "@/lib/design-tokens";
import { t, zoneDisplayName } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import type {
  DateWindow,
  KindFilter,
  ZoneListEntry,
} from "../_lib/severity";
import { DateRangeSlider } from "./DateRangeSlider";

type SeverityCounts = Partial<Record<"low" | "moderate" | "high" | "severe", number>>;

type ZoneListPanelProps = {
  locale: Locale;
  kindFilter: KindFilter;
  onKindFilterChangeAction: (value: KindFilter) => void;
  dataRange: DateWindow;
  dateWindow: DateWindow;
  onDateWindowChangeAction: (window: DateWindow) => void;
  counts: SeverityCounts;
  entries: ZoneListEntry[];
  hoveredZoneId: string | null;
  onHoverZoneAction: (id: string | null) => void;
  /** `viaKeyboard` is true when the row was activated by Enter/Space
   *  rather than a pointer click (a synthetic click from a key press has
   *  `detail: 0`; a real pointer click has `detail >= 1`), so the caller
   *  can move focus into the inspect panel only for a keyboard selection. */
  onSelectZoneAction: (id: string, viaKeyboard?: boolean) => void;
  className?: string;
};

/**
 * The filters, date window and zone list that make up the rail's default
 * ("all zones") content. Shared verbatim between the desktop ZoneRail and
 * the mobile MobileSheet, per DESIGN_SPEC.md ("Mobile ... Inspect content
 * uses the same sheet"): one implementation of the list, two containers.
 */
export function ZoneListPanel({
  locale,
  kindFilter,
  onKindFilterChangeAction,
  dataRange,
  dateWindow,
  onDateWindowChangeAction,
  counts,
  entries,
  hoveredZoneId,
  onHoverZoneAction,
  onSelectZoneAction,
  className = "",
}: ZoneListPanelProps) {
  const kindLabels = ZONE_KIND_LABEL[locale];
  const kindOptions: { value: KindFilter; label: string }[] = [
    { value: "all", label: t(translations.mapPage.kindFilterAll, locale) },
    { value: "erosion", label: kindLabels.erosion },
    { value: "landslide", label: kindLabels.landslide },
  ];

  return (
    <div className={`flex flex-col gap-6 ${className}`}>
      {/* overflow-hidden clips each button's own focus-visible outline,
          since the default outline-offset (2px, set globally) draws it
          outside the button's box and into the clipped region. Each button
          pulls its outline inward instead (focus-visible:outline-offset-
          [-2px]) so it stays inside the clip and is actually visible on
          focus. Same fix as FloatingControls.tsx's zoom buttons. */}
      <div
        className="grid grid-cols-3 overflow-hidden rounded-xs border border-rule"
        role="group"
        aria-label={t(translations.mapPage.kindFilterGroupAriaLabel, locale)}
      >
        {kindOptions.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kindFilter === option.value}
            onClick={() => onKindFilterChangeAction(option.value)}
            className={`type-small border-r border-rule px-2 py-2 text-center last:border-r-0 focus-visible:outline-offset-[-2px] ${
              kindFilter === option.value
                ? "bg-river-tint font-medium text-river"
                : "text-ink-muted hover:bg-well"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      <DateRangeSlider
        locale={locale}
        bounds={dataRange}
        value={dateWindow}
        onChangeAction={onDateWindowChangeAction}
      />

      <SeverityScale
        orientation="vertical"
        title={t(translations.mapPage.severityScaleZonesTitle, locale)}
        counts={counts}
        lang={locale}
      />

      <ul className="flex flex-col border-t border-rule">
        {entries.map(({ feature, status }) => {
          const { id, district, kind } = feature.properties;
          const name = zoneDisplayName(feature.properties, locale);
          return (
            <li key={id} className="border-b border-rule">
              <button
                type="button"
                onMouseEnter={() => onHoverZoneAction(id)}
                onMouseLeave={() => onHoverZoneAction(null)}
                onClick={(event) => onSelectZoneAction(id, event.detail === 0)}
                className={`flex w-full flex-col gap-1 px-1 py-3 text-left transition-colors duration-(--duration-fast) ease-editorial ${
                  hoveredZoneId === id ? "bg-well" : ""
                }`}
              >
                <span className="flex items-center justify-between gap-3">
                  <span className="type-h3">{name}</span>
                  {status.band === "nodata" ? (
                    <span className="type-meta inline-flex items-center gap-1.5 font-medium text-ink-subtle">
                      <span
                        aria-hidden="true"
                        className="size-2.5 shrink-0 bg-nodata ring-1 ring-ink/25 ring-inset"
                      />
                      {t(translations.common.noData, locale)}
                    </span>
                  ) : (
                    <SeverityBadge score={status.event?.severity ?? 0} showScore lang={locale} />
                  )}
                </span>
                <span className="type-meta text-ink-subtle">
                  {feature.properties.upazila}, {district} · {kindLabels[kind]}
                  {status.event
                    ? ` · ${formatStatNumber(status.event.areaSqKm, { decimals: 2, grouping: false, locale })} km²`
                    : ""}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
