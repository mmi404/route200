"""
Build real-data evidence packs for Route200 Chattogram Hill Tracts zones.

What this script does (no model training anywhere):

  Part 1  Before/after Sentinel-1 RTC (VV, dB) pair over the zone, with a
          difference map and summary statistics.
  Part 2  Every real Sentinel-1 RTC pass over the same AOI during the
          July 2026 monsoon event window, rendered as a time-lapse strip.
  Part 3  Daily NASA GIBS browse imagery (VIIRS true colour and IMERG
          precipitation rate) for a wider area, with two crude pixel-level
          proxies per day.
  Part 4  manifest.json recording every value computed above.

Data sources (both anonymous, no account or API key):
  * Microsoft Planetary Computer STAC API, collection "sentinel-1-rtc"
  * NASA GIBS WMS (epsg4326 "best" endpoint)

Run from anywhere:
    "C:\\Python312\\python.exe" build_evidence.py

Teknaf (zone-cht-teknaf) was built first, by hand-picked scene ids pinned
to its ZoneConfig below, and is left untouched by ZONES_TO_BUILD. Every
other zone searches Planetary Computer itself for the Sentinel-1 scene
closest to each target date inside that zone's own AOI, so no scene id
needs to be known ahead of time.

Outputs are written under <repo>/web/public/evidence/<slug>/ and the
methodology README is maintained next to this script at <repo>/evidence/.
Dependencies: rasterio, planetary-computer, pystac-client, numpy, Pillow,
requests, scipy.
"""

import datetime as dt
import json
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import numpy as np
import planetary_computer
import pystac_client
import rasterio
import requests
from PIL import Image
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
from scipy.ndimage import median_filter

# ---------------------------------------------------------------------------
# Shared configuration
# ---------------------------------------------------------------------------

# <repo>/evidence/scripts/build_evidence.py -> <repo>
REPO = Path(__file__).resolve().parents[2]
EVIDENCE_ROOT = REPO / "web" / "public" / "evidence"

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
S1_COLLECTION = "sentinel-1-rtc"

BEFORE_TARGET = "2026-05-04"
AFTER_TARGET = "2026-11-05"
BEFORE_SEARCH_WINDOW = "2026-04-20/2026-05-20"
AFTER_SEARCH_WINDOW = "2026-10-20/2026-11-20"

JULY_SEARCH_DATETIME = "2026-07-01/2026-07-26"
EVENT_WINDOW = "2026-07-06 to 2026-07-24"
EVENT_DESCRIPTION = "Monsoon-triggered landslide/flood disaster across Chattogram Hill Tracts"

GIBS_BASE = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
GIBS_W, GIBS_H = 640, 480
GIBS_DAYS = [dt.date(2026, 7, 1) + dt.timedelta(days=i) for i in range(25)]
OPTICAL_LAYER = "VIIRS_SNPP_CorrectedReflectance_TrueColor"
PRECIP_LAYER = "IMERG_Precipitation_Rate"

DIFF_CLIP = 6.0
DIFF_CHANGE_THRESH = 3.0
DESPECKLE_SIZE = 15  # median filter window, in pixels, applied before differencing

# Diverging colour stops for the difference map.
RED = np.array([255, 60, 60], dtype=np.float32)      # d = -6
NEUTRAL = np.array([235, 235, 230], dtype=np.float32)  # d = 0
BLUE = np.array([60, 110, 255], dtype=np.float32)    # d = +6
WHITE = np.array([255, 255, 255], dtype=np.uint8)

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


