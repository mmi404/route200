"""
Build a real multi-decade tree/vegetation-density timeline for Route200's
Ground View walkable scene (Teknaf only), so the scene's forest density can
be scrubbed through real history instead of showing one fixed snapshot.

build_ground_terrain.py already gives Ground View a real heightmap, a real
disturbance footprint, and one real tree-density snapshot (ESA WorldCover,
vintage ~2021). This script adds a real density value at many more real
dates, spaced with shrinking gaps as they approach the real 2026 landslide
(roughly decades apart in the 1990s, then years, then months, then days),
so a visitor scrubbing the timeline can see the forest around the reference
point actually thinning out over time, not just a single before/after jump.
That is the real, measured basis for Route200's two goals: showing *why* the
landslide happened (deforestation visibly preceded it) and showing that the
trend was visible before the event (the predictive framing).

Source: Landsat Collection 2 Level-2 surface reflectance ("landsat-c2-l2"),
read anonymously from Microsoft Planetary Computer, the same access pattern
as build_evidence.py and build_ground_terrain.py. One consistent method is
used at every date (NDVI thresholded to a 0..1 density value) rather than
mixing Landsat with the WorldCover classification build_ground_terrain.py
already used, so the whole timeline is methodologically comparable across
decades. No model is trained anywhere; NDVI and the threshold remap are both
plain arithmetic on the real reflectance values.

Every read is a small windowed read (rasterio opens the remote COG and reads
only the ~400x400 m window around the reference point), never a full scene
download, so this never touches local disk beyond the few-KB output grids
this script writes. Nothing here needs cleaning up afterwards.

Run from anywhere:
    "C:\\Python312\\python.exe" build_ground_density_timeline.py

Outputs: web/public/ground-data/teknaf/density_timeline/<date>.bin (one
flat little-endian Float32 grid per real sample, ~5.5 KB each) and
web/public/ground-data/teknaf/density_timeline.json (manifest).

Dependencies: same as build_ground_terrain.py (rasterio, planetary-computer,
pystac-client, numpy, scipy), plus nothing new.
"""

import datetime as dt
import json
import sys
from pathlib import Path

import numpy as np
import planetary_computer
import pystac_client
import rasterio
from rasterio.warp import transform_bounds

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
import build_evidence as be  # noqa: E402
import build_ground_terrain as gt  # noqa: E402

REPO = SCRIPTS_DIR.parents[1]
GROUND_DATA_ROOT = REPO / "web" / "public" / "ground-data"

STAC_URL = be.STAC_URL
LANDSAT_COLLECTION = "landsat-c2-l2"

ZONE_SLUG = "teknaf"
ZONE_ID = "zone-cht-teknaf"

# Same grid shape as build_ground_terrain.py's density.bin, so the web app
# can sample every real sample the same way (realTerrain.ts's sampleGrid).
HALF_EXTENT = gt.DENSITY_HALF_EXTENT
CELL = gt.DENSITY_CELL

# Landsat Collection 2 Level-2 surface-reflectance scaling (USGS constant,
# same for every sensor generation this script reads).
SR_SCALE = 0.0000275
SR_OFFSET = -0.2

# Planetary Computer's landsat-c2-l2 normalizes band names across sensor
# generations, so every item (Landsat 4/5/7/8/9 alike) exposes the same
# 'red'/'nir08' asset keys regardless of which raw band number that was on
# the original sensor.
RED_ASSET = "red"
NIR_ASSET = "nir08"
QA_ASSET = "qa_pixel"

# NDVI -> 0..1 density, a plain threshold remap (not a trained model):
# bare ground/cleared land reads at or below NDVI_LOW, closed canopy at or
# above NDVI_HIGH, linear in between.
#
# Calibrated from this AOI's own measured range, not a generic tropical-
# forest textbook range: the first run (NDVI_LOW=0.15, NDVI_HIGH=0.65, a
# generic guess) clipped every real decadal mean_ndvi except the 2026
# landslide collapse to density 1.0, because this plot's real NDVI across
# 1990-2026 runs 0.545-0.885, almost entirely above 0.65. That saturation
# hid the real, measured year-to-year decline and made the scene look like
# "unchanged for decades, then one sudden 2026 event," rather than showing
# the real fluctuation the Landsat record actually contains. NDVI_HIGH=0.90
# sits just above this AOI's own observed maximum (0.885, 2025-10-01) so
# every real sample keeps a distinct, comparable density instead of pinning
# to the ceiling.
NDVI_LOW = 0.0
NDVI_HIGH = 0.90

# Real dates to sample, oldest first, with gaps shrinking as they approach
# the real 2026 landslide: decades apart in the 1990s-2000s, then years,
# then months, then the same days already pinned by the mock event history
# (change-events.json) and the existing before/after Sentinel-1 pair.
TARGET_DATES = [
    "1990-01-15",
    "2000-01-15",
    "2008-01-15",
    "2013-06-15",
    "2016-01-15",
    "2019-01-15",
    "2021-06-15",
    "2023-01-15",
    "2024-07-01",
    "2025-01-01",
    "2025-07-01",
    "2025-10-01",
    "2026-01-01",
    "2026-04-01",
    "2026-05-04",  # existing Sentinel-1 "before" date
    "2026-06-25",  # evt-011 start
    "2026-07-06",  # evt-015 start (July monsoon event)
    "2026-07-24",  # evt-018 end
    "2026-09-14",  # evt-030 start
    "2026-09-26",  # evt-030 end
    "2026-11-05",  # existing Sentinel-1 "after" date
]

