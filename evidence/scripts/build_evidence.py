"""
Build the real-data evidence pack for the Route200 Teknaf hill slopes zone.

What this script does (no model training anywhere):

  Part 1  Before/after Sentinel-1 RTC (VV, dB) pair over Teknaf, with a
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

Outputs are written under <repo>/web/public/evidence/teknaf/ and the
methodology README is maintained next to this script at <repo>/evidence/.
Dependencies: rasterio, planetary-computer, pystac-client, numpy, Pillow,
requests, scipy.
"""

import datetime as dt
import json
import os
import sys
import time
from pathlib import Path

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
# Configuration
# ---------------------------------------------------------------------------

# <repo>/evidence/scripts/build_evidence.py -> <repo>
REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "web" / "public" / "evidence" / "teknaf"
SAR_TIMELINE_DIR = OUT_DIR / "sar_timeline"
OPTICAL_DIR = OUT_DIR / "optical_timeline"
PRECIP_DIR = OUT_DIR / "precip_timeline"
MANIFEST_PATH = OUT_DIR / "manifest.json"

ZONE_ID = "zone-cht-teknaf"
ZONE_NAME = "Teknaf hill slopes"

STAC_URL = "https://planetarycomputer.microsoft.com/api/stac/v1"
S1_COLLECTION = "sentinel-1-rtc"

# Buffered AOI for the SAR crops (lon/lat).
AOI_BBOX = (92.26, 21.51, 92.34, 21.59)

BEFORE_ID = "S1A_IW_GRDH_1SDV_20260504T234811_20260504T234836_064374_081B35_rtc"
AFTER_ID = "S1D_IW_GRDH_1SDV_20261105T115504_20261105T115529_005332_00A26C_rtc"

JULY_SEARCH_DATETIME = "2026-07-01/2026-07-26"
EVENT_WINDOW = "2026-07-06 to 2026-07-24"

GIBS_BASE = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
GIBS_BBOX = (91.8, 21.2, 92.6, 21.9)
GIBS_W, GIBS_H = 640, 480
GIBS_DAYS = [dt.date(2026, 7, 1) + dt.timedelta(days=i) for i in range(25)]
OPTICAL_LAYER = "VIIRS_SNPP_CorrectedReflectance_TrueColor"
PRECIP_LAYER = "IMERG_Precipitation_Rate"

BEFORE_DATE = "2026-05-04"
AFTER_DATE = "2026-11-05"

DIFF_CLIP = 6.0
DIFF_CHANGE_THRESH = 3.0
DESPECKLE_SIZE = 15  # median filter window, in pixels, applied before differencing

# Diverging colour stops for the difference map.
RED = np.array([255, 60, 60], dtype=np.float32)      # d = -6
NEUTRAL = np.array([235, 235, 230], dtype=np.float32)  # d = 0
BLUE = np.array([60, 110, 255], dtype=np.float32)    # d = +6
WHITE = np.array([255, 255, 255], dtype=np.uint8)

PNG_MAGIC = b"\x89PNG\r\n\x1a\n"


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


# ---------------------------------------------------------------------------
# Part 1: before/after pair
# ---------------------------------------------------------------------------

def part1_before_after(catalog):
    print("[Part 1] Fetching before/after Sentinel-1 RTC items")
    collection = catalog.get_collection(S1_COLLECTION)
    before_item = collection.get_item(BEFORE_ID)
    after_item = collection.get_item(AFTER_ID)

    before_db = read_db_window(before_item, AOI_BBOX)
    after_db = read_db_window(after_item, AOI_BBOX)
    before_db, after_db = crop_to_common(before_db, after_db)
    print(f"  common shape: {before_db.shape}")

    # Raw single-look amplitude differencing is dominated by speckle noise,
    # not ground change (confirmed visually on this exact pair before this
    # filter was added). Despeckle each date independently before
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
        raise RuntimeError("No valid overlapping pixels between before and after.")

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
    print(f"  stats: {stats}")

    # The before stretch is the reference; the after image reuses it so the
    # two grayscale renders are directly comparable. Stretched from the
    # despeckled image, matching what's actually rendered.
    lo, hi = stretch_bounds(before_f)
    grayscale_png(before_f, lo, hi).save(OUT_DIR / f"sar_before_{BEFORE_DATE}.png")
    grayscale_png(after_f, lo, hi).save(OUT_DIR / f"sar_after_{AFTER_DATE}.png")
    diverging_png(diff_db).save(OUT_DIR / f"sar_diff_{BEFORE_DATE}_to_{AFTER_DATE}.png")

    return {
        "before_date": BEFORE_DATE,
        "before_scene_id": BEFORE_ID,
        "after_date": AFTER_DATE,
        "after_scene_id": AFTER_ID,
        "source": "Sentinel-1 RTC (radiometrically terrain-corrected), VV polarization, via Microsoft Planetary Computer",
        "gap_days": (dt.date.fromisoformat(AFTER_DATE) - dt.date.fromisoformat(BEFORE_DATE)).days,
        **stats,
        "_stretch": {"lo": round(lo, 3), "hi": round(hi, 3)},
    }


