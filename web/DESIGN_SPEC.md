# Route200 design spec

The single visual reference for everyone building on `web/`. Every decision here is final for v1. If something you need is missing, add a token in `app/globals.css` (and its mirror in `lib/design-tokens.ts`), then add a line here. Do not invent a one-off value in a page.

A rendered reference of every token and primitive lives at `/design` (not linked, not indexed).

## 1. Direction

Route200 looks like a newspaper's data desk, not a software product. The reference points are Our World in Data (direct labels, a source line under everything), The Pudding (a sticky map with text scrolling past it) and Reuters/NYT graphics (annotation on the image itself, dated captions).

We use research palette **B (earthy paper)**, evolved. Reasons:

- A warm paper ground reads as journalism; a dark navy ground reads as a monitoring dashboard, which is the wrong register for a public awareness piece.
- Light grounds hold up on a mid-range phone outdoors in daylight, which is where much of this audience reads.
- The OpenFreeMap basemap is light; a light page lets the landing teaser map and the full map share one visual world.

The one structural change from palette B: terracotta and ochre are **not** brand colors. They live only in the severity ramp, so risk color never collides with decoration. The brand is paper, ink, river blue, and one green used only for the "200" moment.

What this rules out: centered hero over a gradient, rounded cards with shadows, icons in circles, stock illustration, glassmorphism, purple or blue gradients, dark mode as a default, emoji in UI.

## 2. Color

Tailwind's default palette is removed (`--color-*: initial`). Only these exist.

### Neutrals and accents

| Token (`bg-*`, `text-*`, `border-*`) | Hex | Use | Text contrast on paper |
|---|---|---|---|
| `paper` | `#F5F0E6` | Page background. Never pure white. | |
| `surface` | `#FBF8F1` | Raised panels: map rail, form sheet, inspect panel | |
| `well` | `#ECE5D8` | Alternate full-bleed section band, sunken areas | |
| `rule` | `#D9CFBE` | Hairlines, dividers. Decorative only, never a control border | |
| `ink` | `#1C1A17` | Body text, strong rules, the footer band | 15.3:1 |
| `ink-muted` | `#57514A` | Secondary text, labels | 6.9:1 |
| `ink-subtle` | `#6E665B` | Meta, captions, sources (lowest allowed for text) | 5.0:1 |
| `river` | `#1D5B78` | **Primary accent**: primary buttons, links, focus ring, selected state, section numbers | 6.6:1 (paper on river 6.6:1) |
| `river-deep` | `#14445A` | Hover and pressed for river | 9.2:1 |
| `river-tint` | `#DCE7EA` | Selected list rows, text selection | ink on it 13.8:1 |
| `ok` | `#2E6B3E` | **Secondary accent**: the "200" in the wordmark and headline, alert-signup success. Nothing else. | 5.6:1 |
| `ok-tint` | `#DDE8D9` | Success background | ok on it 5.1:1 |

On the ink band (footer, inverse sections): text `paper` (15.3:1), secondary `paper-muted` `#A39A8C` (6.3:1), links `river-light` `#9CC3D5` (9.2:1), the "200" in `ok-light` `#8FC29B` (8.6:1).

### Severity ramp

Sequential and lightness-ordered (pale straw to oxblood), so it reads correctly with any color vision deficiency and in grayscale. It never uses green, so it can't be confused with the `ok` state.

| Band (score) | Fill (areas) | Text-safe `-ink` | Text on solid fill |
|---|---|---|---|
| Low (0–25) | `sev-low` `#EBCB6B` | `sev-low-ink` `#7A5800` (5.7:1) | `ink` (11.0:1) |
| Moderate (26–50) | `sev-moderate` `#E08A3A` | `sev-moderate-ink` `#99460F` (5.7:1) | `ink` (6.5:1) |
| High (51–75) | `sev-high` `#B2442A` | `sev-high-ink` `#A63B1F` (5.7:1) | `paper` (4.9:1) |
| Severe (76–100) | `sev-severe` `#6B1D32` | `sev-severe-ink` `#6B1D32` (10.0:1) | `paper` (10.0:1) |
| No data | `nodata` `#C9C0B0` | n/a | n/a |

Verified: OKLab lightness steps of 0.85 / 0.71 / 0.53 / 0.36, and adjacent-band difference stays between 0.14 and 0.21 (OKLab ΔE) under simulated protanopia, deuteranopia and tritanopia.

