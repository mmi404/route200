# Route200: YouTube upload details

## Video file
route200_full_merged.mp4 (1920x1080, 230.3 s, 30 fps, H.264 + AAC)

## Thumbnail
thumbnail_1280x720.jpg (1280x720, JPEG, 228 KB)

## Title (76 characters)
Route200: Satellite Alerts for Bangladesh's Landslides and Erosion | NASA Space Apps 2026

## Description
Route200 turns satellite change into plain-language SMS and voice alerts for landslide and riverbank erosion risk in Bangladesh. It is built for people with only a feature phone: no app, no smartphone, no data plan, no login.

Our challenge is NASA Space Apps 2026, Challenge 6: Dancing with the SARs (NISAR). Team CUET_404.

How it works: the change engine compares radar images of the same place at two dates and measures how much the backscatter changes. When a zone's change score crosses a severity threshold, households registered in that zone receive an SMS and a Bangla voice call. The engine uses Sentinel-1 radar through Microsoft Planetary Computer. The web app covers 12 risk zones: six along the Jamuna riverbank and six across the Chattogram Hill Tracts. For the hill zones, it shows real satellite evidence and a 3D ground view of the Teknaf hillside, built from real elevation, land cover and Landsat vegetation records from 1990 to 2026.

NASA data:
- NISAR (L-band, 12-day repeat, via NASA Earthdata): Provisional GCOV products over Teknaf, June to July 2026. No change passed our 3 dB threshold in that period.
- Landsat (1990 to 2026): vegetation timeline for the Teknaf hillside.
- NASA GIBS: daily imagery of the July 2026 floods in the Chattogram Hill Tracts.

Limitations: the risk score is an illustrative formula, not a trained model. The Jamuna zones have no radar evidence pages yet. The NISAR result is a negative check, not a detection.

Next: run the engine on NISAR's full archive, train the risk model on ground-truth records such as CEGIS erosion polygons, and partner with a telecom operator to deliver alerts to every household in range.

Project page and source: https://github.com/mmi404/route200

## Tags
NASA Space Apps, Space Apps 2026, NISAR, NASA, ISRO, Sentinel-1, Landsat, SAR, radar, Bangladesh, landslide, riverbank erosion, Teknaf, Chattogram, Jamuna, early warning, SMS alerts, feature phone, climate, CUET_404, Route200

## Settings
- Language: English (Bangla narration in the video; add Bangla title if you want a Bangla version)
- Category: Science & Technology
- Visibility: Public or Unlisted, as you prefer for judging
- Audience: Not made for kids
- Altered or synthetic content: No (the NISAR and GIBS frames are real imagery; the Landsat timeline and the 404 to 200 graphics are edited presentation)
- Chapters: not added. Add timestamps from the final timeline once the cut points are fixed, and YouTube needs at least three in the description.
- End screen and cards: optional, add after upload if needed