@dataclass
class ZoneConfig:
    zone_id: str
    zone_name: str
    slug: str
    aoi_bbox: tuple  # (minlon, minlat, maxlon, maxlat), buffered for the SAR crop
    gibs_bbox: tuple  # wider bbox for the daily optical/precipitation tiles
    # Only Teknaf pins exact scene ids/dates, since that pack was already
    # built, reviewed and committed by hand. Every other zone leaves these
    # None and gets them from a live STAC search instead.
    before_id: Optional[str] = None
    before_date: Optional[str] = None
    after_id: Optional[str] = None
    after_date: Optional[str] = None
    # A caveat specific to this zone's AOI (e.g. a river channel inside the
    # crop), found by looking at the rendered diff image, not computed.
    coverage_note: Optional[str] = None


ZONES = [
    ZoneConfig(
        zone_id="zone-cht-teknaf",
        zone_name="Teknaf hill slopes",
        slug="teknaf",
        aoi_bbox=(92.26, 21.51, 92.34, 21.59),
        gibs_bbox=(91.8, 21.2, 92.6, 21.9),
        before_id="S1A_IW_GRDH_1SDV_20260504T234811_20260504T234836_064374_081B35_rtc",
        before_date="2026-05-04",
        after_id="S1D_IW_GRDH_1SDV_20261105T115504_20261105T115529_005332_00A26C_rtc",
        after_date="2026-11-05",
    ),
    ZoneConfig(
        zone_id="zone-cht-bandarban-sadar",
        zone_name="Bandarban Sadar hill slopes",
        slug="bandarban-sadar",
        aoi_bbox=(92.176, 22.154, 92.264, 22.245),
        gibs_bbox=(91.846, 21.824, 92.594, 22.575),
    ),
    ZoneConfig(
        zone_id="zone-cht-lama",
        zone_name="Lama hill slopes",
        slug="lama",
        aoi_bbox=(92.1772, 21.7753, 92.2628, 21.8638),
        gibs_bbox=(91.8472, 21.4453, 92.5928, 22.1938),
    ),
    ZoneConfig(
        zone_id="zone-cht-naikhongchhari",
        zone_name="Naikhongchhari hill slopes",
        slug="naikhongchhari",
        aoi_bbox=(92.3284, 21.5766, 92.4116, 21.6625),
        gibs_bbox=(91.9984, 21.2466, 92.7416, 21.9925),
    ),
    ZoneConfig(
        zone_id="zone-cht-coxsbazar-sadar",
        zone_name="Cox's Bazar Sadar hill slopes",
        slug="coxsbazar-sadar",
        aoi_bbox=(91.9236, 21.4714, 92.0164, 21.5675),
        gibs_bbox=(91.5936, 21.1414, 92.3464, 21.8975),
        coverage_note=(
            "This AOI includes a stretch of river channel and tidal flat, visible as the "
            "wide blue/red band crossing the difference image. Water backscatter changes "
            "with tide, wind-driven surface roughness and flow, not ground disturbance, so "
            "part of the measured change here is the river, not the hillside. Read the two "
            "percentages above as an upper bound on this zone's land-surface change, not a "
            "clean reading of it."
        ),
    ),
    ZoneConfig(
        zone_id="zone-cht-ukhiya",
        zone_name="Ukhiya hill slopes",
        slug="ukhiya",
        aoi_bbox=(92.126, 21.534, 92.214, 21.625),
        gibs_bbox=(91.796, 21.204, 92.544, 21.955),
    ),
]

# Teknaf's pack already exists, was hand-verified, and is not rebuilt by
# default. Pass include_teknaf=True to main() to regenerate it too.
ZONES_TO_BUILD = [z for z in ZONES if z.slug != "teknaf"]


# ---------------------------------------------------------------------------
# SAR helpers
# ---------------------------------------------------------------------------

def sign_item(item):
    """Make sure asset hrefs carry a valid Planetary Computer SAS token."""
    return planetary_computer.sign(item)


def read_db_window(item, bbox_lonlat):
    """Read the VV band over a lon/lat bbox and return it in dB (NaN = invalid)."""
    item = sign_item(item)
    href = item.assets["vv"].href
    with rasterio.open(href) as src:
        bounds_native = transform_bounds("EPSG:4326", src.crs, *bbox_lonlat)
        win = from_bounds(*bounds_native, transform=src.transform)
        data = src.read(1, window=win).astype(np.float32)
    amp = np.where(data > 0, data, np.nan)
    return 10 * np.log10(amp)


