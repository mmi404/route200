"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, ZoneFeatureCollection } from "@/lib/types";
import { t } from "@/lib/i18n";
import type { Locale } from "@/lib/locale";
import { translations } from "@/lib/translations";

interface MapData {
  zones: ZoneFeatureCollection | null;
  events: ChangeEvent[];
  loading: boolean;
  error: string | null;
}

// A narrow "what went wrong" kind, not the user-facing text itself: the
// fetch effect below runs once and never needs to re-run when the locale
// toggle changes, so the actual localized message is produced at return
// time from this kind instead of being baked into state at catch time.
type ErrorKind = "service" | "unknown";

/**
 * Fetches /api/zones and /api/change-events once, client-side. The map
 * needs the browser regardless (MapLibre), so there is no benefit to
 * fetching this on the server first; this keeps the whole data path in one
 * place instead of splitting it across a server wrapper and a client
 * re-fetch.
 */
export function useMapData(locale: Locale = "bn"): MapData {
  const [zones, setZones] = useState<ZoneFeatureCollection | null>(null);
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorKind, setErrorKind] = useState<ErrorKind | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [zonesRes, eventsRes] = await Promise.all([
          fetch("/api/zones"),
          fetch("/api/change-events"),
        ]);
        if (!zonesRes.ok || !eventsRes.ok) {
          throw new Error("service-unavailable");
        }
        const zonesJson = (await zonesRes.json()) as ZoneFeatureCollection;
        const eventsJson = (await eventsRes.json()) as ChangeEvent[];
        if (!cancelled) {
          setZones(zonesJson);
          setEvents(eventsJson);
        }
      } catch (err) {
        if (!cancelled) {
          setErrorKind(
            err instanceof Error && err.message === "service-unavailable"
              ? "service"
              : "unknown",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const error = errorKind
    ? t(
        errorKind === "service"
          ? translations.mapPage.errorServiceDidNotRespond
          : translations.mapPage.errorFallback,
        locale,
      )
    : null;

  return { zones, events, loading, error };
}
