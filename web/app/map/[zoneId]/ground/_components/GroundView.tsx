"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { formatCitationDate } from "@/app/components";
import { prefersReducedMotion } from "@/lib/design-tokens";
import { format, t, zoneDisplayName } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";
import { severityToBand } from "@/lib/types";
import { useMapData } from "../../../_lib/useMapData";
import { dateRangeOfEvents, isoToDayIndex, zoneEventHistory } from "../../../_lib/severity";
import { ExploreScrubber } from "../../_components/ExploreScrubber";
import { GroundBoundary } from "./GroundBoundary";
import { ControlsLegend, ControlsToggle, JoystickLayer, SeverityReadout } from "./GroundHud";
import { GroundScene } from "./GroundScene";
import type { RealTerrain } from "../_lib/realTerrain";
import { severityAtDay, type RealDataStop } from "../_lib/terrain";
import { useCoarsePointer, useGroundQuality } from "./useDeviceProfile";
import { useRealTerrain } from "./useRealTerrain";
import { useWalkInput } from "./useWalkInput";

/** Title/body for the HUD card shown when the visitor is near a real-data
 *  stop (_lib/terrain.ts realTerrainStops), filled from that zone's real
 *  ground-data meta rather than any invented number. */
function stopCopy(stop: RealDataStop, realTerrain: RealTerrain, locale: Locale): { title: string; body: string } {
  const copy = translations.groundView;
  if (stop.kind === "disturbance") {
    const areaHa = (realTerrain.disturbanceComponentPx / 100).toFixed(1);
    return {
      title: t(copy.realStopDisturbanceTitle, locale),
      body: format(t(copy.realStopDisturbanceBody, locale), {
        areaHa,
        before: formatCitationDate(realTerrain.sarBeforeDate),
        after: formatCitationDate(realTerrain.sarAfterDate),
      }),
    };
  }
  return {
    title: t(copy.realStopSlopeTitle, locale),
    body: format(t(copy.realStopSlopeBody, locale), { degrees: String(stop.slopeDegrees ?? 0) }),
  };
}

/** How long the "?" button keeps the controls legend open. */
const LEGEND_PIN_MS = 8000;

/** HUD cards sit 12px from each edge, or further in past a device notch. */
const EDGE = {
  left: "max(0.75rem, env(safe-area-inset-left))",
  right: "max(0.75rem, env(safe-area-inset-right))",
  top: "max(0.75rem, env(safe-area-inset-top))",
  bottom: "max(0.75rem, env(safe-area-inset-bottom))",
};

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
 *
 * The HUD is kept small so the scene stays the view: a name card, a severity
 * readout, a controls legend that fades once the visitor moves, and one
 * compact bottom card holding the required disclosure caption and the time
 * slider.
 */
