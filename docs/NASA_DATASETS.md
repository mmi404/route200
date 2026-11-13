# NASA and partner datasets used by Route200

Each entry gives the dataset, where to get it, how Route200 uses it, the code that builds it, and the processed outputs stored in this repo. Processed outputs are indexed in [data/README.md](../data/README.md). Teknaf is the Chattogram Hill Tracts reference point (AOI 92.26–92.34 E, 21.51–21.59 N).

## NASA data

### 1. NISAR GCOV, Provisional (NISAR_L2_GCOV_PROVISIONAL_V1)

- Link: https://search.earthdata.nasa.gov/search/granules?p=C2854338529-ASF (concept C2854338529-ASF, hosted by ASF)
- Access: NASA Earthdata Login through `earthaccess` (netrc), windowed HDF5 reads only
- How we used it: four same-track pass pairs over Teknaf: 30 Jun to 12 Jul, 25 Jun to 19 Jul, 12 Jul to 24 Jul, and 30 Jun to 24 Jul. HH backscatter (10 m, EPSG:32646) was converted to dB, despeckled with a 15 px median, and differenced after the median offset was removed.
- Result: no pixel dropped by 3 dB or more in any pair (0.0% in all four). The 30 Jun to 12 Jul pair's 1 dB change pixels fall within 100 m of the Sentinel-1 scar at 34.8%, against a 17.3% background rate. That is about twice the background, which is weak.
- Status: Provisional product, used as a negative check. Not a detection.
- Code: `evidence/scripts/build_nisar_teknaf.py` (reader and filters), `nisar_teknaf_pairs.py` (pairs and statistics), `nisar_vs_s1_overlap.py` (scar overlap). Granule IDs are listed in `nisar_teknaf_pairs.py`.
- Processed outputs: `data/nisar/teknaf/` (dB arrays, frames, sequence video), `data/nisar/no_change/` (difference array and video), `evidence/nisar_teknaf_stats.json`, `evidence/nisar_teknaf_pairs.json`, `evidence/nisar_s1_overlap.json`.

### 2. Landsat Collection 2 Level-2 surface reflectance (Landsat 5, 7, 8, 9)

- Link: https://planetarycomputer.microsoft.com/dataset/landsat-c2-l2 (STAC collection `landsat-c2-l2`, anonymous access)
- How we used it: NDVI from the red and NIR bands, mapped to a 0 to 1 density with one fixed remap (`clip((NDVI - 0.0) / (0.9 - 0.0), 0, 1)`). 21 cloud-screened scenes at the Teknaf reference point, 10 Feb 1990 to 18 Oct 2026, drive the vegetation timeline and the scrub slider in the Ground View. Scenes where more than 30% of the local window is flagged as cloud, shadow or Landsat 7 scan-line gap were rejected.
- Code: `evidence/scripts/build_ground_density_timeline.py`
- Processed outputs: `web/public/ground-data/teknaf/density_timeline/` (one density grid per sample) and `density_timeline.json`, plus the sample table `data/landsat/teknaf_ndvi_samples.csv`.
- Used in: the Ground View page (`web/app/map/[zoneId]/ground/`).

### 3. NASA GIBS true colour (MODIS Terra, with VIIRS SNPP where MODIS had no data)

- Link: https://earthdata.nasa.gov/gibs (WMS: `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi`)
- Layers: `MODIS_Terra_CorrectedReflectance_TrueColor` (primary), `VIIRS_SNPP_CorrectedReflectance_TrueColor` (fallback)
- How we used it: daily frames of the Chattogram Hill Tracts, 1 to 25 July 2026, for the flood-context sequence in the video. Days with no data in either layer (11, 14 and 16 July) are left out, not filled in. Most frames are cloud-covered, so the floods are hard to see in them. VIIRS covers 6, 9, 19 and 24 July.
- Code: `data/gibs/scripts/fetch_gibs_july.py` (download, bounding box 91.5, 21.5, 92.5, 23.5, 800 x 800 px), `data/gibs/scripts/make_gibs_frames.py` (labelled frames and concat list).
- Processed outputs: `data/gibs/frames/` (22 frames), `data/gibs/list.txt`, `data/gibs/gibs_cht_july2026.mp4`, `media/gibs_full.mp4`.
- Note: the video clips in `media/` were rendered from an earlier download of the same dates. The frames in `data/gibs/frames/` come from the script above, so they can differ slightly in framing from the clips.
- Used in: the video only for the July flood sequence.

### 4. NASA GIBS IMERG precipitation

- Layer: `IMERG_Precipitation_Rate`, served through the same GIBS endpoint.
- How we used it: precipitation frames for each hill zone's evidence pack, in the evidence page, to show the rain before and during the July 2026 event.
- Code: `evidence/scripts/build_evidence.py` (`PRECIP_LAYER`, `part3_daily_gibs`)
- Processed outputs: `web/public/evidence/<zone>/precip_timeline/`
- Not in the original form list. Add it to the NASA entries of the submission.

## Other space agency data (ESA and Copernicus)

### 5. Sentinel-1 RTC (Copernicus, Sentinel-1 radar)

- Link: https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc (collection `sentinel-1-rtc`, VV, radiometrically terrain-corrected)
- Our current change engine. Before and after radar pairs for each zone's evidence page. The Teknaf scar comes from a May to November 2026 pair: `S1A_IW_GRDH_1SDV_20260504T234811_20260504T234836_064374_081B35_rtc` and `S1D_IW_GRDH_1SDV_20261105T115504_20261105T115529_005332_00A26C_rtc` (185 days apart).
- Code: `evidence/scripts/build_evidence.py` (`part1_before_after`, `part2_july_sar`)
- Processed outputs: `web/public/evidence/<zone>/` (before, after and difference PNGs, dated SAR frames, `manifest.json`).
- Used in: the per-zone evidence pages.

### 6. Copernicus DEM GLO-30 (30 m elevation)

- Link: https://planetarycomputer.microsoft.com/dataset/cop-dem-glo-30
- Real terrain height for the Teknaf and Sonatola ground views. Teknaf's reference point is 269.73 m above sea level. Sonatola's is 14.61 m.
- Code: `evidence/scripts/build_ground_terrain.py`
- Processed outputs: `web/public/ground-data/<zone>/heightmap.bin` and `meta.json`.
- Used in: the Ground View page.

### 7. ESA WorldCover 10 m (land cover)

- Link: https://planetarycomputer.microsoft.com/dataset/esa-worldcover (2021 v200, items `ESA_WorldCover_10m_2021_v200_N21E090` for Teknaf and `N24E087` for Sonatola)
- Land-cover density in the ground views, which sets how much forest or bare ground is drawn. Sonatola reads as cropland and bare ground, and Teknaf as closed forest.
- Code: `evidence/scripts/build_ground_terrain.py` (land-cover to density grid, water class handling)
- Processed outputs: `web/public/ground-data/<zone>/density.bin` and `disturbance.bin`.
- Used in: the Ground View page.

## Planned, not used yet

- CEGIS historical erosion polygons: planned ground truth for the Jamuna zones. Not downloaded or used in any output.
- NISAR GUNW (interferometric) products: not used. The pipeline does amplitude change detection.
- NISAR Beta and Validated GCOV collections: searched, not used. The results above use only the Provisional collection.
