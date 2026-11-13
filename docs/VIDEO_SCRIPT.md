# Route200: 4-Minute Video Script (Video 2, Local Judging)

Hard limit: 4:00. VO = voiceover. Screens are the running app (`npm run dev`, `localhost:3000`).

---

## WHO (0:00–0:45)

**Visual:** "404 NOT FOUND" on screen, then the six members, one short on-camera moment each.

- **Mahi (Lead):** "A 404 doesn't mean the page is missing. It means no road reaches it. We're CUET_404."
- **Raisa (Research & Strategy):** "I'm Raisa, research and strategy."
- **Tanim (Web & ML):** "I'm Tanim, web and ML."
- **Faladun (Systems & Alerts):** "I'm Faladun, systems and alerts."
- **Talha (Creative Lead):** "I'm Talha, creative lead."
- **Arik (Video Production):** "I'm Arik, video production."
- **Mahi:** "Six of us. One route from satellite data to the people who need it. This is Route200."

**On screen:** `CUET_404 · ROUTE200`

---

## WHY (0:45–1:45)

**Visual:** Jamuna riverbank, Chattogram landslide scar, slow pan across a satellite image.

- **Raisa:** "Our challenge is Dancing with the SARs, Challenge Six: NASA and ISRO's NISAR mission, watching Earth's surface change from space. In Bangladesh that surface never stays still. The Jamuna takes land from families every year, and in July 2026 landslides across the Chattogram hills killed more than fifty people. The satellite data exists. The route from that data to a family does not."

---

## WHAT (1:45–2:50)

**Visual:** `/map` → a CHT zone's `/evidence` page (radar slider) → `/map/zone-cht-teknaf/ground` (walk the slope, scrub the timeline) → `/alerts`.

- **Tanim:** "So we built the road: one change-detection pipeline, two ways out. Twelve risk zones, colored by measured severity. Open a zone and see the radar before and after. Walk into Teknaf, a real hillside, and scrub thirty-six years of vegetation as the slope thins before it fails."
- **Raisa:** "Our NASA data: Landsat from 1990 to 2026 for the vegetation timeline, NASA's daily imagery of the July 2026 floods, and NISAR radar passes over Teknaf from late June to late July 2026."
- **Faladun:** "The second route is the alert. When a zone crosses a severity threshold, the same pipeline sends an SMS and a Bangla voice call to a registered phone. No app, no data plan."

**On screen during Raisa's line:** `NASA DATA · Landsat 1990–2026 · NASA GIBS, July 2026 · NISAR GCOV, Teknaf, Jun–Jul 2026`

---

## SO WHAT NEXT (2:50–4:00)

**Visual:** Fast cut: satellite → map → ground view → phone alert. Team card. Final card.

- **Mahi:** "Bangladesh already proved this road works. Cyclone deaths fell from about 300,000 in 1970 to zero in 2023, because a warning finally had a route. We're building that route for erosion and landslides."
- **Tanim:** "Not finished yet. Our full change engine still runs on Sentinel-1. Our NISAR passes over Teknaf show no change above our 3 dB threshold across the event, so we're still tuning it. The risk score is illustrative, not a trained model, and the Jamuna zones have no radar pages yet."
- **Faladun:** "Next: run the engine on NISAR's full archive, train the risk model on ground truth, and partner with a telecom to alert every household in range."
- **Mahi:** "We're CUET_404. This is Route200. 404, turned into 200 OK."

**On screen:** `CUET_404 · ROUTE200 · 200 OK`