# Widen the search window around a target date until something usable turns
# up; real archives have real gaps (orbit, cloud, pre-1984 coverage).
SEARCH_WINDOWS_DAYS = [60, 180, 365]
# How many of a window's lowest-cloud candidates to actually try reading
# (scene-wide cloud_cover is a hint, not a guarantee for this one small
# window) before giving up and widening the search window.
MAX_CANDIDATES = 8
# A sample is only trusted if at least this fraction of its local window is
# flagged clear by QA_PIXEL (no fill, cloud, dilated cloud, or shadow).
MIN_VALID_FRACTION = 0.7


def load_reference_point():
    meta_path = GROUND_DATA_ROOT / ZONE_SLUG / "meta.json"
    meta = json.loads(meta_path.read_text(encoding="utf-8"))
    return meta["reference_point"]["lon"], meta["reference_point"]["lat"]


def candidate_items(catalog, bbox, target_date: str):
    """Every Landsat item with usable assets near target_date, best (lowest
    cloud, closest date) first, tried across widening search windows."""
    target = dt.date.fromisoformat(target_date)
    for window_days in SEARCH_WINDOWS_DAYS:
        start = (target - dt.timedelta(days=window_days)).isoformat()
        end = (target + dt.timedelta(days=window_days)).isoformat()
        search = catalog.search(
            collections=[LANDSAT_COLLECTION],
            bbox=list(bbox),
            datetime=f"{start}/{end}",
        )
        items = [
            it
            for it in search.item_collection()
            if RED_ASSET in it.assets and NIR_ASSET in it.assets and QA_ASSET in it.assets
        ]
        if not items:
            continue
        items.sort(
            key=lambda it: (
                it.properties.get("eo:cloud_cover", 100.0),
                abs((it.datetime.date() - target).days),
            )
        )
        yield window_days, items[:MAX_CANDIDATES]


def read_band_window(item, band_name, bbox_lonlat):
    href = planetary_computer.sign(item).assets[band_name].href
    with rasterio.open(href) as src:
        bounds_native = transform_bounds("EPSG:4326", src.crs, *bbox_lonlat)
        win = rasterio.windows.from_bounds(*bounds_native, transform=src.transform)
        data = src.read(1, window=win).astype(np.float64)
        win_transform = rasterio.windows.transform(win, src.transform)
        crs = src.crs
    return data, win_transform, crs


def quality_valid_mask(qa_dn: np.ndarray) -> np.ndarray:
    """True where a QA_PIXEL cell is usable: no fill, dilated cloud, cloud,
    or cloud shadow flag set (Collection 2 Level-2 QA_PIXEL bit layout).
    This is what rejects Landsat 7's post-2003 SLC-off scan gaps (flagged
    as fill) and cloud/cloud-shadow contamination alike, rather than
    trusting a scene-wide cloud_cover percentage that says nothing about
    this one small window."""
    qa = qa_dn.astype(np.uint32)
    bad = (qa & 0b1) | (qa & (1 << 1)) | (qa & (1 << 3)) | (qa & (1 << 4))
    return bad == 0


def try_item(item, bbox, ref_lon, ref_lat):
    """Reads one item's red/NIR/QA windows. Returns a dict with the result
    (and always the measured valid_fraction, even on rejection, so a
    rejected candidate can still be logged) or None only on a hard read
    failure."""
    red_dn, transform, crs = read_band_window(item, RED_ASSET, bbox)
    nir_dn, _, _ = read_band_window(item, NIR_ASSET, bbox)
    qa_dn, _, _ = read_band_window(item, QA_ASSET, bbox)
    red_dn, nir_dn, qa_dn = be.crop_to_common(red_dn, nir_dn, qa_dn)

    valid = quality_valid_mask(qa_dn)
    valid_fraction = float(valid.mean())
    if valid_fraction < MIN_VALID_FRACTION:
        return {"ok": False, "valid_fraction": valid_fraction}

    red = red_dn * SR_SCALE + SR_OFFSET
    nir = nir_dn * SR_SCALE + SR_OFFSET
    denom = nir + red
    ndvi = np.where(denom != 0, (nir - red) / np.where(denom != 0, denom, 1.0), 0.0)
    ndvi = np.where(valid, ndvi, np.nan)
    # A handful of bad pixels inside an otherwise-usable window are filled
    # with the window's own valid median (the same spirit as build_evidence
    # .py's despeckle: a plain spatial fill, not a trained model) so the
    # bilinear resample below never touches NaN.
    ndvi_filled = np.where(np.isfinite(ndvi), ndvi, np.nanmedian(ndvi))
    density_px = np.clip((ndvi_filled - NDVI_LOW) / (NDVI_HIGH - NDVI_LOW), 0.0, 1.0)

    axis, n = gt.build_grid_axes(HALF_EXTENT, CELL)
    xs, zs = np.meshgrid(axis, axis)
    lons, lats = gt.world_to_lonlat(xs, zs, ref_lon, ref_lat)
    density_grid = gt.sample_raster_at(density_px, transform, crs, lons, lats, order=1).astype(np.float32)
    return {
        "ok": True,
        "valid_fraction": valid_fraction,
        "grid": density_grid,
        "n": n,
        "mean_ndvi": float(np.nanmean(ndvi)),
    }


