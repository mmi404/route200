# Route200: Design References

Scouting notes for the visual design lead. Items marked (unverified) are from memory and should be checked before they go into a spec.

## 1. Storytelling references

**Our World in Data (climate pages).** Neutral off-white background, one accent per chart, direct labels instead of legends, a restrained sans-serif. Steal: label lines at the end of the series, and a small "about this data" block under every chart.

**The Pudding (map and scrollytelling essays).** Long-form, one data idea per screen, a sticky visual with text scrolling past it. Steal: the sticky-map-plus-text-column pattern, with each text step triggering one map state (zoom, layer on, layer off).

**NYT / Reuters graphics (flood and disaster explainers).** Full-bleed before/after imagery, annotated with short captions on the image itself. Steal: a single hero comparison slider placed above the fold, with a caption that states the date and sensor.

**Erosion After the Fire (NASA Earth Observatory, 2017, found in search).** A data-driven erosion map with a clear legend, a dated source line, and a short explanatory paragraph. Steal: the sourcing style (data provider named in the caption, publication date shown).

**SERC "Flood Visualizations" (found in search).** Time-sequenced map with text boxes overlaid on the map at each event date. Steal: dated event cards pinned to the map, not a separate timeline.

Note: a search for a NASA Earth Observatory scrollytelling flood or erosion piece found nothing usable. Do not cite one until it is located.

## 2. Bangla and Latin typography

Checked on Google Fonts / Fontsource:

- **Noto Sans Bengali**: unmodulated humanist sans, many weights, 17 OpenType features, broad glyph coverage. Safe, neutral pairing with Inter or IBM Plex Sans. Best default for body text.
- **Hind Siliguri**: Google Fonts splits Bengali into its own unicode-range subset, so Bengali text only downloads when needed. Good for body and UI.
- **Anek Bangla**: variable axis, OFL-licensed, Google Fonts. Contemporary feel without looking like a template. Good candidate for headings and UI labels.

Not verified (from memory):
- **Tiro Bangla**: a serif Bengali design, available on Google Fonts (unverified). Could work for one display serif accent for long-form essay headers. Test that its Latin pairs well.
- **Baloo Da 2**: playful, rounded. Likely too cute for a disaster-data page.
- **Li Ador Noirrit**: not confirmed as a Google Font. Check its license before using it.

Recommended pairing to test: **Anek Bangla** (headings and labels) with **Noto Sans Bengali** (body), and a Latin face such as Inter or IBM Plex Sans for numerals and map labels. Load Bengali subsets with `unicode-range`.

Bilingual layout: most civic-tech sites use a **Bangla-first with English secondary** approach for an audience in Bangladesh, with a toggle for English-only reading. Side-by-side columns only work for short labels. Keep numerals and place names in one consistent script per element, and test line height, since Bengali conjuncts need more vertical room (around 1.6 for body text).

## 3. Palette directions

**A. Deep river-navy with signal colors (recommended first pass).**
- Base: #0B1F2A to #13293D
- River teal: #1B7F87 to #2A9D8F
- Text: #E8EEF1
- Severity amber: #F2A541
- Severity red: #D1495B
- "200 OK" green: #7BD389 (used once, for the recovered state)

**B. Earthy terracotta and river-blue (warmer, closer to Bangladesh landscape).**
- Paper: #F4EDE1
- Ink: #2B2622
- Terracotta (erosion): #B5573B
- Hill ochre (landslide): #C8893A
- River blue: #2F6F8F
- OK green: #5E8C4A

**C. Radar-console dark (use with caution).**
- Base: #0A0E0C
- Data cyan: #22D3EE
- Amber: #FFB000
- Avoid full neon green; it reads as hacker-theme, not civic.

Use one severity ramp (for example amber to red) and keep it separate from the brand colors so that alert states never collide with decoration.

## 4. MapLibre UI patterns

- **Before/after swipe**: `@maplibre/maplibre-gl-compare` is the official plugin, but its last push was in January 2023, so verify it still works with the current MapLibre version. `@geoql/maplibre-gl-compare` (v0.0.3) is a newer community alternative with horizontal and vertical modes.
- **Time slider**: drive a raster or fill layer with `setPaintProperty` or `setFilter` on each scrub step. Keep each epoch as a separate tile source so scrubbing does not refetch.
- **Animated opacity crossfade**: animate `raster-opacity` or `fill-opacity` between two dated layers for a soft change, rather than a hard swap.
- **Severity choropleth by zone**: a `fill` layer with a step expression on a risk-score property, using the severity ramp above.
- **Overlays**: deck.gl through `@deck.gl/mapbox` (its MapboxOverlay also works with MapLibre) if you need heavier point or arc layers.

Recommended first build: swipe compare for the Jamuna riverbank, plus a dated time slider for landslide zones.
