"""
Build real-data terrain for Route200's Ground View walkable scene.

Ground View (web/app/map/[zoneId]/ground) used to invent its hillside from a
hash of the zone id. This script replaces that invention, for Teknaf
(zone-cht-teknaf) only, with three small grids computed from real satellite
data, all read anonymously from Microsoft Planetary Computer:

  1. heightmap.bin   Real elevation (Copernicus DEM GLO-30, 30 m) around a
                      reference point, relative to that point's own height.
  2. density.bin      Real tree-cover density (ESA WorldCover 10 m land
                      cover, classified into a 0..1 density value) at the
                      same place.
  3. disturbance.bin  Where the ground actually changed: the real Sentinel-1
                      before/after difference (the same despeckled VV dB
                      diff used for the evidence pack), reused here instead
                      of recomputed, normalized to 0..1.

No model is trained anywhere. Elevation and land cover come straight from
their source rasters; the disturbance grid is a plain linear remap of the
real dB difference already computed for evidence/README.md.

Reference point: the centroid of the largest contiguous patch where the
real Sentinel-1 signal dropped more than DIFF_CHANGE_THRESH dB between the
Teknaf before/after pair, i.e. the real location of the biggest measured
disturbance in the AOI. This point becomes the Ground View scene's local
origin (world x=0, z=0), so the walkable scene is centered on the place the
disturbance actually happened, not an arbitrary seeded position.

Run from anywhere:
    "C:\\Python312\\python.exe" build_ground_terrain.py

Outputs: web/public/ground-data/teknaf/{heightmap.bin, density.bin,
disturbance.bin, meta.json}, plus debug preview PNGs under
evidence/ground_debug/teknaf/ (not shipped to the web app) for visually
sanity-checking the grids against known Teknaf topography before trusting
them.

Dependencies: same as build_evidence.py (rasterio, planetary-computer,
pystac-client, numpy, Pillow, scipy), plus nothing new.
"""

import json
import math
import sys
from pathlib import Path

import numpy as np
import planetary_computer
import pystac_client
import rasterio
from PIL import Image
from rasterio.warp import transform as warp_transform
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
from scipy.ndimage import label, map_coordinates

SCRIPTS_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPTS_DIR))
import build_evidence as be  # noqa: E402  (needs the sys.path insert above)

REPO = SCRIPTS_DIR.parents[1]
GROUND_DATA_ROOT = REPO / "web" / "public" / "ground-data"
DEBUG_ROOT = REPO / "evidence" / "ground_debug"

STAC_URL = be.STAC_URL
DEM_COLLECTION = "cop-dem-glo-30"
WORLDCOVER_COLLECTION = "esa-worldcover"

ZONE_SLUG = sys.argv[1] if len(sys.argv) > 1 else "teknaf"

# Grid extents. The Ground View world (web/app/map/[zoneId]/ground/_lib/
# terrain.ts) walks out to worldRadius=120 and a 50 m skirt beyond that; 180
# covers that with margin.
HEIGHT_HALF_EXTENT = 180.0
HEIGHT_CELL = 5.0
DENSITY_HALF_EXTENT = 180.0
DENSITY_CELL = 10.0
DISTURBANCE_HALF_EXTENT = 180.0
DISTURBANCE_CELL = 10.0

METERS_PER_DEG_LAT = 110540.0

# ESA WorldCover class code -> tree/vegetation density, 0 (bare/water/built)
# to 1 (closed forest). Codes per the WorldCover legend; unmapped codes fall
# back to a low default rather than 0, since most unlisted values are still
# some kind of land, not pavement.
WORLDCOVER_DENSITY = {
    10: 1.0,  # tree cover
    20: 0.45,  # shrubland
    30: 0.2,  # grassland
    40: 0.15,  # cropland
    50: 0.0,  # built-up
    60: 0.02,  # bare / sparse vegetation
    70: 0.0,  # snow and ice
    80: 0.0,  # permanent water bodies
    90: 0.25,  # herbaceous wetland
    95: 1.0,  # mangroves
    100: 0.1,  # moss and lichen
}

