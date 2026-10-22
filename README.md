# Route200

**Turning the world's climate data into a route that reaches you.**

Built by **CUET_404** for NASA International Space Apps Challenge 2026 (Bangladesh, Chattogram), Challenge #6: *Dancing with the SARs*.

---

## The problem

A 404 isn't "this doesn't exist." It's "I have no route that resolves to what you asked for." The resource is sitting right there. The failure is in the path.

That's Bangladesh's climate-risk problem, exactly. NASA-ISRO's **NISAR** mission watches rivers and hillsides from space and releases radar data within 1–2 days normally, within hours during disaster response. Bangladesh's own CEGIS has tracked Jamuna erosion every year since 2004. The science exists. The warning exists. But only 37% of Bangladeshi youth even know climate change is here, and almost none of that satellite data ever reaches a farmer standing on a collapsing riverbank.

**Route200 is the missing route.** One shared SAR change-detection engine, feeding two front ends, so the next request for help returns 200 OK instead of bouncing back 404.

Why we built the team's whole identity around that idea: [docs/ORIGIN_STORY.md](docs/ORIGIN_STORY.md).

## What it does

A single pipeline reads NISAR/Sentinel-1 SAR amplitude data, detects surface change (river erosion, landslide-prone slope shift, flood extent), and feeds it to two tracks that reach different audiences:

| Track | Audience | Interface |
|---|---|---|
| **Awareness experience** | GenZ, the general public, judges | Web map/game, animated before/after change, Bangla-first, built to make risk visceral and shareable |
| **Alert delivery** | Households in erosion/landslide zones | Automated SMS + Bangla voice-call alert, no app, no data plan, no smartphone required |

Full breakdown of how data moves between them: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Why SAR, why this approach

Optical satellites fail during monsoon, exactly when the information matters most. SAR sees through cloud. Rather than full InSAR interferometry (heavier tooling, a steeper learning curve), the pipeline uses **amplitude/backscatter change detection**: threshold and difference SAR amplitude between two dates to delineate open water and bare-surface change, then animate the resulting time series. Standard practice, much closer to ordinary image differencing than the challenge's "Advanced" tag suggests.

## Tech stack

- **Processing**: Python (NumPy, rasterio/xarray for raster handling)
- **Viewer**: Next.js + Tailwind, MapLibre GL JS for the map layer (OpenFreeMap tiles, no API key required)
- **API**: Node / Next API routes
- **Data**: Postgres/Supabase for change events and zone reference tables
- **Alert delivery**: SMS gateway + Bangla text-to-speech voice-call pipeline
- **Infra**: Docker, Nginx, GitHub Actions, VPS/Cloudflare

## Team

| Member | Role | Owns |
|---|---|---|
| **Mahi** | Team Lead | Idea ownership, team & timeline management, connecting every track together, AI-assisted tooling (Claude) across the project, fills in on whichever piece needs hands |
| **Raisa** | Research & Strategy | Problem framing, SAR/NISAR domain research (background: EEE), judging strategy, submission compliance |
| **Tanim** | Engineering, Web & ML Pipeline | Next.js web experience build, change-detection engine/ML work (GPU-backed) |
| **Faladun** | Engineering, Systems & Data | API/data layer, alert-delivery integration (SMS + voice), supporting ML work |
| **Talha** | Creative Lead | Visual identity, graphics, video direction and cinematography |
| **Arik** | Creative, Video Production | Video planning, filming, editing |

CUET_404 = Chittagong University of Engineering & Technology plus the error code the name is built around. [The full origin story.](docs/ORIGIN_STORY.md)

## Challenge & dates

- **Event**: NASA Space Apps Challenge 2026, Bangladesh, Chattogram local round
- **Challenge**: #6, *Dancing with the SARs* (NISAR surface change)
- **Global hackathon**: 14–15 November 2026
- **BD mainstage**: 13–14 November 2026, AIUB Dhaka
- **Submission deadline**: 11:59 PM local time, 15 November 2026

## Status

The web experience (`web/`) is built: landing page, the interactive risk map, and the alert signup flow, all running against a mock data layer shaped exactly like the real API described below, so the change-detection engine can be connected without a frontend rewrite. See [docs/WEB_DATA_CONTRACT.md](docs/WEB_DATA_CONTRACT.md) for that integration point and [web/DESIGN_SPEC.md](web/DESIGN_SPEC.md) for the visual system it's built on.

The change-detection engine (Sentinel-1 now, NISAR GCOV for the actual submission output) is being built separately; data access and tooling research for that side lives in `nasaspace/ML_Data_Sources_DRAFT.md`. See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the current system design.

To run the web app locally: `cd web && npm install && npm run dev`.

## License

TBD.