def crop_to_common(*arrays):
    """Crop a set of 2-D arrays to their common minimum height and width."""
    min_h = min(a.shape[0] for a in arrays)
    min_w = min(a.shape[1] for a in arrays)
    return [a[:min_h, :min_w] for a in arrays]


def despeckle(db):
    """Spatial median filter over the dB image (standard SAR speckle
    reduction for single-look amplitude data, not a trained model). NaNs
    are filled with the image's own median first so the filter doesn't
    propagate holes, then re-masked by the caller using the original
    finite mask.
    """
    filled = np.where(np.isfinite(db), db, np.nanmedian(db))
    return median_filter(filled, size=DESPECKLE_SIZE)


def stretch_bounds(db):
    """2nd and 98th percentile of finite values."""
    valid = db[np.isfinite(db)]
    lo, hi = np.percentile(valid, [2, 98])
    return float(lo), float(hi)


def grayscale_png(db, lo, hi):
    """Linear grayscale stretch; invalid pixels are white."""
    finite = np.isfinite(db)
    scaled = np.clip((db - lo) / (hi - lo), 0.0, 1.0)
    gray = np.where(finite, scaled * 255.0, 255.0).astype(np.uint8)
    rgb = np.stack([gray, gray, gray], axis=-1)
    rgb[~finite] = WHITE
    return Image.fromarray(rgb, mode="RGB")


def diverging_png(diff):
    """Map dB difference to red-neutral-blue; invalid pixels are white."""
    finite = np.isfinite(diff)
    d = np.clip(np.where(finite, diff, 0.0), -DIFF_CLIP, DIFF_CLIP)
    f = np.abs(d) / DIFF_CLIP  # 0 at neutral, 1 at the clip limits
    target = np.where(d[..., None] < 0, RED, BLUE)
    rgb = NEUTRAL + f[..., None] * (target - NEUTRAL)
    rgb = np.clip(np.round(rgb), 0, 255).astype(np.uint8)
    rgb[~finite] = WHITE
    return Image.fromarray(rgb, mode="RGB")


def date_of(item):
    return item.datetime.date().isoformat()


def find_nearest_item(catalog, bbox, datetime_window, target_date):
    """Search the Sentinel-1 RTC collection and return the item whose date
    is closest to target_date, or None if the search returned nothing.
    """
    search = catalog.search(
        collections=[S1_COLLECTION],
        bbox=list(bbox),
        datetime=datetime_window,
    )
    items = list(search.item_collection())
    if not items:
        return None
    target = dt.date.fromisoformat(target_date)
    items.sort(key=lambda it: abs((it.datetime.date() - target).days))
    return items[0]


# ---------------------------------------------------------------------------
# Part 1: before/after pair
# ---------------------------------------------------------------------------