Rules:

- **Fills are for areas** (map polygons, swatches, chart bars). Never set text in `sev-low` or `sev-moderate`; use the `-ink` variant.
- A small swatch on paper always gets `ring-1 ring-ink/25 ring-inset` (low and moderate fills are below 3:1 against paper).
- **Color is never the only signal.** Every severity mark prints its band word, and on the map severe zones also get a heavier outline.
- Band thresholds come only from `SEVERITY_BANDS` / `severityToBand()` in `lib/types.ts`. Never hard-code 25/50/75 in a component.

## 3. Type

| Role | Family | Why |
|---|---|---|
| Display and headings | **Anek Bangla** (variable, `wght` + `wdth`) | Covers Bangla and Latin in one design, so a headline mixing Bangla with "Sirajganj" stays one voice. Run semi-condensed (82–90% width) for a newsroom headline feel. |
| Body and UI, Latin | **IBM Plex Sans** (variable, `wght` + `wdth`, normal + italic) | Has character without being the default SaaS face (we deliberately avoid Inter). Its width axis gives condensed stat numerals; it has tabular figures for count-ups. |
| Body, Bangla | **Noto Sans Bengali** | Widest Bengali coverage and conjunct support. Falls in per glyph after Plex, so mixed-script paragraphs need no markup. Not preloaded: unicode-range loads it only when Bengali appears. |
| Data voice | **IBM Plex Mono** 400/500 | Dates, coordinates, scene names, sources, eyebrows. The "instrument readout" layer. |

Wiring (already done in `app/layout.tsx`): `next/font/google` exposes `--font-anek-bangla`, `--font-plex-sans`, `--font-noto-bengali`, `--font-plex-mono` on `<html>`; `globals.css` builds the stacks into `font-display`, `font-sans`, `font-mono`. Body defaults to `font-sans` at the body role.

```ts
Anek_Bangla({ subsets: ["latin", "bengali"], axes: ["wdth"], variable: "--font-anek-bangla" })
IBM_Plex_Sans({ subsets: ["latin"], axes: ["wdth"], style: ["normal", "italic"], variable: "--font-plex-sans" })
Noto_Sans_Bengali({ subsets: ["bengali"], preload: false, variable: "--font-noto-bengali" })
IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono" })
```

### Scale

Tailwind's default `text-*` sizes are removed. Use the composite `type-*` utilities: each sets family, size, leading, tracking, weight, width and the Bangla override in one class.

| Class | Size | Leading | Tracking | Family / weight | Use |
|---|---|---|---|---|---|
| `type-display` | 42–84px fluid | 1.0 | -0.028em | Anek 650, 82% width | Hero headline only, one per page |
| `type-h1` | 34–56px fluid | 1.05 | -0.022em | Anek 650, 86% | Page titles (map, alerts) |
| `type-h2` | 26–38px fluid | 1.12 | -0.016em | Anek 600, 90% | Section headings, pull quotes |
| `type-h3` | 21px | 1.25 | -0.008em | Anek 600 | Zone names, panel headings |
| `type-lede` | 19–23px fluid | 1.5 | 0 | Plex 400 | Subheads, first paragraph |
| `type-body` | 17px | 1.65 | 0 | Plex 400 | Running text |
| `type-small` | 15px | 1.55 | 0 | Plex 400 | UI text, stat labels, form help |
| `type-meta` | 13px | 1.45 | 0 | Plex Mono 400 | Dates, coords, sources, legend labels |
| `type-eyebrow` | 12px caps | 1.3 | +0.12em | Plex Mono 500 | Section labels |
| `type-stat` | 44–72px fluid | 0.95 | -0.03em | Plex 600, 78% width, tabular | Stat figures only |

Bangla (`:lang(bn)`, built into every `type-*` class): tracking is forced to 0 (letter-spacing breaks the matra), leading opens up (display 1.2, h2 1.32, body 1.8), and headings run slightly wider (92–96%). Eyebrows in Bangla switch to Anek 600 at 14px, since uppercase does not exist. **Always set `lang="bn"` on Bangla content** (or on `<html>` once the site is Bangla-first); the overrides depend on it.

Running text max width: `max-w-column` (40rem, about 68 characters). Headings get `text-wrap: balance`, paragraphs `pretty`, already in the classes.

Inline links in prose: `link-inline` (river, 1px underline at 45%, 2px on hover).