# How much of each class is real open water, for the river/channel grid.
# Permanent water bodies count fully; herbaceous wetland (the marshy fringe
# a char often has) counts partially. Everything else is 0, i.e. dry land.
WORLDCOVER_WATER = {
    80: 1.0,  # permanent water bodies
    90: 0.3,  # herbaceous wetland
}

# A zone only gets a water grid (and a water plane in the scene) when its
# real WorldCover window actually contains a meaningful amount of open
# water; a hillside with a stray wet pixel should not grow a river.
MIN_WATER_COVERAGE = 0.005


def meters_per_deg_lon(ref_lat_deg: float) -> float:
    return 111320.0 * math.cos(math.radians(ref_lat_deg))


def build_grid_axes(half_extent: float, cell: float):
    """Symmetric axis -half_extent..+half_extent inclusive, step `cell`,
    with the centre sample landing exactly on 0 (so the reference point is
    an exact grid node, not an interpolated one)."""
    n = int(round(2 * half_extent / cell)) + 1
    axis = np.linspace(-half_extent, half_extent, n)
    return axis, n


def world_to_lonlat(xs: np.ndarray, zs: np.ndarray, ref_lon: float, ref_lat: float):
    """+x = east metres, +z = north metres, from the reference point."""
    lons = ref_lon + xs / meters_per_deg_lon(ref_lat)
    lats = ref_lat + zs / METERS_PER_DEG_LAT
    return lons, lats


def padded_lonlat_bbox(ref_lon: float, ref_lat: float, half_extent: float, pad: float = 1.15):
    """A lon/lat bbox comfortably covering a square of the given half-extent
    (metres) around the reference point, padded for safe bilinear sampling
    at the edges."""
    lon_span = (half_extent * pad) / meters_per_deg_lon(ref_lat)
    lat_span = (half_extent * pad) / METERS_PER_DEG_LAT
    return (ref_lon - lon_span, ref_lat - lat_span, ref_lon + lon_span, ref_lat + lat_span)


def read_raster_window(href: str, bbox_lonlat):
    """Read band 1 of a COG over a lon/lat bbox. Returns (array, window
    affine transform, source CRS); generic for any single-band raster
    (DEM elevation, WorldCover class codes), unlike build_evidence's
    SAR-specific read_db_window."""
    with rasterio.open(href) as src:
        bounds_native = transform_bounds("EPSG:4326", src.crs, *bbox_lonlat)
        win = from_bounds(*bounds_native, transform=src.transform)
        data = src.read(1, window=win)
        win_transform = rasterio.windows.transform(win, src.transform)
        crs = src.crs
    return data, win_transform, crs


def sample_raster_at(array: np.ndarray, transform, crs, lons: np.ndarray, lats: np.ndarray, order: int = 1):
    """Bilinear- (order=1) or nearest- (order=0) sample `array` at the given
    lon/lat points, via the raster's own affine transform. `lons`/`lats` can
    be any shape; the result matches that shape."""
    if str(crs) != "EPSG:4326":
        xs, ys = warp_transform("EPSG:4326", crs, lons.ravel(), lats.ravel())
        xs = np.array(xs).reshape(lons.shape)
        ys = np.array(ys).reshape(lats.shape)
    else:
        xs, ys = lons, lats
    inv = ~transform
    cols, rows = inv * (xs, ys)
    sampled = map_coordinates(
        array.astype(np.float64), [rows, cols], order=order, mode="nearest"
    )
    return sampled.reshape(lons.shape)


def save_debug_png(grid: np.ndarray, path: Path, lo: float = None, hi: float = None):
    path.parent.mkdir(parents=True, exist_ok=True)
    lo = float(np.nanmin(grid)) if lo is None else lo
    hi = float(np.nanmax(grid)) if hi is None else hi
    span = hi - lo if hi > lo else 1.0
    scaled = np.clip((grid - lo) / span, 0.0, 1.0)
    img = (scaled * 255).astype(np.uint8)
    Image.fromarray(img, mode="L").save(path)


def write_grid_bin(grid: np.ndarray, path: Path):
    path.parent.mkdir(parents=True, exist_ok=True)
    grid.astype("<f4").tofile(path)


