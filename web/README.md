# Route200 web

The public web experience for Route200: the landing page, the interactive risk map, and the alert signup flow. Part of the [Route200](../README.md) project.

## Stack

Next.js 16 (App Router, TypeScript, Tailwind v4, Turbopack), MapLibre GL JS over [OpenFreeMap](https://openfreemap.org/) tiles (no API key required).

## Running locally

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Where things live

- `app/` : the three routes (`/`, `/map`, `/alerts`) and their page-specific components, kept next to the page that owns them (`app/_landing/`, `app/map/_components/`, `app/alerts/_components/`).
- `app/components/` : shared design-system primitives used across pages. See `DESIGN_SPEC.md` before adding a new one.
- `app/api/` : route handlers backing the mock data layer (`/api/zones`, `/api/change-events`, `/api/alerts`). See `../docs/WEB_DATA_CONTRACT.md` for the exact shapes and the real-engine integration point.
- `lib/` : shared types, mock data, and the token mirror MapLibre reads from (it can't read CSS variables).
- `DESIGN_SPEC.md` : the committed visual system (palette, type, motion, layout). Read this before styling anything; it's the single source of truth, not `app/globals.css` alone.
- `.design-research/` : the research and copy drafts the design system and landing page were built from. Reference material, not live documentation.
