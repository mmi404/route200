# Route200 web

The public web experience for Route200: the landing page, the interactive risk map, the per-zone 3D terrain explore view, and the alert signup flow. Part of the [Route200](../README.md) project.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind v4, Turbopack), MapLibre GL JS over [OpenFreeMap](https://openfreemap.org/) tiles (no API key required). The 3D explore page adds a terrain layer from AWS Open Data's [Terrain Tiles](https://registry.opendata.aws/terrain-tiles/) (Terrarium encoding, also no API key, CC-BY 4.0, attribution shown on the page).

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Testing

```bash
npm test
```

Runs the Vitest suite covering the pure logic (severity math, date-window handling, the i18n helpers, the API route handlers' filter and validation behavior). Tests are colocated with the code they cover (`*.test.ts` next to its source file). React components and pages are not covered by automated tests; they're verified manually against `DESIGN_SPEC.md`.

## Where things live

- `app/` : the app's routes (`/`, `/map`, `/map/[zoneId]`, `/alerts`) and their page-specific components, kept next to the page that owns them (`app/_landing/`, `app/map/_components/`, `app/alerts/_components/`). `/map/[zoneId]` is the dedicated 3D terrain view for a single zone (real elevation, a draped change-severity layer, a scrub slider over that zone's event history), reached from `/map`'s inspect panel via "Explore in 3D".
- `app/components/` : shared design-system primitives used across pages. See `DESIGN_SPEC.md` before adding a new one.
- `app/api/` : route handlers backing the mock data layer (`/api/zones`, `/api/change-events`, `/api/alerts`). See `../docs/WEB_DATA_CONTRACT.md` for the exact shapes and the real-engine integration point.
- `lib/` : shared types, mock data, and the token mirror MapLibre reads from (it can't read CSS variables).
- `DESIGN_SPEC.md` : the committed visual system (palette, type, motion, layout). Read this before styling anything; it's the single source of truth, not `app/globals.css` alone.
- `.design-research/` : the research and copy drafts the design system and landing page were built from. Reference material, not live documentation.
- `lib/translations.ts`, `lib/i18n.ts`, `lib/locale.ts`, `app/actions/locale-actions.ts` : the Bangla/English locale system. See the header comment in `translations.ts` for the dictionary's shape and conventions before adding a new string.
