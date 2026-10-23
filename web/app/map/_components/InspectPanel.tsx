import { useEffect, useRef } from "react";
import {
  ButtonLink,
  formatStatNumber,
  SeverityBadge,
  SourceCitation,
  StatCallout,
} from "@/app/components";
import type { ZoneFeature } from "@/lib/types";
import { ZONE_KIND_LABEL } from "@/lib/design-tokens";
import { format, t, zoneDisplayName } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import type { ZoneStatus } from "../_lib/severity";
import { StripChart } from "./StripChart";
import type { ChangeEvent } from "@/lib/types";

type InspectPanelProps = {
  locale: Locale;
  zone: ZoneFeature;
  /** Severity within the currently selected date window. */
  status: ZoneStatus;
  /** The zone's full event history, for the strip chart. */
  history: ChangeEvent[];
  /**
   * True when this zone was just selected via keyboard (Enter on a focused
   * zone-list row). The row that had focus is unmounted the moment this
   * panel replaces the list, which would otherwise drop focus back to
   * <body>; this moves it onto the panel's own back button instead. Keyed
   * off the zone's id changing, not the render count, so it fires once per
   * new selection and never steals focus on an unrelated re-render (e.g.
   * the date window changing while this same zone stays selected).
   */
  autoFocusBack?: boolean;
  onBack: () => void;
  className?: string;
};

export function InspectPanel({
  locale,
  zone,
  status,
  history,
  autoFocusBack = false,
  onBack,
  className = "",
}: InspectPanelProps) {
  const copy = translations.mapPage;
  const { properties } = zone;
  const latest = status.event ?? history[history.length - 1];
  const backButtonRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (autoFocusBack) backButtonRef.current?.focus();
  }, [properties.id, autoFocusBack]);

  return (
    <div className={`flex flex-col gap-5 ${className}`}>
      <button
        ref={backButtonRef}
        type="button"
        onClick={onBack}
        className="type-small self-start text-ink-muted hover:text-river"
      >
        {t(copy.backToAllZones, locale)}
      </button>

      <div className="flex flex-col gap-2">
        <h2 className="type-h2">{zoneDisplayName(properties, locale)}</h2>
        <p className="type-meta text-ink-subtle">
          {properties.upazila}, {properties.district} ·{" "}
          {ZONE_KIND_LABEL[locale][properties.kind]}
        </p>
        {status.event ? (
          <SeverityBadge
            score={status.event.severity}
            variant="solid"
            showScore
            lang={locale}
          />
        ) : (
          <span className="type-meta inline-flex h-6 items-center gap-2 rounded-xs bg-nodata px-2 font-medium text-ink">
            {t(copy.noDataInWindow, locale)}
          </span>
        )}
      </div>

      {status.event ? (
        <StatCallout
          size="md"
          value={status.event.areaSqKm}
          decimals={2}
          suffix=" km²"
          locale={locale}
          label={t(copy.areaChangedLabel, locale)}
          countUp={false}
        />
      ) : (
        <p className="type-small text-ink-subtle">{t(copy.noEventInWindow, locale)}</p>
      )}

      <StripChart locale={locale} events={history} />

      <p className="type-small text-ink-muted">
        {format(t(copy.registeredAlertCount, locale), {
          count: formatStatNumber(properties.registeredAlertCount, { locale }),
        })}
      </p>

      {latest && (
        <SourceCitation
          source={latest.sourceScene}
          date={latest.dateRangeStart}
          dateEnd={latest.dateRangeEnd}
          note={t(copy.decisionSupportNote, locale)}
          lang={locale}
        />
      )}

      <ButtonLink href={`/alerts?zone=${properties.id}`} size="md">
        {t(copy.getAlertsForThisZone, locale)}
      </ButtonLink>
    </div>
  );
}