## 4. Spacing, layout, shape

- Base unit 4px. Component spacing uses only the steps `1 2 3 4 6 8 12 16 24 32` (4–128px).
- Named layout tokens (work with `p-`, `m-`, `gap-`, `h-`, `w-`):
  - `gutter` 16–40px fluid: page side padding and grid column gap.
  - `section` 72–144px fluid: vertical space between landing sections.
  - `section-tight` 48–88px fluid: inside bands, map page headers.
  - `header` 56px: site header height (`h-[calc(100dvh-var(--spacing-header))]` for the map).
  - `rail` 360px: map side rail width.
- Measures (`max-w-*`): `column` 40rem (text), `wide` 76rem (two-column sections), `frame` 90rem (outer frame).
- `frame` utility = full width, max 90rem, centered, gutter padding. Every section's content sits in a `frame`; full-bleed bands put their background on the outer element and a `frame` inside.
- Grid: 12 columns on desktop (`grid grid-cols-12 gap-x-gutter`), 4 columns under 640px. Text blocks start at column 1 or 2. **Nothing is centered** except the map itself.
- Radius: `rounded-xs` (2px) on buttons, inputs, chips. `rounded-full` only for dots. No other rounding.
- Borders: rules are 1px `border-rule`; emphasis rules are 2px `border-ink` (stat tops, section dividers).
- Shadow: only `shadow-map`, only on controls floating over the map canvas. Nowhere else.

## 5. Motion

Motion explains change in the data; it never decorates. Four things animate. (1) **Section headings and stat rows** may use `.reveal`, a CSS scroll-driven fade-and-rise of 14px, scroll-linked, never on body paragraphs, never on the hero. (2) **Stat figures count up once** (1.2s, ease-out quart) only if they start below the fold; numbers already on screen at load stay still, and the server always renders the true final value. (3) **Map layers crossfade** (`fill-opacity` / `raster-opacity` over 600ms) when the date or filter changes, and the camera uses `flyTo` (1.6s) when a scrolly step or zone selection moves it; the before/after swipe moves only under the reader's hand. (4) **Hover feedback**: color shifts at 150ms and the primary button's arrow nudges 2px. Nothing else moves: no hero entrance, no typewriter text, no parallax, no floating shapes, no animated gradients, no skeleton shimmer (show "Loading zone data" text), no page transitions, and **no pulsing on severe zones** (severity is carried by color, weight and the band word; pulsing reads as alarm and drains battery). With `prefers-reduced-motion: reduce`, all of it is off: counts show the final value, reveals are skipped, and the map uses `jumpTo` and instant opacity.

Tokens: `ease-editorial` (`cubic-bezier(0.22, 1, 0.36, 1)`), `duration-(--duration-fast)` 150ms, `--duration-base` 280ms, `--duration-map` 600ms, `--duration-count` 1200ms. JS mirror: `MOTION` and `prefersReducedMotion()` in `lib/design-tokens.ts`.

## 6. Shared components

All in `app/components/`, exported from `@/app/components`. Server components unless noted.

### `SectionLabel`
Mono caps eyebrow: the section number in river, a 32px hairline, then the label (`02 / THE PROBLEM` reads as `02`, rule, `THE PROBLEM`).
```tsx
<SectionLabel index={2}>The problem</SectionLabel>
```
Props: `children`, `index?: number` (zero-padded, river), `as?: "p" | "span" | "div" | "h2"` (default `p`; the real heading follows), `tone?: "default" | "inverse"`, `className`, `id`.

### `ButtonLink` / `Button`
Primary is a solid square river block with a trailing arrow; secondary is an underlined text action with a full 48px tap height. **One primary per view; never two solid buttons side by side.**
```tsx
<ButtonLink href="/map" size="lg">See the risk map</ButtonLink>
<ButtonLink href="/alerts" variant="secondary" size="lg">Get alerts for your area</ButtonLink>
<Button type="submit">Get alerts for my area</Button>
```
Props: `variant?: "primary" | "secondary"`, `size?: "md" | "lg"` (48 / 56px), `tone?: "default" | "inverse"` (ink band), `arrow?: boolean` (default on for primary), plus native anchor or button attributes. `ButtonLink` uses `next/link`.

