"""Fetch daily NASA GIBS true-colour tiles for the Chattogram Hill Tracts, July 2026.

For each day 1 to 25 July:
  1. Try MODIS Terra true colour (primary).
  2. If that tile is blank (GIBS returns a small empty image for no-data days),
     try VIIRS SNPP true colour.
  3. If both are blank, record the day as a gap and skip it. Gaps are not filled.

Raw tiles are written to data/gibs/raw/ and are not committed (see .gitignore).
Run build_gibs.py afterwards to make the labelled frames.

Usage: python fetch_gibs_july.py
"""
import os
import time

import requests

GIBS_BASE = "https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi"
MODIS = "MODIS_Terra_CorrectedReflectance_TrueColor"
VIIRS = "VIIRS_SNPP_CorrectedReflectance_TrueColor"
# WMS 1.3.0 with CRS=EPSG:4326 uses lat/lon axis order: min lat, min lon, max lat, max lon.
# This is the exact request used for the frames in the video (verified byte-identical, July 1).
BBOX = (21.0, 91.6, 23.0, 92.6)
SIZE = 800
# Blank GIBS tiles are small JPEGs. These thresholds match build_gibs.py.
MODIS_MIN_BYTES = 15000
VIIRS_MIN_BYTES = 4100

HERE = os.path.dirname(os.path.abspath(__file__))
RAW = os.path.normpath(os.path.join(HERE, "..", "raw"))


def fetch(layer, day):
    qs = (
        f"SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&LAYERS={layer}"
        f"&TIME={day}&CRS=EPSG:4326"
        f"&BBOX={','.join(str(v) for v in BBOX)}"
        f"&WIDTH={SIZE}&HEIGHT={SIZE}&FORMAT=image/jpeg"
    )
    for attempt in range(3):
        try:
            r = requests.get(GIBS_BASE + "?" + qs, timeout=60)
            if r.status_code == 200:
                return r.content
        except requests.RequestException:
            pass
        time.sleep(2 * (attempt + 1))
    return b""


def main():
    os.makedirs(RAW, exist_ok=True)
    report = []
    for d in range(1, 26):
        day = f"2026-07-{d:02d}"
        modis = fetch(MODIS, day)
        if len(modis) > MODIS_MIN_BYTES:
            with open(os.path.join(RAW, f"gibs_{day}.jpg"), "wb") as f:
                f.write(modis)
            report.append((day, "MODIS", len(modis)))
            continue
        viirs = fetch(VIIRS, day)
        if len(viirs) > VIIRS_MIN_BYTES:
            with open(os.path.join(RAW, f"viirs_{day}.jpg"), "wb") as f:
                f.write(viirs)
            report.append((day, "VIIRS", len(viirs)))
        else:
            report.append((day, "gap", 0))
    for day, src, n in report:
        print(day, src, n)


if __name__ == "__main__":
    main()
