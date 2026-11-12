# Route200 evidence pack: Teknaf hill slopes

This folder holds a real-data proof of the core change-detection method behind Route200, for one monitored zone: Teknaf hill slopes in Chattogram, Bangladesh. It is a focused, reproducible check that the first stage of the pipeline works on public satellite data. It is not the production engine.

## What this is

Route200 flags ground-surface change on hill slopes and river channels. The simplest, most transparent version of that idea is differencing calibrated radar backscatter between two dates. Radar backscatter drops where vegetation or loose surface material is cut or stripped, and rises where new rough or wet surface appears. This pack applies exactly that operation to Sentinel-1 radar scenes over Teknaf, then adds daily optical and rainfall browse imagery for the July 2026 monsoon window when the zone was hit by landslides and flooding.

The method is plain arithmetic: convert amplitude to decibels, apply a 15x15 median filter to each date (standard speckle reduction for single-look radar amplitude, since a raw pixel-by-pixel difference is dominated by speckle noise rather than real ground change), subtract one date from another, and count pixels above or below a threshold. No model is trained, fitted or run to produce any number in this pack.

## What is real

Every image and number in `web/public/evidence/teknaf/` comes from data downloaded at build time and is traceable through `manifest.json`.

- **Radar (Sentinel-1 RTC, VV polarization).** Read directly from Microsoft Planetary Computer using anonymous, signed access. The before/after pair is 2026-05-04 and 2026-11-05, 185 days apart. Five additional passes cover the July 2026 window (2026-07-08, 07-10, 07-16, 07-20, 07-22).
- **Optical (NASA GIBS, VIIRS SNPP corrected reflectance, true colour).** Daily browse tiles for 2026-07-01 through 2026-07-25 over a wider area around Cox's Bazar and Teknaf.
- **Precipitation (NASA GIBS, IMERG precipitation rate).** Daily tiles for the same 25 days.

The per-day optical and precipitation numbers are crude pixel proxies, not calibrated products. `cloud_fraction` is the share of pixels where red, green and blue are all above 200, a rough "mostly white" measure that also catches bright non-cloud surfaces. `mean_intensity` is the mean grayscale value of the precipitation tile, which shows where rain-coloured pixels are but is not millimetres of rain.

**A real finding, left in rather than hidden:** the optical tile came back fully black, with zero valid pixels, for all six days from 2026-07-11 through 2026-07-16, exactly inside the disaster window. `cloud_fraction` is `null` for those days rather than a misleading `0.0`. This is the actual failure mode the project's own architecture cites as the reason the engine is built on radar rather than optical imagery: during the monsoon, when the information matters most, optical coverage can genuinely drop out for almost a week. The radar passes on 2026-07-16, 07-20 and 07-22 keep seeing the ground through the same stretch.

## What this is not

- It is not the NISAR-based engine that the team's architecture calls for. NISAR coverage and processing are a separate track, and this pack uses Sentinel-1 only.
- It is not a trained predictive model. The forecasting and alerting concept illustrations in the web app are a separate piece of work and do not come from this data.
- It is not a validated landslide inventory. A backscatter drop is evidence that the surface changed, not proof of what changed it. Field checks remain necessary before any alert is treated as a confirmed event.
- The thresholds (3 dB for "dropped" or "risen") are a simple, stated convention, not a calibrated decision rule.

## Reproducing it

From any directory, with the Python environment that has `rasterio`, `planetary-computer`, `pystac-client`, `numpy`, `Pillow`, `requests` and `scipy` installed:

```
"C:\Python312\python.exe" D:\race\nasaspace\route200\evidence\scripts\build_evidence.py
```

The script writes the images and `manifest.json` into `web/public/evidence/teknaf/`, overwriting earlier output. Paths are resolved relative to the script's own location, so the repository can be moved without editing it. No credentials are needed. A GIBS day that fails is retried once and, if it still fails, recorded in the manifest `notes` field.