def main():
    catalog = pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    ref_lon, ref_lat = load_reference_point()
    bbox = gt.padded_lonlat_bbox(ref_lon, ref_lat, HALF_EXTENT)

    out_dir = GROUND_DATA_ROOT / ZONE_SLUG / "density_timeline"
    samples = []
    skipped = []

    for target_date in TARGET_DATES:
        print(f"[{target_date}] searching Landsat Collection 2 L2")
        accepted = None
        for window_days, items in candidate_items(catalog, bbox, target_date):
            for item in items:
                try:
                    result = try_item(item, bbox, ref_lon, ref_lat)
                except Exception as exc:
                    print(f"  {item.id}: FAILED to read ({exc})")
                    continue
                if not result["ok"]:
                    print(
                        f"  {item.id} ({item.properties.get('platform')}): rejected, only "
                        f"{result['valid_fraction']*100:.0f}% of the local window is clear"
                    )
                    continue
                accepted = (item, window_days, result)
                break
            if accepted:
                break
        if accepted is None:
            print("  no usable (clear enough) scene found in any search window, skipping")
            skipped.append(target_date)
            continue

        item, window_days, result = accepted
        cloud = item.properties.get("eo:cloud_cover")
        actual_date = item.datetime.date().isoformat()
        grid, mean_ndvi, valid_fraction = result["grid"], result["mean_ndvi"], result["valid_fraction"]
        print(
            f"  using {item.id} ({item.properties.get('platform')}), actual date {actual_date}, "
            f"cloud_cover={cloud}, window clear={valid_fraction*100:.0f}%, search window +/-{window_days}d"
        )

        file_name = f"{target_date}.bin"
        gt.write_grid_bin(grid, out_dir / file_name)
        samples.append(
            {
                "target_date": target_date,
                "actual_date": actual_date,
                "file": f"density_timeline/{file_name}",
                "scene_id": item.id,
                "platform": item.properties.get("platform"),
                "cloud_cover_pct": cloud,
                "window_clear_fraction": round(valid_fraction, 3),
                "search_window_days": window_days,
                "mean_ndvi": round(mean_ndvi, 3),
                "mean_density": round(float(grid.mean()), 3),
            }
        )
        print(f"  mean_ndvi={mean_ndvi:.3f} mean_density={grid.mean():.3f}")

    if not samples:
        raise RuntimeError("No usable Landsat samples were found for any target date.")

    axis, n = gt.build_grid_axes(HALF_EXTENT, CELL)
    manifest = {
        "zone_id": ZONE_ID,
        "reference_point": {"lon": round(ref_lon, 6), "lat": round(ref_lat, 6)},
        "grid": {
            "width": n,
            "height": n,
            "cellSize": CELL,
            "originX": -HALF_EXTENT,
            "originZ": -HALF_EXTENT,
        },
        "ndvi_density_mapping": {
            "ndvi_low": NDVI_LOW,
            "ndvi_high": NDVI_HIGH,
            "note": (
                "density = clip((ndvi - ndvi_low) / (ndvi_high - ndvi_low), 0, 1); a plain "
                "threshold remap, not a trained model."
            ),
        },
        "samples": samples,
        "skipped_target_dates": skipped,
        "methodology_note": (
            "Each sample is the real Landsat Collection 2 Level-2 surface-reflectance scene "
            f"closest to its target date, among up to the {MAX_CANDIDATES} lowest-cloud "
            "candidates in a widening +/-60/180/365 day window, whose QA_PIXEL band shows at "
            f"least {int(MIN_VALID_FRACTION*100)}% of the local window clear of fill pixels "
            "(including Landsat 7's post-2003 SLC-off scan gaps), cloud, dilated cloud and "
            "cloud shadow: a scene-wide cloud_cover percentage says nothing about this one "
            "small window, so every candidate's own local window is checked directly instead "
            "of trusted on that number alone. Every read is anonymous and windowed directly "
            "from Microsoft Planetary Computer, never a full scene download. NDVI is computed "
            "from the real red/NIR reflectance after applying the USGS Collection 2 scale and "
            "offset, then thresholded to a 0..1 density value with the same formula at every "
            "date, so the samples are directly comparable across decades. No model was "
            "trained or run."
        ),
    }
    manifest_path = GROUND_DATA_ROOT / ZONE_SLUG / "density_timeline.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"\nWrote {len(samples)} samples ({len(skipped)} skipped) to {manifest_path}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