# ---------------------------------------------------------------------------
# Part 2: July event timeline
# ---------------------------------------------------------------------------

def part2_july_sar(catalog):
    print("[Part 2] Searching July 2026 Sentinel-1 RTC passes")
    search = catalog.search(
        collections=[S1_COLLECTION],
        bbox=list(AOI_BBOX),
        datetime=JULY_SEARCH_DATETIME,
    )
    items = sorted(search.item_collection(), key=lambda it: it.datetime)
    print(f"  {len(items)} scenes returned")

    passes = []
    seen_dates = {}
    for item in items:
        date = date_of(item)
        try:
            db = read_db_window(item, AOI_BBOX)
        except Exception as exc:  # keep going, record the failure
            print(f"  FAILED {item.id}: {exc}")
            continue
        lo, hi = stretch_bounds(db)
        name = f"sar_{date}.png"
        if name in seen_dates:  # two passes on one day: disambiguate
            name = f"sar_{date}_{item.id.split('_')[0]}.png"
        seen_dates[name] = item.id
        SAR_TIMELINE_DIR.mkdir(parents=True, exist_ok=True)
        grayscale_png(db, lo, hi).save(SAR_TIMELINE_DIR / name)
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


def gibs_get_with_retry(layer, date_str):
    last_exc = None
    for attempt in range(2):  # one retry
        try:
            return gibs_get(layer, date_str, GIBS_BBOX)
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


def part3_daily_gibs():
    print("[Part 3] Fetching daily GIBS optical and precipitation tiles")
    records, notes = [], []
    for day in GIBS_DAYS:
        date_str = day.isoformat()
        cloud_fraction = None
        mean_intensity = None

        try:
            opt_bytes = gibs_get_with_retry(OPTICAL_LAYER, date_str)
            opt_path = OPTICAL_DIR / f"optical_{date_str}.png"
            save_png_bytes(opt_bytes, opt_path)
            cloud_fraction = optical_cloud_fraction(opt_path)
        except Exception as exc:
            notes.append(f"{date_str}: optical tile skipped ({exc})")

        try:
            pr_bytes = gibs_get_with_retry(PRECIP_LAYER, date_str)
            pr_path = PRECIP_DIR / f"precip_{date_str}.png"
            save_png_bytes(pr_bytes, pr_path)
            mean_intensity = precip_mean_intensity(pr_path)
        except Exception as exc:
            notes.append(f"{date_str}: precipitation tile skipped ({exc})")

        records.append({
            "date": date_str,
            "cloud_fraction": cloud_fraction,
            "mean_intensity": mean_intensity,
        })
        print(f"  {date_str}  cloud_fraction={cloud_fraction}  mean_intensity={mean_intensity}")
    return records, notes


# ---------------------------------------------------------------------------
# Part 4: manifest
# ---------------------------------------------------------------------------

def write_manifest(before_after, passes, passes_found, daily, gibs_notes):
    before_after = dict(before_after)
    before_after.pop("_stretch", None)

    notes = []
    if passes_found != len(passes):
        notes.append(f"{passes_found - len(passes)} of {passes_found} July SAR scenes failed to read and were skipped.")
    notes.extend(gibs_notes)
    if not notes:
        notes.append("")

    manifest = {
        "zone_id": ZONE_ID,
        "zone_name": ZONE_NAME,
        "generated": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "before_after": before_after,
        "july_event_timeline": {
            "event_window": EVENT_WINDOW,
            "event_description": "Monsoon-triggered landslide/flood disaster across Chattogram Hill Tracts, including Teknaf",
            "sar_passes": passes,
            "daily_optical_precip": daily,
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
    with open(MANIFEST_PATH, "w", encoding="utf-8") as fh:
        json.dump(manifest, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"Wrote {MANIFEST_PATH}")


def main():
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    catalog = pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)

    before_after = part1_before_after(catalog)
    passes, passes_found = part2_july_sar(catalog)
    daily, gibs_notes = part3_daily_gibs()
    write_manifest(before_after, passes, passes_found, daily, gibs_notes)
    return 0


if __name__ == "__main__":
    sys.exit(main())
