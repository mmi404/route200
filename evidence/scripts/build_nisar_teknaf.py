"""
Teknaf NISAR GCOV pair: before/after HH backscatter change over the zone AOI.

Streams two NISAR L2 GCOV (provisional) granules from ASF over Earthdata Login
(netrc), reads only the AOI window of the frequencyA HHHH grid, converts to dB,
despeckles with the same 15 px median used by build_evidence.py, and differences.

Pair: 2026-06-30 (before) and 2026-07-24 (after), track 069 frame 012, ascending.
Outputs JSON stats to evidence/nisar_teknaf_stats.json (repo root relative).
"""
import json
from pathlib import Path

import earthaccess
import h5py
import numpy as np
from rasterio.warp import transform_bounds
from rasterio.crs import CRS
from scipy.ndimage import median_filter

REPO = Path(__file__).resolve().parents[2]
BASE = "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/NISAR_L2_GCOV_PROVISIONAL_V1/"
GRANULES = {
    "before": BASE + "NISAR_L2_PR_GCOV_024_069_A_012_4005_DHDH_A_20260630T232036_20260630T232102_P05023_N_P_J_001/NISAR_L2_PR_GCOV_024_069_A_012_4005_DHDH_A_20260630T232036_20260630T232102_P05023_N_P_J_001.h5",
    "after": BASE + "NISAR_L2_PR_GCOV_026_069_A_012_4005_DHDH_A_20260724T232035_20260724T232100_P05023_N_P_J_001/NISAR_L2_PR_GCOV_026_069_A_012_4005_DHDH_A_20260724T232035_20260724T232100_P05023_N_P_J_001.h5",
}
AOI_BBOX = (92.26, 21.51, 92.34, 21.59)  # lon/lat, same as build_evidence.py Teknaf
DESPECKLE = 15
CHANGE_DB = 3.0
GRID = "science/LSAR/GCOV/grids/frequencyA"


def read_window(f, aoi_lonlat):
    grid = f[GRID]
    epsg = int(grid["projection"][()])
    crs = CRS.from_epsg(epsg)
    x = grid["xCoordinates"][:]
    y = grid["yCoordinates"][:]
    w, s, e, n = transform_bounds(CRS.from_epsg(4326), crs, *aoi_lonlat)
    cols = np.where((x >= w) & (x <= e))[0]
    rows = np.where((y <= n) & (y >= s))[0]
    r0, r1 = rows.min(), rows.max() + 1
    c0, c1 = cols.min(), cols.max() + 1
    # pad so the despeckle window has real context on all sides
    pad = DESPECKLE
    r0, c0 = max(r0 - pad, 0), max(c0 - pad, 0)
    r1, c1 = min(r1 + pad, y.size), min(c1 + pad, x.size)
    hh = grid["HHHH"][r0:r1, c0:c1].astype(np.float64)
    return hh, epsg, (x[c0:c1], y[r0:r1])


def to_db(lin):
    with np.errstate(divide="ignore", invalid="ignore"):
        db = 10.0 * np.log10(lin)
    db[~np.isfinite(db)] = np.nan
    return db


def main():
    earthaccess.login(strategy="netrc")
    results = {}
    arrays = {}
    for label, url in GRANULES.items():
        f = earthaccess.open([url])[0]
        with h5py.File(f, "r") as h:
            hh, epsg, (xs, ys) = read_window(h, AOI_BBOX)
        arrays[label] = to_db(hh)
        results[label] = {"epsg": epsg, "shape": list(hh.shape),
                          "pixel_m": float(abs(xs[1] - xs[0]))}
        print(label, results[label], flush=True)

    b, a = arrays["before"], arrays["after"]
    # both granules must cover the same window; crop to common shape
    h_ = min(b.shape[0], a.shape[0]); w_ = min(b.shape[1], a.shape[1])
    b, a = b[:h_, :w_], a[:h_, :w_]
    pb = median_filter(np.nan_to_num(b, nan=-30.0), size=DESPECKLE)
    pa = median_filter(np.nan_to_num(a, nan=-30.0), size=DESPECKLE)
    diff = pa - pb
    valid = np.isfinite(b) & np.isfinite(a)
    d = diff[valid]
    drop = d <= -CHANGE_DB
    rise = d >= CHANGE_DB
    px_m2 = results["after"]["pixel_m"] ** 2
    stats = {
        "pair": {"before": "2026-06-30", "after": "2026-07-24",
                 "track_frame": "069/012", "orbit_pass": "ascending"},
        "aoi_bbox_lonlat": AOI_BBOX,
        "valid_pixels": int(valid.sum()),
        "pixel_m": results["after"]["pixel_m"],
        "pct_backscatter_drop_gt_3dB": round(100 * drop.mean(), 2),
        "area_drop_m2": round(float(drop.sum() * px_m2), 1),
        "pct_backscatter_rise_gt_3dB": round(100 * rise.mean(), 2),
        "median_diff_db": round(float(np.median(d)), 2),
        "epsg": results["after"]["epsg"],
    }
    out = REPO / "evidence" / "nisar_teknaf_stats.json"
    out.write_text(json.dumps(stats, indent=2))
    np.save(Path(__file__).with_name("nisar_teknaf_diff.npy"), diff)
    print(json.dumps(stats, indent=2))


if __name__ == "__main__":
    main()