def part1_before_after(catalog, zone: "ZoneConfig", out_dir):
    print(f"[{zone.slug}] [Part 1] Resolving before/after Sentinel-1 RTC items")
    collection = catalog.get_collection(S1_COLLECTION)

    if zone.before_id and zone.after_id:
        before_item = collection.get_item(zone.before_id)
        after_item = collection.get_item(zone.after_id)
        before_date, after_date = zone.before_date, zone.after_date
    else:
        before_item = find_nearest_item(catalog, zone.aoi_bbox, BEFORE_SEARCH_WINDOW, BEFORE_TARGET)
        after_item = find_nearest_item(catalog, zone.aoi_bbox, AFTER_SEARCH_WINDOW, AFTER_TARGET)
        if before_item is None or after_item is None:
            raise RuntimeError(
                f"[{zone.slug}] no Sentinel-1 RTC scene found near the target dates "
                f"(before={before_item is not None}, after={after_item is not None})"
            )
        before_date, after_date = date_of(before_item), date_of(after_item)
        print(f"  found before={before_item.id} ({before_date}), after={after_item.id} ({after_date})")

    before_db = read_db_window(before_item, zone.aoi_bbox)
    after_db = read_db_window(after_item, zone.aoi_bbox)
    before_db, after_db = crop_to_common(before_db, after_db)
    print(f"  common shape: {before_db.shape}")

    # Raw single-look amplitude differencing is dominated by speckle noise,
    # not ground change. Despeckle each date independently before
    # differencing; this is a plain spatial filter, not a trained model,
    # and is the exact mitigation ML_Data_Sources_DRAFT.md already calls
    # for ("no speckle filter applied by default, add a simple focal-median
    # filter yourselves").
    valid = np.isfinite(before_db) & np.isfinite(after_db)
    before_f = despeckle(before_db)
    after_f = despeckle(after_db)

    diff_db = after_f - before_f
    diff_db = np.where(valid, diff_db, np.nan)
    n_valid = int(valid.sum())
    if n_valid == 0:
        raise RuntimeError(f"[{zone.slug}] no valid overlapping pixels between before and after.")

    d = diff_db[valid]
    stats = {
        "mean_diff_db": round(float(d.mean()), 3),
        "pct_pixels_dropped_gt3db": round(float((d < -DIFF_CHANGE_THRESH).mean() * 100), 2),
        "pct_pixels_risen_gt3db": round(float((d > DIFF_CHANGE_THRESH).mean() * 100), 2),
        "valid_pixel_count": n_valid,
        "despeckle_note": (
            f"A {DESPECKLE_SIZE}x{DESPECKLE_SIZE} median filter was applied to each date's "
            "dB image before differencing, to suppress single-look SAR speckle noise and "
            "reveal the underlying change pattern. This is a plain spatial filter (standard "
            "SAR preprocessing), not a trained model."
        ),
    }
    if zone.coverage_note:
        stats["coverage_note"] = zone.coverage_note
    print(f"  stats: {stats}")

    # The before stretch is the reference; the after image reuses it so the
    # two grayscale renders are directly comparable. Stretched from the
    # despeckled image, matching what's actually rendered.
    lo, hi = stretch_bounds(before_f)
    grayscale_png(before_f, lo, hi).save(out_dir / f"sar_before_{before_date}.png")
    grayscale_png(after_f, lo, hi).save(out_dir / f"sar_after_{after_date}.png")
    diverging_png(diff_db).save(out_dir / f"sar_diff_{before_date}_to_{after_date}.png")

    return {
        "before_date": before_date,
        "before_scene_id": before_item.id,
        "after_date": after_date,
        "after_scene_id": after_item.id,
        "source": "Sentinel-1 RTC (radiometrically terrain-corrected), VV polarization, via Microsoft Planetary Computer",
        "gap_days": (dt.date.fromisoformat(after_date) - dt.date.fromisoformat(before_date)).days,
        **stats,
        "_stretch": {"lo": round(lo, 3), "hi": round(hi, 3)},
    }


# ---------------------------------------------------------------------------
# Part 2: July event timeline
# ---------------------------------------------------------------------------

