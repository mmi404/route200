# Route200: 4-Minute Video Script (Video 2, Local Judging)

Total runtime target: 4:00 (240 seconds), hard cutoff, over-length gets cut off not excused. Structured on the Participants Guide's own "240 Seconds of Glory" pitch model for local judging (WHO / WHY / WHAT / SO WHAT NEXT), with the working build filled into WHAT, not concept-only (that was Video 1). VO = voiceover. Screen capture notes point to the real routes in the running app (`npm run dev`, `localhost:3000`).

**Compliance check against the Participants Guide's "must contain" list for this video**: team name (stated in WHO and again in the close), every team member listed by name (WHO, all six), problem and challenge statement (WHY, names Challenge #6 explicitly), solution plus a demo of it working (WHAT, live screen capture of the actual app), NASA data usage stated out loud (WHAT, explicit spoken line naming Landsat and NISAR).

---

## WHO — 0:00-0:45 (~110 words, attention and authenticity)

**Visual**: Cold open, "404 NOT FOUND" flashes on screen, then cuts to the team, one quick on-camera moment each.

**VO**:
- **Mahi (Lead)**: "A 404 doesn't mean a page is missing. It means no road reaches it. That's why we're CUET_404."
- **Mahi**: "I'm Mahi, I lead this team."
- **Raisa (Research & Strategy)**: "I'm Raisa, research and strategy."
- **Tanim (Web & ML Pipeline)**: "I'm Tanim, I build the web experience and the data pipeline underneath it."
- **Faladun (Systems, Data & Alerts)**: "I'm Faladun, I build the alert delivery and the data layer it runs on."
- **Talha (Creative Lead)**: "I'm Talha, I lead the visual identity you're watching right now."
- **Arik (Video Production)**: "And I'm Arik, I cut this video together."
- **Mahi**: "Six of us, one real route from satellite data to the people who actually need it. This is Route200."

**On screen text**: `CUET_404 — ROUTE200`

---

## WHY — 0:45-1:45 (~150 words, empathy for the problem)

**Visual**: Real footage/stock: Jamuna riverbank, exposed char/sandbar; Chattogram hillside after a landslide. Cut to a satellite image slowly panning.

**VO (Raisa)**: "Our challenge is Challenge Six, Dancing with the SARs: NASA and ISRO's NISAR mission, watching Earth's surface shift almost in real time. In Bangladesh, that surface never holds still. Families along the Jamuna lose land to the river every year. Millions more live under landslide risk across the Chattogram hills, risk that struck again in July 2026, when monsoon landslides and floods killed more than fifty people in a single month. The data to see this coming already exists. NISAR can release it within hours during a disaster. But only thirty-seven percent of Bangladeshi youth even know this climate shift is already here, and almost none of that satellite data reaches the family standing on the riverbank before it gives way. That's the real 404: not missing data, a missing route."

**On screen text**: "37% of Bangladeshi youth know climate change is already here."

---

## WHAT — 1:45-2:50 (~165 words, the innovation: solution, demo, and NASA data stated out loud)

**Visual**: Screen capture, `localhost:3000/map` → a zone's evidence page (real Sentinel-1 before/after slider) → Ground View (`/map/zone-cht-teknaf/ground`, walk/climb the real slope, scrub the time slider) → `/alerts` signup, cut to a phone receiving an SMS/voice call graphic.

**VO (Tanim)**: "So we built the road. One shared change-detection pipeline, two tracks. Twelve real risk zones on one map, color-coded by real measured severity. Open a zone and you're looking at an actual Sentinel-1 radar scene, before and after, differenced to show exactly what changed. Walk into the scene itself: real elevation, real land cover, the real shape of a landslide. Scrub the timeline and you're watching real NASA Landsat vegetation data, thirty-six years of it, show this slope decline years before it finally gave way. Every number here is real NASA and partner satellite data: Landsat's long archive, and the same radar change-detection approach NISAR itself will deliver, proven today against Sentinel-1 while NISAR's own archive grows."

**VO (Faladun)**: "The second track reaches people the map can't. No app, no smartphone, no data plan. When a zone's measured severity crosses a threshold, this same pipeline triggers an automated SMS and a Bangla voice call straight to a registered number."

**Screen capture checklist**:
- `/map` — zone overlays, severity legend
- A CHT zone's `/map/[zoneId]/evidence` — real Sentinel-1 before/after slider, change stats
- `/map/zone-cht-teknaf/ground` — walk/climb the real slope, point out the scar, scrub the real multi-decade Landsat timeline
- `/alerts` — SMS/voice signup form

**Note**: the Jamuna riverside Ground View (`/map/zone-jamuna-sonatola/ground`) is left out of this cut. Its real land-cover data genuinely shows no visible open water at this reference point (confirmed against both ESA WorldCover and a Sentinel-1 backscatter check), and the vegetation density there is still being tuned to read clearly as open sandbar rather than forest. Don't film it for this video; revisit once that zone's visual is solid, same bar as Teknaf's.

---

## SO WHAT NEXT — 2:50-4:00 (~155 words, impact and what's needed next, then stop)

**Visual**: Fast-cut sequence tying the whole pipeline together: satellite image → map → ground view → phone alert. Team card. Route200 wordmark holds. Final card.

**VO (Mahi)**: "This has worked before. Bangladesh's cyclone warning system took deaths from roughly three hundred thousand in 1970 to zero in 2023, purely because a warning finally had a road to travel on. We're building that same road for erosion and landslide risk, where one still doesn't exist. Twelve zones are live today. Next: the full NISAR archive as it grows, the remaining Jamuna zones, and a telecom partner to put this alert in front of every household in range, not just a signup form. The science already exists. The warning already exists. The only thing that was ever missing is the road between them."

**VO (Mahi, close)**: "We're CUET_404. This is Route200. Built for NASA Space Apps Challenge 2026, Chattogram, Challenge Six: Dancing with the SARs."

**On screen text**: `CUET_404 — ROUTE200 — 200 OK`

---

## Notes for Talha/Arik

- VO above is written for English narration; a Bangla voiceover pass of the same beats works just as well given the project's Bangla-first framing, or alternate (English VO, Bangla on-screen captions, which the app itself already supports).
- All six members need their own on-camera moment in WHO; who speaks which line can be adjusted on set, but every one of the six must be named, per the local-judging "must contain" rule.
- The WHAT section's NASA-data line is a hard requirement too (state your NASA data usage out loud): keep it as a clearly spoken line, not buried under a fast cut.
- Every screen-capture beat points at a route that is actually built and running today (`/map`, `/map/[zoneId]/evidence`, `/map/[zoneId]/ground`, `/alerts`) — no mockups needed for any of it.
- Keep the 404 → 200 motif bookending the whole video; it's the team's actual naming logic (`docs/ORIGIN_STORY.md`), not just a tagline.
- Timestamps are cue points, not hard cuts; the four-block split (45/60/65/70, roughly 240 total) is the Guide's own recommended shape, not a strict per-block timer. The hard limit is the whole video under 240 seconds. Read the whole script aloud once with a timer before locking picture; trim WHAT first if it runs long, since it carries the most content.