export function GroundView({ zoneId, locale }: GroundViewProps) {
  const { zones, events, loading, error } = useMapData(locale);
  const { data: realTerrain, loading: realTerrainLoading } = useRealTerrain(zoneId);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());
  const [nearStop, setNearStop] = useState<RealDataStop | null>(null);

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
  // The scene rebuilds terrain and forest state per severity change. Deferring
  // it keeps the slider thumb and readout immediate during a fast scrub and
  // lets React drop intermediate values the scene has no time to draw.
  const sceneSeverity = useDeferredValue(severity);

  const dayRange = useMemo(() => {
    const bounds = dateRangeOfEvents(history);
    return { min: isoToDayIndex(bounds.low), max: isoToDayIndex(bounds.high) };
  }, [history]);

  // Q / E (and [ / ]) step time by about 1/60 of the slider's range.
  const stepTime = useCallback(
    (direction: -1 | 1) => {
      if (history.length === 0) return;
      const step = Math.max(1, Math.round((dayRange.max - dayRange.min) / 60));
      setSelectedDay((current) => {
        const from = current ?? defaultDay;
        return Math.min(dayRange.max, Math.max(dayRange.min, from + direction * step));
      });
    },
    [history.length, dayRange, defaultDay],
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const { hostRef, inputRef, joystick, locked, interacted, touchSeen } = useWalkInput({
    onStepTime: stepTime,
    avoidRef: cardRef,
  });
  const coarse = useCoarsePointer();
  const touchUi = coarse || touchSeen;
  const quality = useGroundQuality();
  const [webglFailed, setWebglFailed] = useState(false);
  const onContextFailed = useCallback(() => setWebglFailed(true), []);

  // Controls legend: open until the visitor starts moving; the "?" button
  // reopens it for a few seconds. `dismissed` records a close before moving.
  const [legendPinned, setLegendPinned] = useState(false);
  const [legendDismissed, setLegendDismissed] = useState(false);
  const legendVisible = legendPinned || (!interacted && !legendDismissed);
  useEffect(() => {
    if (!legendPinned) return;
    const timer = setTimeout(() => setLegendPinned(false), LEGEND_PIN_MS);
    return () => clearTimeout(timer);
  }, [legendPinned]);
  const toggleLegend = () => {
    if (legendVisible) {
      setLegendPinned(false);
      setLegendDismissed(true);
    } else {
      setLegendPinned(true);
    }
  };

  if (error) {
    return (
      <GroundMessage locale={locale}>
        <p className="type-small text-paper">{error}</p>
      </GroundMessage>
    );
  }

  if (loading || realTerrainLoading || !zones) return null;

  if (!zone) {
    return (
      <GroundMessage locale={locale}>
        <p className="type-small text-paper">
          {t(translations.zoneExplore.notFoundHeading, locale)}
        </p>
      </GroundMessage>
    );
  }

  const unavailable = (
    <GroundMessage locale={locale}>
      <p className="type-small max-w-md text-paper">
        {t(translations.groundView.webglUnavailable, locale)}
      </p>
    </GroundMessage>
  );
  if (webglFailed) return unavailable;

  const name = zoneDisplayName(zone.properties, locale);
  const copy = translations.groundView;
  const nearStopCopy = nearStop && realTerrain ? stopCopy(nearStop, realTerrain, locale) : null;
  const showPrompt = !interacted && (touchUi || !locked);
  // Before the zone's first recorded event there is nothing to estimate.
  const recorded = history.length > 0 && day >= isoToDayIndex(history[0].dateRangeEnd);

  return (
    <GroundBoundary fallback={unavailable}>
      <div className="relative h-[calc(100dvh-var(--spacing-header))] overflow-hidden bg-ink">
        {/* The host owns the scene's pointer events: pointer lock is only
            requested from clicks here, never from the HUD cards, and
            touch-none keeps a finger on the scene from scrolling or zooming. */}
        <div
          ref={hostRef}
          className="absolute inset-0 touch-none select-none overscroll-none [-webkit-tap-highlight-color:transparent] [-webkit-touch-callout:none]"
        >
          <GroundScene
            zoneId={zoneId}
            severity={sceneSeverity}
            reducedMotion={reducedMotion}
            inputRef={inputRef}
            quality={quality}
            onContextFailed={onContextFailed}
            realTerrain={realTerrain}
            onNearStopChange={setNearStop}
          />
        </div>

        <JoystickLayer {...joystick} />

        {locked && (
          <div
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-1/2 z-10 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-paper/80 ring-1 ring-ink/40"
          />
        )}

        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 px-3">
          {showPrompt && (
            <p className="type-small rounded-xs bg-ink/60 px-4 py-2 text-paper">
              {t(touchUi ? copy.walkPromptTouch : copy.walkPrompt, locale)}
            </p>
          )}
          {touchUi && (
            <ControlsLegend
              locale={locale}
              touchUi
              visible={legendVisible}
              locked={locked}
              reducedMotion={reducedMotion}
            />
          )}
        </div>

        <div
          className="absolute z-10 flex max-w-[55%] flex-col rounded-xs bg-surface/95 px-3 py-2 shadow-map"
          style={{ left: EDGE.left, top: EDGE.top }}
        >
          <Link href={`/map/${zoneId}`} className="type-meta self-start py-0.5 text-ink-muted hover:text-river">
            {t(translations.zoneExplore.backToMap, locale)}
          </Link>
          <h1 className="type-small font-semibold leading-snug">{name}</h1>
        </div>

        <div
          className="absolute z-10 flex flex-col items-end gap-2"
          style={{ right: EDGE.right, top: EDGE.top }}
        >
          {history.length > 0 && (
            <SeverityReadout locale={locale} band={severityToBand(severity).band} recorded={recorded} />
          )}
          <ControlsToggle locale={locale} pressed={legendVisible} onToggle={toggleLegend} />
        </div>

        <div
          className="pointer-events-none absolute z-10 flex flex-col items-center gap-2 sm:mx-auto sm:max-w-md"
          style={{ left: EDGE.left, right: EDGE.right, bottom: EDGE.bottom }}
        >
          {!touchUi && (
            <ControlsLegend
              locale={locale}
              touchUi={false}
              visible={legendVisible}
              locked={locked}
              reducedMotion={reducedMotion}
            />
          )}
          {nearStopCopy && (
            <div className="pointer-events-none w-full rounded-xs bg-ink/80 px-3 py-2 text-paper">
              <p className="type-meta text-paper/80">{nearStopCopy.title}</p>
              <p className="text-[0.8125rem] leading-[1.4]">{nearStopCopy.body}</p>
            </div>
          )}
          <div
            ref={cardRef}
            className="pointer-events-auto flex w-full flex-col gap-2 rounded-xs bg-surface/95 px-3 py-2.5 shadow-map"
          >
            <p className="text-[0.8125rem] leading-[1.45] text-ink-muted [&:lang(bn)]:leading-[1.6]">
              {format(t(realTerrain ? copy.captionReal : copy.caption, locale), { name })}
            </p>

            {history.length === 0 ? (
              <p className="type-meta text-ink-subtle">
                {t(translations.zoneExplore.noHistory, locale)}
              </p>
            ) : (
              <ExploreScrubber
                locale={locale}
                history={history}
                day={day}
                onChangeAction={setSelectedDay}
                compact
              />
            )}
          </div>
        </div>
      </div>
    </GroundBoundary>
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
