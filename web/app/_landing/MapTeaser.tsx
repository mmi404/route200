"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ButtonLink,
  SectionLabel,
  SeverityScale,
  SourceCitation,
} from "@/app/components";
import { useMapData } from "@/app/map/_lib/useMapData";
import { dateRangeOfEvents, zoneStatus } from "@/app/map/_lib/severity";
import { MAP_STYLE, prefersReducedMotion } from "@/lib/design-tokens";
import { MapCanvas, type CameraTarget, type StyledZoneFeatureCollection } from "@/app/map/_components/MapCanvas";

const JAMUNA_CAMERA: CameraTarget = {
  kind: "point",
  center: MAP_STYLE.jamunaView.center,
  zoom: MAP_STYLE.jamunaView.zoom,
};
const HILL_CAMERA: CameraTarget = {
  kind: "point",
  center: MAP_STYLE.hillTractsView.center,
  zoom: MAP_STYLE.hillTractsView.zoom,
};

const STEP_CAMERAS: CameraTarget[] = [JAMUNA_CAMERA, HILL_CAMERA, HILL_CAMERA];

/**
 * Map teaser (DESIGN_SPEC.md 7a#4), the bridge into /map. A sticky,
 * non-interactive MapCanvas (reused from app/map, see MapCanvas's
 * `interactive`/`externalCamera` props) fills the viewport while three
 * text steps scroll over it: the copy's two paragraphs, then a closing
 * panel with the severity scale and the handoff CTA. Clicking through
 * opens /map at the camera this teaser ended on, so the transition reads
 * as continuous rather than a fresh load (DESIGN_SPEC.md: "/map?view=hill-tracts").
 */
export function MapTeaser() {
  const { zones, events } = useMapData();
  const [activeStep, setActiveStep] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(() => prefersReducedMotion());
  const stepRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(query.matches);
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number((entry.target as HTMLElement).dataset.stepIndex);
          if (!Number.isNaN(index)) setActiveStep(index);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );
    stepRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  const dateWindow = useMemo(
    () => (events.length ? dateRangeOfEvents(events) : null),
    [events],
  );

  const styledZones: StyledZoneFeatureCollection | null = useMemo(() => {
    if (!zones || !dateWindow) return null;
    return {
      type: "FeatureCollection",
      features: zones.features.map((feature) => ({
        ...feature,
        properties: {
          ...feature.properties,
          severity: zoneStatus(events, feature.properties.id, dateWindow).event?.severity,
        },
      })),
    };
  }, [zones, events, dateWindow]);

  const latestEvent = useMemo(() => {
    if (!events.length) return null;
    return events.reduce((latest, event) =>
      event.dateRangeEnd > latest.dateRangeEnd ? event : latest,
    );
  }, [events]);

  return (
    <section className="relative w-full">
      <div className="sticky top-0 h-[60svh] w-full sm:h-[calc(100dvh-var(--spacing-header))]">
        {styledZones && (
          <MapCanvas
            zones={styledZones}
            initialCamera={JAMUNA_CAMERA}
            externalCamera={STEP_CAMERAS[activeStep]}
            reducedMotion={reducedMotion}
            interactive={false}
          />
        )}
      </div>

      <div className="relative -mt-[60svh] flex flex-col sm:-mt-[calc(100dvh-var(--spacing-header))]">
        <div
          data-step-index={0}
          ref={(el) => {
            stepRefs.current[0] = el;
          }}
          className="flex min-h-[100svh] items-end px-gutter pb-10 sm:min-h-[calc(100dvh-var(--spacing-header))] sm:items-center sm:pb-0"
        >
          <div className="bg-surface max-w-[22rem] p-6 sm:max-w-[26rem] sm:p-8">
            <SectionLabel index={3} className="mb-4">
              The map
            </SectionLabel>
            <p className="type-body text-ink-muted">
              Open the map and the Jamuna isn&apos;t a static blue line.
              It&apos;s a river caught mid-motion, bank lines from different
              years laid over each other so you can watch, in minutes,
              erosion that actually unfolded over seasons. In the Chattogram
              Hill Tracts, slopes are shaded by how much ground has shifted,
              the kind of movement that preceded the 2026 monsoon landslides.
            </p>
          </div>
        </div>

        <div
          data-step-index={1}
          ref={(el) => {
            stepRefs.current[1] = el;
          }}
          className="flex min-h-[100svh] items-end px-gutter pb-10 sm:min-h-[calc(100dvh-var(--spacing-header))] sm:items-center sm:pb-0"
        >
          <div className="bg-surface max-w-[22rem] p-6 sm:max-w-[26rem] sm:p-8">
            <p className="type-body text-ink-muted">
              If your village sits on a Jamuna char, or your family&apos;s
              land is on a Chattogram hillside, this map is the closest thing
              to watching your own risk from orbit, in your own language.
            </p>
          </div>
        </div>

        <div
          data-step-index={2}
          ref={(el) => {
            stepRefs.current[2] = el;
          }}
          className="flex min-h-[100svh] items-end px-gutter pb-10 sm:min-h-[calc(100dvh-var(--spacing-header))] sm:items-center sm:pb-0"
        >
          <div className="bg-surface flex max-w-[22rem] flex-col gap-6 p-6 sm:max-w-[26rem] sm:p-8">
            <SeverityScale title="Change severity, engine score 0–100" markAlertThreshold />
            <ButtonLink href="/map?view=hill-tracts" size="lg">
              See the risk map
            </ButtonLink>
            {latestEvent && (
              <SourceCitation source={latestEvent.sourceScene} date={latestEvent.dateRangeEnd} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
