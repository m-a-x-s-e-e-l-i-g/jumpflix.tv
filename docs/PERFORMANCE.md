# Performance and discovery

## Loading boundaries

The persistent TV shell owns navigation and playback state. Only movie, series, and episode routes import `DetailRoute`, so the homepage does not import the detail UI. Sign-in, account settings, rating prompts, and admin tools load separately. The player still opens only after Play.

Catalog routes send compact song-title/artist pairs instead of complete track records. Description, creator, athlete, song-title, and artist search behavior is preserved. All catalog links remain in the initial HTML. Full track data belongs to the selected movie's loader.

The visible detail poster is eager and high-priority, with responsive Netlify Image CDN sizes. Other posters remain lazy. The homepage logo is no longer preloaded on every route. Plain Vite preview does not implement Netlify's image endpoint; validate transformed images on the deploy preview.

## Cache behavior

- Successful catalog snapshots are fresh for five minutes. Concurrent refreshes share one query.
- Failed refreshes retain the last successful snapshot and retry after 15 seconds. A cold failure returns HTTP 503, never an empty successful catalog.
- Invalidation prevents an older in-flight request from overwriting a newer snapshot.
- Anonymous public pages cache in the browser for 60 seconds and at the CDN for five minutes, with five minutes of stale-while-revalidate.
- Authenticated and degraded responses use `private, no-store`. Cookie and language variants are separated.
- Related-title queries return at most four public records and do not fetch the full catalog.

## Language URLs

English keeps `/` and `/collections/<slug>`. Dutch and Japanese use `/nl`, `/ja`, and the equivalent prefixed collection paths. Each has translated discovery copy, its own canonical, reciprocal `hreflang` links, and a sitemap entry. URL locale wins over cookies. Movie and episode descriptions are not translated, so those routes retain their existing URLs.

## Real-user measurements

The production site reports LCP, INP, and CLS through its existing Google Analytics tag using `web-vitals`. Localhost and deploy previews do not report these measurements. Account, admin, authentication, and API routes are excluded. Events include numeric `metric_value` and `metric_delta`, plus `metric_rating`, `metric_id`, and `page_type`; query strings are excluded from the reported page location. Metrics refer to the initial document, not subsequent SPA navigations.

Use GA4 custom definitions for the metric parameters and evaluate the 75th percentile separately for mobile and desktop. Targets: LCP <= 2.5 seconds, INP <= 200 milliseconds, CLS <= 0.1. Deploying the code does not create GA4 reports or establish that those targets are met.

## Validation

Run `npm run build`, `npm run check`, and `npm run test:seo`. Set `JUMPFLIX_TEST_URL` to a running production preview to include HTTP tests for SSR, detail payload isolation, canonical/alternate links, language precedence, and invalid routes.

Against the preceding PR build, the first measured production build reduced decoded homepage HTML from 1,309,790 to 972,794 bytes and the homepage's static JavaScript dependency graph from 1,028,745 to 793,761 bytes (sum of individually gzipped assets: 329,614 to 253,970 bytes). These are build/payload measurements, not real-user Core Web Vitals or total network transfer sizes.