# ---------------------------------------------------------------------------
# Step 1: reference point, from the real Sentinel-1 before/after diff
# ---------------------------------------------------------------------------


def find_reference_point(catalog, zone: "be.ZoneConfig"):
    print(f"[{zone.slug}] Resolving before/after Sentinel-1 RTC items for the reference point")
    # Teknaf's pair was hand-picked and pinned on its ZoneConfig already; any
    # other zone (no before_id/after_id set) gets the same live search
    # build_evidence.py's own part1_before_after uses for its non-Teknaf
    # zones, against the same project-wide before/after target dates.
    if zone.before_id and zone.after_id:
        collection = catalog.get_collection(be.S1_COLLECTION)
        before_item = collection.get_item(zone.before_id)
        after_item = collection.get_item(zone.after_id)
    else:
        before_item = be.find_nearest_item(catalog, zone.aoi_bbox, be.BEFORE_SEARCH_WINDOW, be.BEFORE_TARGET)
        after_item = be.find_nearest_item(catalog, zone.aoi_bbox, be.AFTER_SEARCH_WINDOW, be.AFTER_TARGET)
        if before_item is None or after_item is None:
            raise RuntimeError(
                f"[{zone.slug}] no Sentinel-1 RTC scene found near the target dates "
                f"(before={before_item is not None}, after={after_item is not None})"
            )
        print(f"  found before={before_item.id} ({be.date_of(before_item)}), after={after_item.id} ({be.date_of(after_item)})")

    before_db, before_transform, before_crs = be.read_db_window(
        before_item, zone.aoi_bbox, return_transform=True
    )
    after_db = be.read_db_window(after_item, zone.aoi_bbox)
    before_db, after_db = be.crop_to_common(before_db, after_db)

    valid = np.isfinite(before_db) & np.isfinite(after_db)
    before_f = be.despeckle(before_db)
    after_f = be.despeckle(after_db)
    diff_db = np.where(valid, after_f - before_f, np.nan)

    dropped = valid & (diff_db < -be.DIFF_CHANGE_THRESH)
    labeled, num = label(dropped)
    if num == 0:
        print("  No pixel dropped more than the change threshold; falling back to the AOI centre.")
        minlon, minlat, maxlon, maxlat = zone.aoi_bbox
        ref_lon, ref_lat = (minlon + maxlon) / 2, (minlat + maxlat) / 2
        component_size = 0
    else:
        sizes = np.bincount(labeled.ravel())
        sizes[0] = 0  # background
        largest_label = int(np.argmax(sizes))
        component_size = int(sizes[largest_label])
        rows, cols = np.where(labeled == largest_label)
        centroid_col = float(cols.mean()) + 0.5
        centroid_row = float(rows.mean()) + 0.5
        x_crs, y_crs = before_transform * (centroid_col, centroid_row)
        if str(before_crs) != "EPSG:4326":
            (ref_lon,), (ref_lat,) = warp_transform(before_crs, "EPSG:4326", [x_crs], [y_crs])
        else:
            ref_lon, ref_lat = x_crs, y_crs
        print(f"  Largest dropped component: {component_size} px, centroid lon={ref_lon:.5f} lat={ref_lat:.5f}")

    return {
        "ref_lon": ref_lon,
        "ref_lat": ref_lat,
        "component_size_px": component_size,
        "before_scene_id": before_item.id,
        "after_scene_id": after_item.id,
        "before_date": zone.before_date or be.date_of(before_item),
        "after_date": zone.after_date or be.date_of(after_item),
        "diff_db": diff_db,
        "diff_transform": before_transform,
        "diff_crs": before_crs,
    }


# ---------------------------------------------------------------------------
# Step 2: real heightmap, from Copernicus DEM GLO-30
# ---------------------------------------------------------------------------