### `StatCallout`
A sourced figure set like a newspaper stat box: 2px ink rule on top, condensed tabular number, label, source line. No card. Several in a grid make one continuous rule.
```tsx
<StatCallout value={37} suffix="%" label="of Bangladeshi youth could correctly define climate change" source="UNICEF-Gallup, Dec 2023" />
<StatCallout value={2004} grouping={false} countUp={false} label="..." source="CEGIS" />
```
Props: `value: number`, `prefix?`, `suffix?`, `label: ReactNode`, `source?: ReactNode` (always supply one for public figures), `size?: "lg" | "md"`, `accent?: "ink" | "river" | "severe"` (severe only for deaths or alert figures), `tone?`, `countUp?: boolean` (default true; off for years and IDs), `decimals?`, `grouping?` (default true), `locale?: "en" | "bn"` (bn renders Bengali digits). Uses the client `CountUp` internally (also exported, with `formatStatNumber`).

### `SeverityBadge`
```tsx
<SeverityBadge score={event.severity} showScore />     // ■ High 64/100
<SeverityBadge band="severe" variant="solid" />        // [SEVERE]
```
Props: either `score: number` (raw 0–100, band derived with `severityToBand`) or `band: SeverityBand`; `variant?: "inline" | "solid"` (solid once per view, for the thing being inspected), `showScore?`, `lang?: "en" | "bn"`, `className`. Includes a screen-reader "Severity:" prefix and the full band label as a tooltip.

### `SeverityScale`
The legend, derived from `SEVERITY_BANDS`, labelled directly (no color-only key).
```tsx
<SeverityScale title="Change severity, engine score 0–100" markAlertThreshold />        // landing, horizontal
<SeverityScale orientation="vertical" title="Zones" counts={{ severe: 2, high: 3 }} />    // map rail
```
Props: `orientation?: "horizontal" | "vertical"`, `title?`, `highlight?: SeverityBand` (dims the others), `markAlertThreshold?` (annotates "Alerts above 75"), `counts?` (vertical only, replaces ranges), `lang?`, `className`.

### `SourceCitation`
The "about this data" line under every map, chart and stat group.
```tsx
<SourceCitation source="ESA Copernicus Sentinel-1 GRD" href="https://dataspace.copernicus.eu/"
  detail="ascending pass" date="2026-07-06" dateEnd="2026-07-24"
  note="Change detected by amplitude differencing. Decision support, not a forecast." />
```
Props: `source`, `href?`, `detail?`, `date?` / `dateEnd?` (ISO, formatted "6 Jul 2026" without timezone drift), `note?`, `label?` (default "Source"), `as?: "p" | "div" | "figcaption"`, `tone?`, `className`. Also exports `formatCitationDate()`; use it for every displayed date so dates look the same site-wide.

### JS tokens: `lib/design-tokens.ts`
For MapLibre and SVG, which can't read CSS variables: `PALETTE`, `SEVERITY_ORDER`, `SEVERITY_FILL`, `SEVERITY_INK`, `SEVERITY_ON_FILL`, `SEVERITY_SHORT_LABEL` (en and bn), `ZONE_KIND_LABEL`, `SEVERITY_RANGES`, `ALERT_THRESHOLD`, `severityColorExpression(property?)` (a MapLibre `case` expression with exactly `severityToBand`'s cut points; cast to `ExpressionSpecification`), `MAP_STYLE` (base style URL, opacities, line widths by band, dash by kind, shared camera views and `allZonesBounds`), `MOTION`, `prefersReducedMotion()`. The Bangla labels in `SEVERITY_SHORT_LABEL` and `ZONE_KIND_LABEL` should be reviewed by a native speaker on the team before launch.

## 7. Layout directions

### Global header (owned by the landing build, reused by all pages)
56px tall, `paper` background, 1px `rule` bottom border, no blur, not sticky on the landing page, sticky on `/map`. Left: wordmark "Route**200**" in Anek 650 with "200" in `ok`. Right: `Map`, `Get alerts`, and a `বাংলা / EN` toggle in `type-small`. No hamburger under 640px: the three items fit as text.

### (a) Landing page `/`
The copy in `.design-research/landing-copy.md` is final; the layout fits it as written.

