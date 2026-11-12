"use client";

import { useEffect, useState } from "react";
import { hasRealTerrain, loadRealTerrain, type RealTerrain } from "../_lib/realTerrain";

type RealTerrainState = { data: RealTerrain | null; loading: boolean };

/** Fetches the real terrain grids for a zone. For every zone without one
 *  (every zone except Teknaf today) this resolves to `{ data: null, loading:
 *  false }` on the same tick, with no network request, so Ground View's
 *  behaviour for those zones is unchanged. */
export function useRealTerrain(zoneId: string): RealTerrainState {
  const [trackedZoneId, setTrackedZoneId] = useState(zoneId);
  const [state, setState] = useState<RealTerrainState>(() => ({
    data: null,
    loading: hasRealTerrain(zoneId),
  }));

  // Reset synchronously during render when the zone id changes, rather than
  // from an effect: https://react.dev/learn/you-might-not-need-an-effect
  // ("Resetting all state when a prop changes"). The effect below then only
  // ever calls setState from its own fetch callback, never synchronously in
  // the effect body.
  if (zoneId !== trackedZoneId) {
    setTrackedZoneId(zoneId);
    setState({ data: null, loading: hasRealTerrain(zoneId) });
  }

  useEffect(() => {
    if (!hasRealTerrain(zoneId)) return;
    let cancelled = false;
    loadRealTerrain(zoneId)
      .then((data) => {
        if (!cancelled) setState({ data, loading: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, [zoneId]);

  return state;
}
