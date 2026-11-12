import teknafManifest from "@/public/evidence/teknaf/manifest.json";
import type { EvidenceZoneId } from "./available";

/**
 * The shape of public/evidence/<zone>/manifest.json, as written by
 * evidence/scripts/build_evidence.py. Every image and figure the evidence
 * page shows is read from here; nothing is restated by hand in a
 * component.
 */
export type EvidenceManifest = {
  zone_id: string;
  zone_name: string;
  /** ISO timestamp the pack was built. */
  generated: string;
  before_after: {
    before_date: string;
    before_scene_id: string;
    after_date: string;
    after_scene_id: string;
    source: string;
    gap_days: number;
    mean_diff_db: number;
    pct_pixels_dropped_gt3db: number;
    pct_pixels_risen_gt3db: number;
    valid_pixel_count: number;
    despeckle_note: string;
  };
  july_event_timeline: {
    /** "YYYY-MM-DD to YYYY-MM-DD" */
    event_window: string;
    event_description: string;
    sar_passes: { date: string; scene_id: string; file: string }[];
    daily_optical_precip: {
      date: string;
      /** null on days with no optical image at all, never a fake 0. */
      cloud_fraction: number | null;
      mean_intensity: number;
      optical_available: boolean;
    }[];
    optical_blackout_note: string;
  };
  methodology_note: string;
  notes: string;
};

export type EvidencePack = {
  /** Public URL folder the manifest and its images live in. */
  basePath: string;
  manifest: EvidenceManifest;
  /**
   * Data-source names for the daily strip. The manifest's methodology
   * note only says "NASA GIBS browse imagery"; the exact layers are the
   * ones build_evidence.py requests (OPTICAL_LAYER, PRECIP_LAYER) and
   * evidence/README.md documents.
   */
  opticalSource: string;
  precipSource: string;
};

// Imported as a JSON module, same as app/api/change-events/route.ts does
// for lib/data/change-events.json. Swapping this for a fetched or
// database-backed manifest later changes only this registry.
const PACKS: Record<EvidenceZoneId, EvidencePack> = {
  "zone-cht-teknaf": {
    basePath: "/evidence/teknaf",
    manifest: teknafManifest,
    opticalSource: "NASA GIBS, VIIRS SNPP corrected reflectance (true colour)",
    precipSource: "NASA GIBS, IMERG precipitation rate",
  },
};

export function getEvidencePack(zoneId: string): EvidencePack | null {
  const pack = (PACKS as Record<string, EvidencePack | undefined>)[zoneId];
  // Guard against a registry key pointing at another zone's manifest.
  return pack && pack.manifest.zone_id === zoneId ? pack : null;
}

/**
 * Image URLs for a pack. The SAR time-lapse passes carry their own `file`
 * in the manifest; the before/after/diff and daily tiles do not, so their
 * names are derived from the manifest dates using build_evidence.py's own
 * output naming (sar_before_<date>.png, optical_timeline/optical_<date>.png,
 * and so on).
 */
export function evidenceImageUrls(pack: EvidencePack) {
  const { basePath, manifest } = pack;
  const { before_date: before, after_date: after } = manifest.before_after;
  return {
    before: `${basePath}/sar_before_${before}.png`,
    after: `${basePath}/sar_after_${after}.png`,
    diff: `${basePath}/sar_diff_${before}_to_${after}.png`,
    sarPass: (file: string) => `${basePath}/${file}`,
    optical: (date: string) => `${basePath}/optical_timeline/optical_${date}.png`,
    precip: (date: string) => `${basePath}/precip_timeline/precip_${date}.png`,
  };
}

/** Pixel size of every SAR image in a pack (before, after, diff, passes). */
export const SAR_IMAGE_SIZE = { width: 832, height: 889 };
/** Pixel size of every GIBS daily tile (build_evidence.py GIBS_W x GIBS_H). */
export const DAILY_TILE_SIZE = { width: 640, height: 480 };
