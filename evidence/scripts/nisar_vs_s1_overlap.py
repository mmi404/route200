"""
Does the NISAR 30 Jun -> 12 Jul 2026 change patch sit on the Sentinel-1 scar?

- NISAR: recompute the 30 Jun -> 12 Jul diff (15 px median, offset removed),
  list patches >= 1 ha at <= -1 dB, with UTM 32646 centroids.
- Sentinel-1: recompute the team's May -> Nov RTC drop mask (<= -3 dB, 15 px
  median), same scene ids as build_evidence.py.
- Report overlap in UTM coordinates. Writes evidence/nisar_s1_overlap.json.
"""
import json
import sys
from pathlib import Path

import earthaccess
import h5py
import numpy as np
import planetary_computer
import pystac_client
import rasterio
from rasterio.warp import transform_bounds
from rasterio.windows import from_bounds
from scipy.ndimage import label, median_filter, center_of_mass, binary_dilation

sys.path.insert(0, str(Path(__file__).parent))
import build_nisar_teknaf as base  # noqa: E402
import nisar_teknaf_pairs as pairs  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
S1 = {
    "before": "S1A_IW_GRDH_1SDV_20260504T234811_20260504T234836_064374_081B35_rtc",
    "after": "S1D_IW_GRDH_1SDV_20261105T115504_20261105T115529_005332_00A26C_rtc",
}


def nisar_window(date):
    name = pairs.GR[date]
    f = earthaccess.open([base.BASE + name + "/" + name + ".h5"])[0]
    with h5py.File(f, "r") as h:
        hh, _, (xs, ys) = base.read_window(h, base.AOI_BBOX)
    return base.to_db(hh), xs, ys


def s1_window(item_id):
    cat = pystac_client.Client.open("https://planetarycomputer.microsoft.com/api/stac/v1")
    item = planetary_computer.sign(cat.get_collection("sentinel-1-rtc").get_item(item_id))
    with rasterio.open(item.assets["vv"].href) as src:
        w, s, e, n = transform_bounds("EPSG:4326", src.crs, *base.AOI_BBOX)
        win = from_bounds(w, s, e, n, src.transform)
        arr = src.read(1, window=win).astype(np.float64)
        tr = src.window_transform(win)
        crs = str(src.crs)
    with np.errstate(divide="ignore", invalid="ignore"):
        db = 10 * np.log10(arr)
    db[~np.isfinite(db)] = np.nan
    return db, tr, crs


def despeckled_diff(b, a):
    h = min(b.shape[0], a.shape[0]); w = min(b.shape[1], a.shape[1])
    b, a = b[:h, :w], a[:h, :w]
    valid = np.isfinite(b) & np.isfinite(a)
    d = median_filter(np.nan_to_num(a, nan=-30.0), 15) - median_filter(np.nan_to_num(b, nan=-30.0), 15)
    return d, valid


def main():
    earthaccess.login(strategy="netrc")

    nb, xs, ys = nisar_window("2026-06-30")
    na, _, _ = nisar_window("2026-07-12")
    d, valid = despeckled_diff(nb, na)
    r = d - np.median(d[valid])
    n_mask = (r <= -1) & valid
    px = abs(xs[1] - xs[0]) * abs(ys[1] - ys[0]) / 1e4  # ha per pixel
    lab, n = label(n_mask)
    nisar_patches = []
    for i in range(1, n + 1):
        m = lab == i
        ha = m.sum() * px
        if ha >= 1.0:
            rr, cc = center_of_mass(m)
            nisar_patches.append({"ha": round(float(ha), 2),
                                  "easting": round(float(np.interp(cc, np.arange(xs.size), xs))),
                                  "northing": round(float(np.interp(rr, np.arange(ys.size), ys)))})
    nisar_patches.sort(key=lambda p: -p["ha"])

    sb, s_tr, s_crs = s1_window(S1["before"])
    sa, _, _ = s1_window(S1["after"])
    sd, svalid = despeckled_diff(sb, sa)
    s_mask = (sd <= -3) & svalid
    s_px_ha = abs(s_tr.a * s_tr.e) / 1e4
    s_ha = float(s_mask.sum() * s_px_ha)

    # distance-based overlap: NISAR patch pixels that fall within 100 m of an S1 scar pixel
    s_dil = binary_dilation(s_mask, iterations=10)  # 10 px ~ 100 m at 10 m spacing
    n_pix_on_s1 = 0
    if n_mask.any():
        # sample NISAR patch pixels, map to S1 grid through UTM coords
        rows, cols = np.nonzero(n_mask)
        e = np.interp(cols, np.arange(xs.size), xs)
        nn = np.interp(rows, np.arange(ys.size), ys)
        inv = ~s_tr
        sc, sr = inv * (e, nn)
        sc = np.round(sc).astype(int); sr = np.round(sr).astype(int)
        ok = (sr >= 0) & (sr < s_mask.shape[0]) & (sc >= 0) & (sc < s_mask.shape[1])
        n_pix_on_s1 = int(s_dil[sr[ok], sc[ok]].sum())
        total = int(n_mask.sum())
    else:
        total = 0

    out = {
        "nisar_pair": "2026-06-30 -> 2026-07-12 (track 069/012)",
        "nisar_patches_ge_1ha_at_1db": nisar_patches,
        "s1_pair": "2026-05-04 -> 2026-11-05 (team evidence pair)",
        "s1_scar_ha_at_3db": round(s_ha, 1),
        "s1_crs": s_crs,
        "nisar_1db_pixels": total,
        "share_nisar_1db_within_100m_of_s1_scar_pct": round(100 * n_pix_on_s1 / total, 1) if total else None,
        "baseline_aoi_within_100m_of_s1_scar_pct": round(100 * float(s_dil[svalid].mean()), 1),
    }
    (REPO / "evidence" / "nisar_s1_overlap.json").write_text(json.dumps(out, indent=2))
    print(json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
