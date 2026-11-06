"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { prefersReducedMotion } from "@/lib/design-tokens";
import { format, t, zoneDisplayName } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import { useMapData } from "../../../_lib/useMapData";
import { isoToDayIndex, zoneEventHistory } from "../../../_lib/severity";
import { ExploreScrubber } from "../../_components/ExploreScrubber";
import { GroundScene } from "./GroundScene";
import { severityAtDay } from "../_lib/terrain";

type GroundViewProps = {
  zoneId: string;
  locale: Locale;
};

/**
 * Client orchestrator for /map/[zoneId]/ground (PROGRESS.md, "Phase 3:
 * Ground View"). Fetches the same zone/event data the 2D map and the
 * phase-2 terrain page both use, and reuses that page's ExploreScrubber
 * component directly rather than building a second slider: the only new
 * thing here is GroundScene, the stylized walkable 3D scene itself.
 */
export function GroundView({ zoneId, locale }: GroundViewProps) {
  const { zones, events, loading, error } = useMapData(locale);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const zone = zones?.features.find((feature) => feature.properties.id === zoneId) ?? null;
  const history = useMemo(() => zoneEventHistory(events, zoneId), [events, zoneId]);

  const defaultDay = history.length
    ? isoToDayIndex(history[history.length - 1].dateRangeEnd)
    : isoToDayIndex(new Date().toISOString().slice(0, 10));
  const day = selectedDay ?? defaultDay;
  const severity = useMemo(() => severityAtDay(history, day), [history, day]);

  if (error) {
    return (
      <GroundMessage locale={locale}>
        <p className="type-small text-paper">{error}</p>
      </GroundMessage>
    );
  }

  if (loading || !zones) return null;

  if (!zone) {
    return (
      <GroundMessage locale={locale}>
        <p className="type-small text-paper">
          {t(translations.zoneExplore.notFoundHeading, locale)}
        </p>
      </GroundMessage>
    );
  }

  const name = zoneDisplayName(zone.properties, locale);

  return (
    <div className="relative h-[calc(100dvh-var(--spacing-header))] overflow-hidden bg-ink">
      <GroundScene zoneId={zoneId} severity={severity} reducedMotion={reducedMotion} />

      <div className="absolute left-4 top-4 z-10 flex max-w-[calc(100%-2rem)] flex-col gap-2 rounded-xs bg-surface/95 px-4 py-3 shadow-map">
        <Link href={`/map/${zoneId}`} className="type-small self-start text-ink-muted hover:text-river">
          {t(translations.zoneExplore.backToMap, locale)}
        </Link>
        <h1 className="type-h3">{name}</h1>
        <p className="type-meta text-ink-subtle">{t(translations.groundView.dragHint, locale)}</p>
      </div>

      <div className="absolute inset-x-4 bottom-10 z-10 flex flex-col gap-3 rounded-xs bg-surface/95 px-4 py-4 shadow-map sm:bottom-4 sm:mx-auto sm:max-w-xl">
        <p className="type-small text-ink-muted">
          {format(t(translations.groundView.caption, locale), { name })}
        </p>

        {history.length === 0 ? (
          <p className="type-meta text-ink-subtle">
            {t(translations.zoneExplore.noHistory, locale)}
          </p>
        ) : (
          <ExploreScrubber locale={locale} history={history} day={day} onChangeAction={setSelectedDay} />
        )}
      </div>
    </div>
  );
}

function GroundMessage({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <div className="flex h-[calc(100dvh-var(--spacing-header))] flex-col items-center justify-center gap-4 bg-ink px-gutter text-center">
      {children}
      <Link href="/map" className="type-small text-paper underline">
        {t(translations.zoneExplore.backToMap, locale)}
      </Link>
    </div>
  );
}
