# Route200: Project Summary

**CUET_404**, NASA International Space Apps Challenge 2026 (Bangladesh, Chattogram local round), Challenge #6: *Dancing with the SARs*.

## The problem

NASA-ISRO's NISAR mission watches rivers and hillsides from space and releases radar change data within 1-2 days normally, within hours during disaster response. Bangladesh's own CEGIS has tracked Jamuna riverbank erosion every year since 2004. The data exists. Almost none of it reaches a farmer standing on a collapsing riverbank, or a family on a landslide-prone hillside in Chattogram, before the ground moves. Only 37% of Bangladeshi youth even know climate change is already affecting them.

## The approach

One shared SAR change-detection pipeline, feeding two audiences from the same data:

- **A public web experience**: an interactive risk map of 12 named zones along the Jamuna river (riverbank erosion) and across the Chattogram Hill Tracts (landslide risk), a real satellite evidence page per zone, a walkable 3D ground-level scene built from real elevation and land-cover data, and a Bangla-first narrative that makes the risk legible and shareable.
- **A direct alert channel**: SMS and Bangla voice-call signup for households in a risk zone, no app, no smartphone, no data plan required.

Rather than full InSAR interferometry, the pipeline uses amplitude/backscatter change detection: differencing SAR amplitude between two dates to delineate open water and bare-surface change. This works through monsoon cloud cover, when optical satellites fail and the information matters most.

## What is built today

- **Interactive map** (`/map`): all 12 zones (6 Jamuna erosion, 6 Chattogram Hill Tracts landslide), severity legend, zone inspect panel, Bangla/English toggle.
- **Real satellite evidence** (`/map/[zoneId]/evidence`): for all 6 CHT landslide zones, a real Sentinel-1 before/after SAR scene pair, despeckled and differenced to show the actual measured change, with dates, area, and severity cited to source.
- **Walkable ground view** (`/map/[zoneId]/ground`): a first-person 3D scene calculated from real data, not invented. For Teknaf (landslide) and Sonatola (riverbank erosion), real Copernicus DEM elevation, real ESA WorldCover land cover, and the real Sentinel-1 disturbance footprint drive the actual terrain, vegetation, and scar shape, anchored to the real location where the change happened. A time slider scrubs through a real multi-decade Landsat vegetation record (1990-2026) at Teknaf, showing the slope's decline years before its 2026 collapse rather than a single before/after snapshot.
- **Alert signup** (`/alerts`): SMS and Bangla voice-call opt-in for a chosen zone.
- **Bangla-first throughout**: full translation layer, Bangla zone names, a real locale toggle, not a static stub.

The other 10 zones and the production change-detection engine (NISAR GUNW, with a Sentinel-1 fallback already proven out) are architected and documented (`docs/ARCHITECTURE.md`) but not yet built at the same depth; the web app consumes a mock data layer shaped exactly like that engine's eventual output, so connecting it later is a data-source swap, not a rewrite (`docs/WEB_DATA_CONTRACT.md`).

## Data sources

Copernicus Sentinel-1 SAR (amplitude change detection, the NISAR-equivalent signal available today), Copernicus DEM GLO-30 (elevation), ESA WorldCover 10m (land cover), Landsat (multi-decade NDVI vegetation history), CEGIS historical erosion polygons (ground-truth reference). All fetched anonymously through Microsoft Planetary Computer; no data is fabricated, every number on screen traces back to a real scene and date.

## Tech stack

Python (NumPy, rasterio/xarray) for the data pipeline; Next.js + TypeScript + Tailwind + MapLibre GL JS + Three.js for the web experience; Vitest for automated tests; Postgres/Supabase planned for the live data layer (mock API today, same contract).

## Team

| Member | Role |
|---|---|
| Mahi | Team lead; cross-track integration |
| Raisa | Research & strategy; SAR/NISAR domain research |
| Tanim | Web & ML pipeline engineering |
| Faladun | Systems, data layer, alert delivery |
| Talha | Creative lead; visual identity, video direction |
| Arik | Video production; filming, editing |