def build_heightmap(catalog, ref_lon: float, ref_lat: float):
    print("[heightmap] Searching cop-dem-glo-30")
    bbox = padded_lonlat_bbox(ref_lon, ref_lat, HEIGHT_HALF_EXTENT)
    search = catalog.search(collections=[DEM_COLLECTION], bbox=list(bbox))
    items = list(search.item_collection())
    if not items:
        raise RuntimeError("No Copernicus DEM GLO-30 tile found over the reference point.")
    item = items[0]
    print(f"  DEM item: {item.id}")
    href = planetary_computer.sign(item).assets["data"].href
    array, transform, crs = read_raster_window(href, bbox)

    axis, n = build_grid_axes(HEIGHT_HALF_EXTENT, HEIGHT_CELL)
    xs, zs = np.meshgrid(axis, axis)
    lons, lats = world_to_lonlat(xs, zs, ref_lon, ref_lat)
    heights_abs = sample_raster_at(array, transform, crs, lons, lats, order=1)

    center = n // 2
    ref_elevation = float(heights_abs[center, center])
    heights_rel = (heights_abs - ref_elevation).astype(np.float32)

    print(
        f"  reference elevation {ref_elevation:.2f} m; relative range "
        f"[{heights_rel.min():.2f}, {heights_rel.max():.2f}] m over {n}x{n} cells at {HEIGHT_CELL} m"
    )
    return {
        "dem_item_id": item.id,
        "reference_elevation_m": round(ref_elevation, 2),
        "grid": heights_rel,
        "n": n,
    }


# ---------------------------------------------------------------------------
# Step 3: real tree/vegetation density, from ESA WorldCover
# ---------------------------------------------------------------------------


def fetch_worldcover(catalog, ref_lon: float, ref_lat: float):
    print("[worldcover] Searching esa-worldcover")
    bbox = padded_lonlat_bbox(ref_lon, ref_lat, DENSITY_HALF_EXTENT)
    search = catalog.search(collections=[WORLDCOVER_COLLECTION], bbox=list(bbox))
    items = list(search.item_collection())
    if not items:
        raise RuntimeError("No ESA WorldCover tile found over the reference point.")
    # Prefer the newer (v200/2021) vintage if both years were returned.
    items.sort(key=lambda it: it.id, reverse=True)
    item = items[0]
    print(f"  WorldCover item: {item.id}")
    href = planetary_computer.sign(item).assets["map"].href
    class_array, transform, crs = read_raster_window(href, bbox)
    return item, class_array, transform, crs


def classify_grid(class_array, transform, crs, lut: np.ndarray, ref_lon: float, ref_lat: float, half_extent: float, cell: float):
    classified_px = lut[np.clip(class_array.astype(np.int64), 0, 255)]
    axis, n = build_grid_axes(half_extent, cell)
    xs, zs = np.meshgrid(axis, axis)
    lons, lats = world_to_lonlat(xs, zs, ref_lon, ref_lat)
    grid = sample_raster_at(classified_px, transform, crs, lons, lats, order=1).astype(np.float32)
    return grid, n


def build_density(class_array, transform, crs, ref_lon: float, ref_lat: float):
    lut = np.full(256, 0.1, dtype=np.float32)
    for code, value in WORLDCOVER_DENSITY.items():
        lut[code] = value
    density_grid, n = classify_grid(class_array, transform, crs, lut, ref_lon, ref_lat, DENSITY_HALF_EXTENT, DENSITY_CELL)
    print(
        f"  density range [{density_grid.min():.2f}, {density_grid.max():.2f}], "
        f"mean {density_grid.mean():.2f} over {n}x{n} cells at {DENSITY_CELL} m"
    )
    return {"grid": density_grid, "n": n}


def build_water(class_array, transform, crs, ref_lon: float, ref_lat: float):
    """A real open-water grid (WORLDCOVER_WATER), on the same axes as the
    density grid. Returns None when the window has no meaningful water, so a
    hillside zone never grows a stray river from a single wet pixel."""
    lut = np.zeros(256, dtype=np.float32)
    for code, value in WORLDCOVER_WATER.items():
        lut[code] = value
    water_grid, n = classify_grid(class_array, transform, crs, lut, ref_lon, ref_lat, DENSITY_HALF_EXTENT, DENSITY_CELL)
    coverage = float((water_grid > 0.5).mean())
    print(f"  water coverage {coverage * 100:.1f}% of {n}x{n} cells at {DENSITY_CELL} m")
    if coverage < MIN_WATER_COVERAGE:
        print(f"  below {MIN_WATER_COVERAGE * 100:.1f}% minimum; no water grid written")
        return None
    return {"grid": water_grid, "n": n, "coverage": coverage}


