# NASA and partner datasets used by Route200

Each entry: dataset name, where to get it, and how Route200 uses it. Teknaf is the Chattogram Hill Tracts reference point (AOI 92.26–92.34 E, 21.51–21.59 N).

## NASA

### 1. NISAR GCOV, Provisional (NISAR_L2_GCOV_PROVISIONAL_V1)
- Link: https://search.earthdata.nasa.gov/search/granules?p=C2854338529-ASF (CMR concept C2854338529-ASF, hosted by ASF)
- Access: NASA Earthdata Login, read through earthaccess (netrc), windowed HDF5 reads only
- How we used it: four same-track, same-direction pass pairs over Teknaf (30 Jun to 12 Jul, 25 Jun to 19 Jul, 12 Jul to 24 Jul, and 30 Jun to 24 Jul). Backscatter (HHHH, 10 m, UTM 46N) was converted to dB, despeckled with a 15 px median, and differenced. Result: no pixel changed by 3 dB or more in the event window. The 30 Jun to 12 Jul pair was compared with the Sentinel-1 scar: 34.8% of 1 dB change pixels fall within 100 m of it, against a 17.3% background rate.
- Status: Provisional product, used as a negative check. Not a detection.
- Scripts: `evidence/scripts/build_nisar_teknaf.py`, `nisar_teknaf_pairs.py`, `nisar_vs_s1_overlap.py`
- Outputs: `evidence/nisar_teknaf_stats.json`, `evidence/nisar_teknaf_pairs.json`, `evidence/nisar_s1_overlap.json`

### 2. Landsat Collection 2 Level-2 surface reflectance (Landsat 5, 7, 8, 9)
- Link: https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2 (STAC collection `landsat-c2-l2`, anonymous access)
- How we used it: NDVI from the red and NIR bands, mapped to a 0 to 1 density with one fixed formula. 21 samples over the Teknaf reference point from 10 Feb 1990 to 26 Sep 2026 drive the vegetation timeline in the Ground View and the scrub slider. Scenes with more than 30% of the local window flagged as cloud, shadow or Landsat 7 scan-line gaps were rejected.
- Scripts: `evidence/scripts/build_ground_density_timeline.py`
- Output: `web/public/ground-data/teknaf/density_timeline/`

### 3. NASA GIBS daily true-colour imagery (July 2026)
- Link: https://earthdata.nasa.gov/gibs (WMS endpoint `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi`)
- Layers: `MODIS_Terra_CorrectedReflectance_TrueColor` (primary) and `VIIRS_SNPP_CorrectedReflectance_TrueColor` (for days MODIS had no data)
- How we used it: daily frames of the Chattogram Hill Tracts, 1 to 25 July 2026, for the flood-context sequence in the video. Days with no data in either layer (11, 14, 16 July) are left out, not filled in. Most frames are cloud-covered, so the floods are hard to see in them.
- Used in: the video (`video/animations/gibs/`), not in the web app.

### 4. NASA GPM IMERG precipitation (via GIBS)
- Layer: IMERG precipitation rate, served through the same GIBS WMS endpoint
- How we used it: precipitation frames in each zone's evidence pack (`web/public/evidence/<zone>/precip_timeline/`) to show the rain before the July 2026 event.
- Processed outputs and scripts: see `data/README.md`.

## Other data (not NASA, for context)

- **Sentinel-1 RTC (Copernicus)**: Microsoft Planetary Computer, collection `sentinel-1-rtc`. The current change engine. Used for the per-zone before and after evidence pages and the Teknaf scar (May to November 2026).
- **Copernicus DEM GLO-30**: Planetary Computer, `cop-dem-glo-30`. Real elevation for the Teknaf and Sonatola ground views.
- **ESA WorldCover 10 m**: Planetary Computer, `esa-worldcover`. Land-cover density for the ground views.
- **CEGIS historical erosion polygons**: reference ground truth for the Jamuna zones (planned use, not yet in the risk model).

## Not yet used

- NISAR GUNW (interferometric) products: not used. The pipeline does amplitude change detection.
- NISAR Beta and Validated GCOV collections: searched, but the results above use only the Provisional collection.
