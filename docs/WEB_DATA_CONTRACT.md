# Route200 web data contract

Audience: Tanim and Faladun, building the change-detection engine track.

The web app (`web/`) does not talk to Postgres/Supabase, and never will. It
only calls two endpoints on itself: `GET /api/zones` and
`GET /api/change-events`. Right now those routes read local mock files
under `web/lib/data/`. When the real engine and database exist, the entire
integration point is replacing what those two route handlers read from.
Nothing in the frontend changes, because the frontend was built against
this contract from the start, not against the mock files directly.

The types below live in `web/lib/types.ts`. Treat that file as the source
of truth; this document describes it in prose.

## Zone

A named risk area: a stretch of the Jamuna corridor prone to erosion, or a
hill slope in the Chattogram Hill Tracts prone to landslide.

```
Zone {
  id: string                 // e.g. "zone-jamuna-kazipur"
  name: string                // human-readable, e.g. "Jamuna char, Kazipur"
  kind: "erosion" | "landslide"
  center: { lat: number, lng: number }
  geometry: Polygon | MultiPolygon   // GeoJSON geometry, WGS84 (lon, lat)
  district: string             // e.g. "Sirajganj"
  upazila: string              // e.g. "Kazipur"
  registeredAlertCount: number // placeholder; see note below
}
```

`registeredAlertCount` is a placeholder for the count of households/phone
numbers registered for alerts in that zone. In production this is derived
from the alert-delivery track's contact table (ARCHITECTURE.md section 5),
not a column stored directly on `zones`. The mock data hardcodes a number
so the web UI has something to render; the real API can compute it with a
join or a cached count, whichever is cheaper, as long as the field name
and type stay the same.

`geometry` is a standard GeoJSON `Polygon` or `MultiPolygon`. The mock data
uses approximate, hand-placed polygons near real place names: they are not
survey-grade and are not meant to be. Real geometry (from the engine's
change mask, or from CEGIS/HDX boundary data once available) can replace
them directly; the type does not change.

## ChangeEvent

A single detected change for one zone over one observed date range.

```
ChangeEvent {
  id: string
  zoneId: string               // foreign key into Zone.id
  dateRangeStart: string        // ISO 8601 date, "YYYY-MM-DD"
  dateRangeEnd: string           // ISO 8601 date, "YYYY-MM-DD"
  areaSqKm: number
  severity: number               // 0-100, engine's severity score
  sourceScene: "Sentinel-1 GRD" | "NISAR GCOV"
  detectedAt: string             // ISO 8601 timestamp
}
```

`severity` is always the raw 0-100 score. The web app derives a band and a
label from it with `severityToBand()` in `lib/types.ts`, it does not store
or expect a band string from the API. If the engine's own output already
includes a severity band, send the numeric score anyway and let the web
layer derive the label; that keeps the threshold logic in one place.

`sourceScene` is one of the two real product names in use: `"Sentinel-1
GRD"` for the development/validation rail, `"NISAR GCOV"` once a given
change event is actually computed from NISAR data. Don't introduce a third
value without updating `lib/types.ts`.

## Endpoints

### `GET /api/zones`

Returns a GeoJSON `FeatureCollection` of all zones, each feature's
`properties` matching `Zone` minus `geometry` (geometry sits at the
top level of the feature, as GeoJSON requires).

Query params:
- `kind` (optional): `"erosion"` or `"landslide"`. Returns only zones of
  that kind. Any other value returns a 400.

### `GET /api/change-events`

Returns a JSON array of `ChangeEvent` objects.

Query params:
- `zoneId` (optional): returns only events for that zone.
- `minSeverity` (optional, 0-100): returns only events with
  `severity >= minSeverity`. A non-numeric value is ignored rather than
  rejected.

Both params can be combined. Neither is required; omitting both returns
every event.

### `POST /api/alerts`

Accepts an alert signup submission from `web/app/alerts/_components/AlertSignupForm.tsx` (embedded on the landing page and on the standalone `/alerts` page).

Request body:

```
{
  phone: string           // E.164, "+880" followed by a 10-digit number
  zoneId: string           // must match a real Zone.id
  channels: { sms: boolean, voice: boolean }   // at least one true
  language: "bn" | "en"
}
```

Currently this is a placeholder: the handler validates the shape, logs `zoneId`/`channels`/`language` server-side (the phone number is deliberately left out of the log), and returns `{ ok: true }`. There is no contacts table yet. Replacing the body of `web/app/api/alerts/route.ts` with a real write to the alert-delivery track's contacts table (ARCHITECTURE.md section 5, the table that `zones.registeredAlertCount` above is ultimately derived from) is the entire integration point here too, same pattern as `/api/zones` and `/api/change-events`. The response shape (`{ ok: true }`, or an error) and the request body shape should stay the same so the form doesn't need to change.

## Swapping in the real engine

Both route handlers (`web/app/api/zones/route.ts` and
`web/app/api/change-events/route.ts`) currently read a local file:
`lib/data/zones.geojson` and `lib/data/change-events.json` respectively.
Replacing that one data-read in each file with a real Postgres/Supabase
query against the `zones` and `change_events` tables is the entire
integration point between this engine and the web track. The response
shape, the query params, and every type in `lib/types.ts` stay exactly as
documented above, so the frontend never needs to change: it only ever
talks to `/api/zones` and `/api/change-events`, never to Postgres
directly, exactly as ARCHITECTURE.md section 3 describes. Keep the same
field names and the same 0-100 numeric `severity`, and the swap is a
backend-only change.