def water_level_m(height_grid: np.ndarray, water_grid: np.ndarray) -> float:
    """Real elevation (relative to the reference point) the water grid's
    open-water cells actually sit at: the height grid resampled onto the
    water grid's coarser axes via bilinear interpolation (both are regular
    grids centred on the same origin, just different cell sizes), then the
    median over cells WorldCover calls water. Falls back to the window's
    lowest point when, implausibly, no cell clears the 0.5 threshold."""
    h_n = height_grid.shape[0]
    w_n = water_grid.shape[0]
    h_cell = (2 * HEIGHT_HALF_EXTENT) / (h_n - 1)
    w_axis = np.linspace(-DENSITY_HALF_EXTENT, DENSITY_HALF_EXTENT, w_n)
    wx, wz = np.meshgrid(w_axis, w_axis)
    rows = (wz + HEIGHT_HALF_EXTENT) / h_cell
    cols = (wx + HEIGHT_HALF_EXTENT) / h_cell
    sampled = map_coordinates(height_grid.astype(np.float64), [rows, cols], order=1, mode="nearest")
    mask = water_grid > 0.5
    if not mask.any():
        return float(np.min(sampled))
    return float(np.median(sampled[mask]))


# ---------------------------------------------------------------------------
# Step 4: real disturbance footprint, reusing the already-computed diff
# ---------------------------------------------------------------------------


def build_disturbance(ref_point: dict, ref_lon: float, ref_lat: float):
    print("[disturbance] Resampling the real Sentinel-1 diff onto the local grid")
    diff_db = ref_point["diff_db"]
    diff_filled = np.where(np.isfinite(diff_db), diff_db, 0.0)

    axis, n = build_grid_axes(DISTURBANCE_HALF_EXTENT, DISTURBANCE_CELL)
    xs, zs = np.meshgrid(axis, axis)
    lons, lats = world_to_lonlat(xs, zs, ref_lon, ref_lat)
    diff_local = sample_raster_at(
        diff_filled, ref_point["diff_transform"], ref_point["diff_crs"], lons, lats, order=1
    )

    # Only a drop (cleared ground) counts as disturbance. 0 at or below the
    # change threshold, 1 at or beyond the clip used for the evidence-pack
    # diff images, so this grid uses the same real thresholds as the rest of
    # the project rather than inventing new ones.
    span = be.DIFF_CLIP - be.DIFF_CHANGE_THRESH
    disturbance = np.clip((-diff_local - be.DIFF_CHANGE_THRESH) / span, 0.0, 1.0).astype(np.float32)

    print(
        f"  disturbance range [{disturbance.min():.2f}, {disturbance.max():.2f}], "
        f"{(disturbance > 0.5).mean() * 100:.1f}% of cells > 0.5 over {n}x{n} cells at {DISTURBANCE_CELL} m"
    )
    return {"grid": disturbance, "n": n}


# ---------------------------------------------------------------------------
# Driver
# ---------------------------------------------------------------------------