1. **Hero** (contained, `frame`, left-aligned, not centered). 12-column grid. Headline `type-display` across columns 1–8: "From **404** to **200**: …" with "404" in Plex Mono at `ink-subtle` with a 2px line-through, and "200" in `ok`. Subhead `type-lede` in `ink-muted`, columns 1–6. CTAs below: primary "See the risk map" (`/map`) and secondary "Get alerts for your area" (`#alerts`). Columns 9–12: instead of an illustration, a **live zone index** from `/api/zones` + `/api/change-events`: a mono eyebrow "Tracking 12 zones", then two short ruled lists ("Jamuna corridor", "Chattogram Hill Tracts"), each row an upazila name plus `SeverityBadge`, and a `SourceCitation` with the latest scene date. Under the hero, full frame width: a 1px ink rule and a mono dateline row: `Jamuna corridor 24.4–25.3°N` · `Chattogram Hill Tracts 21.5–22.2°N` · `Latest pass 21 Oct 2026`. Mobile: index collapses to one line ("12 zones tracked · 2 severe") under the CTAs.
2. **The problem** (contained). `SectionLabel index={1}`, an `type-h2`, then the three paragraphs in `max-w-column` starting at column 2. Between paragraphs 2 and 3, a full-frame row of three `StatCallout`s: 2004 (CEGIS tracking since, no count-up), 37% (UNICEF-Gallup, Dec 2023), 50+ (July 2026 CHT landslide deaths, `accent="severe"`). The closing sentence "That gap, between what satellites already see and who gets told, is what Route200 closes." pulled out as a `type-h2` pull quote with a 2px ink rule above.
3. **How it works** (full-bleed `well` band, `frame` inside, `max-w-wide` two columns). Left: label, h2 "One engine, two tracks.", the two paragraphs. Right: a **ruled schematic in inline SVG/HTML, not an illustration**: `NISAR GCOV / Sentinel-1 GRD` → `Change engine` → fork into `Public map` and `SMS + Bangla voice call`, 1.5px ink strokes, mono labels, the two outputs styled as the two "front doors" (map door in river, alert door in ink). No icons.
4. **Map teaser** (full-bleed, the bridge into `/map`). A sticky MapLibre map (non-interactive: no scroll-zoom, no drag) fills the viewport height; two text steps scroll over it on a `surface` panel at columns 1–5. Step 1 (paragraph one) flies to `MAP_STYLE.jamunaView` with Jamuna zones filled by severity; step 2 (paragraph two) flies to `hillTractsView`. The final step ends on `SeverityScale markAlertThreshold`, the primary CTA "See the risk map", and a `SourceCitation`. The teaser uses the same style, layers and `MAP_STYLE` constants as `/map`, and the CTA opens `/map` at the camera the teaser ended on (`/map?view=hill-tracts`), so clicking through feels like stepping into the same map, not loading a new one. Mobile: map takes the top 60svh, sticky; text panels scroll over the lower part.
5. **Get alerts** (`id="alerts"`, contained, `max-w-wide` two columns). Left: label, h2, the paragraph. Right: the actual signup form (the same component as `/alerts`), not a link to it.
6. **Footer** (full-bleed `ink` band). The closing paragraph's first sentence as `type-h2` in `paper`, second sentence as `type-lede` in `paper-muted`. Then inverse buttons, then a ruled credits block in `type-meta`: data sources (NASA/ISRO NISAR, ESA Copernicus Sentinel-1, CEGIS, OpenStreetMap contributors via OpenFreeMap), and "Built by team CUET_404 for NASA Space Apps Challenge 2026."

Section rhythm: `py-section` between sections; bands use `py-section-tight` inside. Every section starts with a `SectionLabel` (numbered 01–05; hero and footer unnumbered).

