"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, ZoneFeatureCollection } from "@/lib/types";

interface MapData {
  zones: ZoneFeatureCollection | null;
  events: ChangeEvent[];
  loading: boolean;
  error: string | null;
}

/**
 * Fetches /api/zones and /api/change-events once, client-side. The map
 * needs the browser regardless (MapLibre), so there is no benefit to
 * fetching this on the server first; this keeps the whole data path in one
 * place instead of splitting it across a server wrapper and a client
 * re-fetch.
 */
export function useMapData(): MapData {
  const [zones, setZones] = useState<ZoneFeatureCollection | null>(null);
  const [events, setEvents] = useState<ChangeEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [zonesRes, eventsRes] = await Promise.all([
          fetch("/api/zones"),
          fetch("/api/change-events"),
        ]);
        if (!zonesRes.ok || !eventsRes.ok) {
          throw new Error("The map data service did not respond.");
        }
        const zonesJson = (await zonesRes.json()) as ZoneFeatureCollection;
        const eventsJson = (await eventsRes.json()) as ChangeEvent[];
        if (!cancelled) {
          setZones(zonesJson);
          setEvents(eventsJson);
        }
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Could not load zone data.",
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

  return { zones, events, loading, error };
}