def part2_july_sar(catalog, zone, sar_timeline_dir):
    print(f"[{zone.slug}] [Part 2] Searching July 2026 Sentinel-1 RTC passes")
    search = catalog.search(
        collections=[S1_COLLECTION],
        bbox=list(zone.aoi_bbox),
        datetime=JULY_SEARCH_DATETIME,
    )
    items = sorted(search.item_collection(), key=lambda it: it.datetime)
    print(f"  {len(items)} scenes returned")

    passes = []
    seen_dates = {}
    for item in items:
        date = date_of(item)
        try:
            db = read_db_window(item, zone.aoi_bbox)
        except Exception as exc:  # keep going, record the failure
            print(f"  FAILED {item.id}: {exc}")
            continue
        lo, hi = stretch_bounds(db)
        name = f"sar_{date}.png"
        if name in seen_dates:  # two passes on one day: disambiguate
            name = f"sar_{date}_{item.id.split('_')[0]}.png"
        seen_dates[name] = item.id
        sar_timeline_dir.mkdir(parents=True, exist_ok=True)
        grayscale_png(db, lo, hi).save(sar_timeline_dir / name)
        passes.append({"date": date, "scene_id": item.id, "file": f"sar_timeline/{name}"})
        print(f"  saved {name}  shape={db.shape}")
    return passes, len(items)


# ---------------------------------------------------------------------------
# Part 3: GIBS daily optical and precipitation
# ---------------------------------------------------------------------------

def gibs_get(layer, date_str, bbox, width=GIBS_W, height=GIBS_H):
    """Fetch one GIBS WMS PNG.

    The FORMAT value must keep a literal, unencoded '/', so the query string
    is assembled by hand rather than through requests' params.
    """
    qs = (
        f"SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS={layer}"
        f"&TIME={date_str}&SRS=EPSG:4326"
        f"&BBOX={bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]}"
        f"&WIDTH={width}&HEIGHT={height}&FORMAT=image/png"
    )
    r = requests.get(GIBS_BASE + "?" + qs, timeout=30)
    r.raise_for_status()
    if not r.content.startswith(PNG_MAGIC):
        # GIBS reports some failures as an XML ServiceException with HTTP 200.
        raise RuntimeError(f"non-PNG response for {layer} {date_str}: {r.content[:120]!r}")
    return r.content


def gibs_get_with_retry(layer, date_str, bbox):
    last_exc = None
    for attempt in range(2):  # one retry
        try:
            return gibs_get(layer, date_str, bbox)
        except Exception as exc:
            last_exc = exc
            time.sleep(2)
    raise last_exc


def save_png_bytes(data, path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "wb") as fh:
        fh.write(data)


def optical_cloud_fraction(path):
    """Crude proxy: fraction of pixels with R, G and B all above 200."""
    rgb = np.asarray(Image.open(path).convert("RGB"))
    bright = np.all(rgb > 200, axis=-1)
    return round(float(bright.mean()), 4)


def precip_mean_intensity(path):
    """Crude proxy: mean grayscale value (0-255) of the precipitation tile."""
    gray = np.asarray(Image.open(path).convert("L"), dtype=np.float32)
    return round(float(gray.mean()), 3)


def blank_fraction(path):
    """Fraction of fully black (no-data) pixels in an RGB tile."""
    rgb = np.asarray(Image.open(path).convert("RGB"))
    return float(np.mean(np.all(rgb < 10, axis=-1)))


def part3_daily_gibs(zone, optical_dir, precip_dir):
    print(f"[{zone.slug}] [Part 3] Fetching daily GIBS optical and precipitation tiles")
    records, notes = [], []
    for day in GIBS_DAYS:
        date_str = day.isoformat()
        cloud_fraction = None
        mean_intensity = None
        optical_available = False

        try:
            opt_bytes = gibs_get_with_retry(OPTICAL_LAYER, date_str, zone.gibs_bbox)
            opt_path = optical_dir / f"optical_{date_str}.png"
            save_png_bytes(opt_bytes, opt_path)
            # A tile can come back as a validly-formed PNG that is entirely
            # black: GIBS has no coverage for that day, not "a clear sky".
            # Checked directly, rather than trusting any crude brightness
            # proxy, which would read a black tile as 0.0 ("clear").
            if blank_fraction(opt_path) > 0.9:
                notes.append(f"{date_str}: optical tile has no real coverage (fully black).")
            else:
                cloud_fraction = optical_cloud_fraction(opt_path)
                optical_available = True
        except Exception as exc:
            notes.append(f"{date_str}: optical tile skipped ({exc})")

        try:
            pr_bytes = gibs_get_with_retry(PRECIP_LAYER, date_str, zone.gibs_bbox)
            pr_path = precip_dir / f"precip_{date_str}.png"
            save_png_bytes(pr_bytes, pr_path)
            mean_intensity = precip_mean_intensity(pr_path)
        except Exception as exc:
            notes.append(f"{date_str}: precipitation tile skipped ({exc})")

        records.append({
            "date": date_str,
            "cloud_fraction": cloud_fraction,
            "mean_intensity": mean_intensity,
            "optical_available": optical_available,
        })
        print(f"  {date_str}  cloud_fraction={cloud_fraction}  mean_intensity={mean_intensity}  optical_available={optical_available}")
    return records, notes


