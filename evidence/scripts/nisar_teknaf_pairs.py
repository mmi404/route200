"""
Run the Teknaf NISAR GCOV change check over several same-track pairs.
Reuses the reader and filters in build_nisar_teknaf.py. Writes
evidence/nisar_teknaf_pairs.json.
"""
import json
import sys
from pathlib import Path

import earthaccess
import h5py
import numpy as np
from scipy.ndimage import label, median_filter

sys.path.insert(0, str(Path(__file__).parent))
import build_nisar_teknaf as base  # noqa: E402

REPO = Path(__file__).resolve().parents[2]
URL = base.BASE
GR = {
    "2026-06-25": "NISAR_L2_PR_GCOV_023_163_D_078_4005_DHDH_A_20260625T122712_20260625T122737_P05023_N_P_J_001",
    "2026-06-30": "NISAR_L2_PR_GCOV_024_069_A_012_4005_DHDH_A_20260630T232036_20260630T232102_P05023_N_P_J_001",
    "2026-07-12": "NISAR_L2_PR_GCOV_025_069_A_012_4005_DHDH_A_20260712T232036_20260712T232101_P05023_N_P_J_001",
    "2026-07-19": "NISAR_L2_PR_GCOV_025_163_D_078_4005_DHDH_A_20260719T122710_20260719T122736_P05023_N_P_J_001",
    "2026-07-24": "NISAR_L2_PR_GCOV_026_069_A_012_4005_DHDH_A_20260724T232035_20260724T232100_P05023_N_P_J_001",
}
PAIRS = [("2026-06-30", "2026-07-12"), ("2026-06-25", "2026-07-19"), ("2026-07-12", "2026-07-24")]


def load(date):
    name = GR[date]
    u = URL + name + "/" + name + ".h5"
    f = earthaccess.open([u])[0]
    with h5py.File(f, "r") as h:
        hh, epsg, (xs, ys) = base.read_window(h, base.AOI_BBOX)
    return base.to_db(hh), float(abs(xs[1] - xs[0]))


def summarize(b, a, px):
    h_ = min(b.shape[0], a.shape[0]); w_ = min(b.shape[1], a.shape[1])
    b, a = b[:h_, :w_], a[:h_, :w_]
    pb = median_filter(np.nan_to_num(b, nan=-30.0), size=base.DESPECKLE)
    pa = median_filter(np.nan_to_num(a, nan=-30.0), size=base.DESPECKLE)
    diff = pa - pb
    valid = np.isfinite(b) & np.isfinite(a)
    d = diff[valid]
    med = float(np.median(d))
    r = diff - med
    out = {
        "median_offset_db": round(med, 2),
        "pct_drop_gt_3db_raw": round(100 * float((d <= -3).mean()), 3),
        "pct_drop_gt_2db_after_offset": round(100 * float(((r <= -2) & valid).sum() / valid.sum()), 3),
        "pct_drop_gt_1db_after_offset": round(100 * float(((r <= -1) & valid).sum() / valid.sum()), 3),
    }
    mask = (r <= -1) & valid
    lab, n = label(mask)
    sizes = np.bincount(lab.ravel())[1:] if n else np.array([0])
    out["largest_drop_patch_ha_at_1db"] = round(float(sizes.max()) * px ** 2 / 1e4, 2)
    return out


def main():
    earthaccess.login(strategy="netrc")
    cache = {}
    results = []
    for before, after in PAIRS:
        for dte in (before, after):
            if dte not in cache:
                cache[dte] = load(dte)
                print("loaded", dte, flush=True)
        b, px = cache[before]
        a, _ = cache[after]
        res = {"before": before, "after": after, "track": GR[after].split("_")[4:8]}
        res.update(summarize(b, a, px))
        print(res, flush=True)
        results.append(res)
    (REPO / "evidence" / "nisar_teknaf_pairs.json").write_text(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
