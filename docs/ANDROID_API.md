# Android client API

The native Android/Android TV app lives in the separate local `jumpflix-android`
repository. It is a Kotlin/Compose GPL client using selected NuvioTV code.
The website remains the owner of catalog data and these public read-only routes.
No partner token, service-role key, or account session is required by the app.

## GET /api/mobile/v1/catalog

Query parameters: `offset` (non-negative integer, default 0), `limit` (1–200,
default 100). Invalid values return 400. The response contains `schemaVersion: 1`,
`generatedAt` (UTC), `total`, nullable `nextOffset`, and `items`.

Each item is explicitly mapped in `src/lib/server/mobile-catalog.ts`. IDs are
stable `movie:{id}` / `series:{id}` strings. Artwork and canonical/provider URLs
are absolute HTTPS. Titles, descriptions and credit names are decoded text.
Only existing public catalog fields are exposed; database rows and account data
are never returned directly.

Playback is nullable `{ kind, url }`, with kinds `youtube`, `vimeo`, `hls`,
`direct`, and `external`. YouTube/Vimeo return official provider URLs. Paid
items only expose the external provider/canonical page. Unavailable items have
no playback. Clients must preserve those boundaries.

The list contains season headings; fetch series detail to load episodes.

## GET /api/mobile/v1/series/{slug}

Returns one item with DB-backed seasons and episodes, preserving season numbers
and sparse episode positions. Unknown slugs return 404. This uses the existing
series service and does not invoke external provider API fallbacks. Episodes
without a validated source remain unplayable in-app, with the canonical website
as a fallback.

Responses have short public cache lifetimes. No personalized fields may be added
to this publicly cached contract. Catalog service failures return 503; degraded
cache responses are not cached by the new endpoint.

## Validation and deployment

```powershell
node --import tsx --test tests/mobile/*.test.ts
npm run check
npm run build:no-sitemap
```

Deploy these website changes before expecting the native app's production
catalog refresh to work. The native APK can otherwise browse its explicitly
dated bundled snapshot. Local device development uses `adb reverse` and a
configurable API origin, documented in the native repository.