# ---------------------------------------------------------------------------
# Part 4: manifest
# ---------------------------------------------------------------------------

def write_manifest(zone, manifest_path, before_after, passes, passes_found, daily, gibs_notes):
    before_after = dict(before_after)
    before_after.pop("_stretch", None)

    blackout_days = [r["date"] for r in daily if not r["optical_available"]]
    optical_blackout_note = ""
    if blackout_days:
        optical_blackout_note = (
            f"The optical tile had zero valid pixels (no real coverage, not a clear "
            f"reading) on: {', '.join(blackout_days)}. cloud_fraction is null on those "
            "days rather than a misleading 0.0."
        )

    notes = []
    if passes_found != len(passes):
        notes.append(f"{passes_found - len(passes)} of {passes_found} July SAR scenes failed to read and were skipped.")
    notes.extend(gibs_notes)
    if not notes:
        notes.append("")

    manifest = {
        "zone_id": zone.zone_id,
        "zone_name": zone.zone_name,
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "before_after": before_after,
        "july_event_timeline": {
            "event_window": EVENT_WINDOW,
            "event_description": EVENT_DESCRIPTION,
            "sar_passes": passes,
            "daily_optical_precip": daily,
            "optical_blackout_note": optical_blackout_note,
        },
        "methodology_note": (
            "All SAR imagery is real Sentinel-1 data, radiometrically terrain-corrected, read directly from "
            "Microsoft Planetary Computer with no authentication required. A "
            f"{DESPECKLE_SIZE}x{DESPECKLE_SIZE} median filter (despeckling) was applied before differencing, a "
            "standard SAR preprocessing step, not a model. All optical/precipitation imagery is real daily NASA "
            "GIBS browse imagery. All stats are computed directly from this real pixel data (dB conversion, "
            "spatial median filter, simple averaging/thresholding); no machine learning model was trained or run "
            "to produce any of these numbers."
        ),
        "notes": " ".join(n for n in notes if n),
    }
    with open(manifest_path, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"Wrote {manifest_path}")


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------

def build_zone(catalog, zone: ZoneConfig):
    out_dir = EVIDENCE_ROOT / zone.slug
    sar_timeline_dir = out_dir / "sar_timeline"
    optical_dir = out_dir / "optical_timeline"
    precip_dir = out_dir / "precip_timeline"
    manifest_path = out_dir / "manifest.json"
    out_dir.mkdir(parents=True, exist_ok=True)

    before_after = part1_before_after(catalog, zone, out_dir)
    passes, passes_found = part2_july_sar(catalog, zone, sar_timeline_dir)
    daily, gibs_notes = part3_daily_gibs(zone, optical_dir, precip_dir)
    write_manifest(zone, manifest_path, before_after, passes, passes_found, daily, gibs_notes)


def main(include_teknaf=False):
    catalog = pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    zones = ZONES if include_teknaf else ZONES_TO_BUILD
    for zone in zones:
        print(f"=== Building evidence pack for {zone.zone_id} ===")
        build_zone(catalog, zone)
    return 0


if __name__ == "__main__":
    sys.exit(main())