### (b) Map experience `/map`
- **Canvas:** full width, height `calc(100dvh - var(--spacing-header))`, sticky header above. Opens at `MAP_STYLE.allZonesBounds` (or the `view` param from the teaser). Basemap: OpenFreeMap liberty, quieted after load (background to `MAP_STYLE.background`, water to `MAP_STYLE.water`, POI labels hidden).
- **Severity on the map:** each zone a `fill` layer colored by `severityColorExpression()` at opacity 0.55 (0.72 on hover), plus a `line` layer in the same color with width from `MAP_STYLE.lineWidth` (severe 2.5px, so severity also reads as weight). Erosion outlines are solid, landslide outlines dashed (`MAP_STYLE.lineDash`), the only kind distinction on the canvas. Selected zone: 3px `ink` outline above everything. The zone's severity is its **most recent change event's** score in the selected date window; zones with none render `nodata`. Labels: MapLibre's glyph renderer cannot shape Bengali, so zone labels on the canvas are Latin only (server font Noto Sans, 12px, ink with paper halo); Bangla zone names appear in HTML (rail, popover), never as GL text.
- **Desktop (≥1024px): left rail**, `w-rail` (360px), `surface` background, 1px `rule` right border, scrolls independently. Top to bottom: `type-h1` "Risk map" with a `type-meta` freshness line; kind filter as a three-way segmented control (All / River erosion / Hill landslide; square, 2px radius, selected = `river-tint` with river text); date window control (a ruled slider over the 2026-04-22 to 2026-10-21 range of events); `SeverityScale orientation="vertical"` with zone counts; then the zone list sorted severity-first, each row: `SeverityBadge` + `type-h3`-sized name + `type-meta` upazila/district + area. Hover a row highlights the zone; click flies to it.
- **Inspect panel** replaces the list inside the same rail (with "← All zones" back), not a popup over the map. Contents: zone name `type-h2`, district/upazila and kind in `type-meta`, `SeverityBadge variant="solid" showScore`, a `StatCallout size="md"` for area changed, a small inline-SVG strip chart of that zone's events over time (bars colored by band, direct-labelled dates), registered alert count, `SourceCitation` naming the latest `sourceScene` and date with the "Decision support, not a forecast" note, and a primary `ButtonLink` "Get alerts for this zone" to `/alerts?zone=<id>`.
- **Floating controls** (only things with `shadow-map`): zoom +/- and "Compare dates" (the Jamuna before/after swipe) at top right, square `surface` buttons. Attribution stays bottom right, as OpenFreeMap/OSM require.
- **Mobile (<1024px):** map fills the screen under the header; the rail becomes a bottom sheet with three snap points: peek (88px: the horizontal `SeverityScale` and "12 zones · 2 severe"), half, full. Inspect content uses the same sheet.

### (c) Alert signup
Lives in two places with one component: embedded in landing section 5, and as the full page `/alerts` (contained, two columns on desktop: copy left, form right; single column on mobile). It reads as a **paper form**, not a modal or a card.

- Container: `surface` background, 1px `rule` border, square corners, no shadow, padding `p-6 sm:p-8`, `max-w-[32rem]`. A `SectionLabel` "Alerts by SMS and voice call" at the top.
- Fields, labels always above in `type-small` 500 weight, help text below in `type-meta ink-subtle`:
  1. **Phone number**: a fixed `+880` prefix in Plex Mono inside the field, then the number (`inputMode="tel"`, `autoComplete="tel-national"`), validated for a Bangladeshi mobile format.
  2. **Your area**: a native `<select>` with two `optgroup`s, "Jamuna corridor" and "Chattogram Hill Tracts", options from `/api/zones` showing name and district. Prefilled from `?zone=`.
  3. **How to reach you**: two checkboxes, SMS and Bangla voice call, both on by default.
  4. **Language**: Bangla (default) or English, as two radio buttons.
- Inputs: 48px tall, `paper` fill, 1.5px `ink` bottom border only (a form-line, not a box), `rounded-xs` top corners; focus is the global 2px river outline. Errors: one line of `type-small` in `sev-high-ink` under the field, prefixed "Check this:", plus `aria-invalid`; no red boxes or shaking.
- Under the fields: a **preview of the actual alert** as a plain `type-meta` text block on `well` (what the SMS will say), so people know exactly what they're signing up for. Then a one-line consent statement and a primary `Button type="submit"` (full width on mobile).
- Success replaces the form in place: a 2px `ok` rule on top, a `type-eyebrow` "200 OK" in `ok`, a `type-h3` confirmation and the area and channels they chose, plus a secondary action to add another area. This is the only place `ok` appears outside the wordmark.

## 8. Ownership, to avoid conflicts

- `app/globals.css`, `app/layout.tsx`, `app/components/*`, `lib/design-tokens.ts`: shared foundation. Extend, don't restyle. A change here must update this file in the same edit.
- Page-specific components go next to their page (`app/map/_components/`, `app/alerts/_components/`, `app/_landing/`), not in `app/components/`.
- The alert form component is shared by the landing page and `/alerts`: the alerts build owns it (`app/alerts/_components/AlertSignupForm.tsx`) and the landing build imports it.
- The site header and footer are owned by the landing build and placed in `app/layout.tsx`'s children by each page (or promoted to the layout once it exists).