def main():
    catalog = pystac_client.Client.open(STAC_URL, modifier=planetary_computer.sign_inplace)
    zone = next(z for z in be.ZONES if z.slug == ZONE_SLUG)

    ref_point = find_reference_point(catalog, zone)
    ref_lon, ref_lat = ref_point["ref_lon"], ref_point["ref_lat"]

    height = build_heightmap(catalog, ref_lon, ref_lat)
    worldcover_item, class_array, wc_transform, wc_crs = fetch_worldcover(catalog, ref_lon, ref_lat)
    density = build_density(class_array, wc_transform, wc_crs, ref_lon, ref_lat)
    water = build_water(class_array, wc_transform, wc_crs, ref_lon, ref_lat)
    disturbance = build_disturbance(ref_point, ref_lon, ref_lat)

    out_dir = GROUND_DATA_ROOT / ZONE_SLUG
    write_grid_bin(height["grid"], out_dir / "heightmap.bin")
    write_grid_bin(density["grid"], out_dir / "density.bin")
    write_grid_bin(disturbance["grid"], out_dir / "disturbance.bin")
    if water is not None:
        write_grid_bin(water["grid"], out_dir / "water.bin")
        water_level = round(water_level_m(height["grid"], water["grid"]), 2)
        print(f"  water level {water_level:+.2f} m relative to the reference point")

    meta = {
        "zone_id": zone.zone_id,
        "reference_point": {"lon": round(ref_lon, 6), "lat": round(ref_lat, 6)},
        "reference_disturbance_component_px": ref_point["component_size_px"],
        "sar_before_scene_id": ref_point["before_scene_id"],
        "sar_after_scene_id": ref_point["after_scene_id"],
        "sar_before_date": ref_point["before_date"],
        "sar_after_date": ref_point["after_date"],
        "dem_item_id": height["dem_item_id"],
        "worldcover_item_id": worldcover_item.id,
        "reference_elevation_m": height["reference_elevation_m"],
        "grids": {
            "heightmap": {
                "file": "heightmap.bin",
                "width": height["n"],
                "height": height["n"],
                "cellSize": HEIGHT_CELL,
                "originX": -HEIGHT_HALF_EXTENT,
                "originZ": -HEIGHT_HALF_EXTENT,
                "units": "metres, relative to the reference point's own elevation",
            },
            "density": {
                "file": "density.bin",
                "width": density["n"],
                "height": density["n"],
                "cellSize": DENSITY_CELL,
                "originX": -DENSITY_HALF_EXTENT,
                "originZ": -DENSITY_HALF_EXTENT,
                "units": "0..1 real tree/vegetation cover density from ESA WorldCover",
            },
            "disturbance": {
                "file": "disturbance.bin",
                "width": disturbance["n"],
                "height": disturbance["n"],
                "cellSize": DISTURBANCE_CELL,
                "originX": -DISTURBANCE_HALF_EXTENT,
                "originZ": -DISTURBANCE_HALF_EXTENT,
                "units": "0..1 real Sentinel-1 backscatter drop, clipped between "
                f"{be.DIFF_CHANGE_THRESH} and {be.DIFF_CLIP} dB",
            },
        },
        "methodology_note": (
            "heightmap.bin is real Copernicus DEM GLO-30 elevation (30 m posting), bilinear "
            "resampled onto a 5 m local grid. density.bin and water.bin (when present) are both "
            "ESA WorldCover 10 m land cover, classified into a vegetation-density value and an "
            "open-water value per class respectively, each bilinear resampled onto a 10 m local "
            "grid. disturbance.bin is the same despeckled Sentinel-1 VV dB difference used for "
            "the evidence pack, resampled onto a 10 m local grid and linearly remapped 0..1 "
            "between the project's existing change threshold and clip. No model was trained or "
            "run to produce any of these grids."
        ),
    }
    if water is not None:
        meta["grids"]["water"] = {
            "file": "water.bin",
            "width": water["n"],
            "height": water["n"],
            "cellSize": DENSITY_CELL,
            "originX": -DENSITY_HALF_EXTENT,
            "originZ": -DENSITY_HALF_EXTENT,
            "units": "0..1 real open-water fraction from ESA WorldCover (permanent water full, "
            "herbaceous wetland partial)",
        }
        meta["water_level_m"] = water_level
        meta["water_coverage_fraction"] = round(water["coverage"], 4)
    (out_dir / "meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    print(f"Wrote {out_dir}")

    debug_dir = DEBUG_ROOT / ZONE_SLUG
    save_debug_png(height["grid"], debug_dir / "heightmap.png")
    save_debug_png(density["grid"], debug_dir / "density.png", lo=0.0, hi=1.0)
    save_debug_png(disturbance["grid"], debug_dir / "disturbance.png", lo=0.0, hi=1.0)
    if water is not None:
        save_debug_png(water["grid"], debug_dir / "water.png", lo=0.0, hi=1.0)
    print(f"Wrote debug previews to {debug_dir}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
