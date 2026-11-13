# Route200 processed data

This folder holds the processed outputs behind the NASA Space Apps 2026 submission: the derived rasters, frames, tables and videos, with the scripts that produced them. Raw downloads (HDF5 granules, GeoTIFF tiles, STAC assets) are not stored here. Each entry below names its source so it can be fetched and rebuilt.

Large `.mp4` and `.npy` files are stored with Git LFS.

## NASA datasets

### NISAR GCOV Provisional (NISAR_L2_GCOV_PROVISIONAL_V1, ASF, concept C2854338529-ASF)

Teknaf HH backscatter (10 m, UTM 46N), converted to dB.

| Path | What it is |
|---|---|
| `nisar/teknaf/hh_db_<date>.npy` | HH backscatter in dB for 2026-06-25, 06-30, 07-12, 07-19, 07-24 |
| `nisar/teknaf/frame_<date>.png` | Rendered frame for each date |
| `nisar/teknaf/list.txt` | ffmpeg concat list for the sequence |
| `nisar/teknaf/nisar_teknaf_hh_2026.mp4` | 2026 NISAR Teknaf sequence |
| `nisar/teknaf/scripts/build_nisar.py`, `make_nisar_mp4.py` | Build the arrays, frames and video |
| `nisar/no_change/nisar_teknaf_diff.npy` | Despeckled difference used for the no-change check |
| `nisar/no_change/nisar_no_change_12s.mp4`, `build_no_change.py` | No-change video and its builder |
| `../evidence/nisar_teknaf_stats.json`, `nisar_teknaf_pairs.json`, `nisar_s1_overlap.json` | Pair statistics and the overlap with the Sentinel-1 scar |
| `../evidence/scripts/build_nisar_teknaf.py`, `nisar_teknaf_pairs.py`, `nisar_vs_s1_overlap.py` | Reader, filters and statistics |

Pairs used: 30 Jun to 12 Jul, 25 Jun to 19 Jul, 12 Jul to 24 Jul, and 30 Jun to 24 Jul. Filter: 15 px median despeckle, median offset removed, 3 dB and 1 dB thresholds. The product is Provisional and is used as a negative check, not a detection.

### Landsat Collection 2 Level-2 (Microsoft Planetary Computer, `landsat-c2-l2`)

| Path | What it is |
|---|---|
| `landsat/teknaf_ndvi_samples.csv` | 21 samples, 1990 to 2026: scene, platform, cloud cover, clear fraction, mean NDVI, mean density |
| `../web/public/ground-data/teknaf/density_timeline/*.bin`, `density_timeline.json` | Per-sample density grids used by the Ground View slider |
| `../evidence/scripts/build_ground_density_timeline.py` | Builder |

Density is `clip((NDVI - 0.0) / (0.9 - 0.0), 0, 1)`, a plain threshold remap. Scenes with more than 30% of the local window flagged as cloud, shadow or Landsat 7 scan-line gaps were rejected.

### NASA GIBS (MODIS Terra and VIIRS SNPP true colour, and IMERG precipitation)

| Path | What it is |
|---|---|
| `gibs/frames/f_2026-07-<dd>.png` | Daily true-colour frames, 1 to 25 July 2026, MODIS with VIIRS fallback. 11, 14 and 16 July have no usable image and are left out. |
| `gibs/list.txt` | Concat list for the frames |
| `gibs/gibs_cht_july2026.mp4` | Flood-context sequence, 23 s, rebuilt from `gibs/frames/` |
| `gibs/scripts/fetch_gibs_july.py` | Downloads the daily tiles into `gibs/raw/` (not committed). MODIS first, VIIRS when MODIS is blank. |
| `gibs/scripts/make_gibs_frames.py` | Labels the tiles and writes `frames/` and `list.txt` |
| `media/gibs_full.mp4` | Full-frame 1920x1080 version |
| `../web/public/evidence/<zone>/precip_timeline/` | IMERG precipitation frames used in the zone evidence packs |

Layers: `MODIS_Terra_CorrectedReflectance_TrueColor`, `VIIRS_SNPP_CorrectedReflectance_TrueColor`, and the IMERG precipitation rate layer. The IMERG layer is not listed in the submission form, though the evidence packs use it.

## Partner datasets (not NASA)

### Sentinel-1 RTC (Copernicus, Microsoft Planetary Computer, `sentinel-1-rtc`)

Current change engine. Teknaf before/after: `S1A_IW_GRDH_1SDV_20260504T234811...` and `S1D_IW_GRDH_1SDV_20261105T115504...`, VV, 185 days apart.

| Path | What it is |
|---|---|
| `../web/public/evidence/<zone>/sar_before_*.png`, `sar_after_*.png`, `sar_diff_*.png` | Before, after and difference images for each zone |
| `../web/public/evidence/<zone>/sar_timeline/` | Dated SAR frames |
| `../web/public/evidence/<zone>/manifest.json` | Scene IDs, dates, and change statistics |
| `../evidence/scripts/build_evidence.py` | Builder for the evidence packs |

### Copernicus DEM GLO-30 (`cop-dem-glo-30`)

Teknaf reference elevation 269.73 m. Heightmap and scene DEM for the Teknaf and Sonatola ground views.

| Path | What it is |
|---|---|
| `../web/public/ground-data/teknaf/heightmap.bin`, `meta.json` | 73x73 grid, 5 m cells, relative to the reference point |
| `../web/public/ground-data/sonatola/heightmap.bin`, `meta.json` | Same for Sonatola |
| `../evidence/scripts/build_ground_terrain.py` | Builder |

### ESA WorldCover 10 m (`esa-worldcover`)

Land-cover density for the ground views. Teknaf item: `ESA_WorldCover_10m_2021_v200_N21E090`.

| Path | What it is |
|---|---|
| `../web/public/ground-data/<zone>/density.bin`, `disturbance.bin` | Density and disturbance grids for the views |

## Media

| Path | What it is |
|---|---|
| `../media/route200_full_merged.mp4` | Final 230.34 s video, 1920x1080 |
| `../media/clips/intro_1_Mahi.mp4` to `intro_6_Arik.mp4` | Member name cards, in the order used in the video (clip 3 is Tanim) |
| `../media/clips/7.mp4` to `13.mp4` | Seven processed clips the final video is built from, in order. `8.mp4` is the longest at 63.14 s. |
| `../media/scripts/intro/build_intro*.py`, `build_tanim.py` | Name card builders (Pillow frames, whoosh sound, sliding and angled cards) |
| `../media/scripts/thumb_build.py` | Thumbnail builder (uses `media/nisar_frame_2026-07-12.png`, a NISAR 12 July frame) |
| `../media/thumbnail_1280x720.jpg` | Thumbnail |
| `../media/youtube_upload.md` | Title, description, tags and settings |
| `../media/gibs_nisar_merged_21s.mp4`, `nisar_full.mp4`, `build_full.py` | Sequence clips and the full-frame builder |

## Not used yet

- CEGIS historical erosion polygons: planned as ground truth for the Jamuna zones. Not downloaded or used in any output here.
- NISAR GUNW and the Beta and Validated GCOV collections: searched, not used.
- Raw granules and COGs: not stored (size). They can be fetched from the sources above with the scripts.
