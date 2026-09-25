# Sitemap discovery and verification

The sitemap at /sitemap.xml is generated from current catalog records at request time. It contains films, series, existing episodes, people, public overview pages, and all six collection routes. It is cached for five minutes; the catalog snapshot used by this route is refreshed at most every five minutes. Catalog updates therefore do not require a deployment to appear in the sitemap (allow up to ten minutes across both caches).

Canonical URLs use the same slashless paths as internal links. A lastmod value is included only when a source modification timestamp is known; build time is never substituted. Failed database reads return HTTP 503 rather than publishing a truncated sitemap.

## Search engine setup

The production robots.txt already declares https://www.jumpflix.tv/sitemap.xml. Verify the domain in Google Search Console and Bing Webmaster Tools, then submit that sitemap URL in each account. Use their reports to check indexing; a successful HTTP request is not evidence that URLs are indexed.

Google retired its unauthenticated sitemap ping endpoint. Builds no longer call it, Bing's legacy ping endpoint, or an unverified IndexNow endpoint.

## Commands

- npm run build: build the application without search-engine submissions.
- npm run check:sitemap: perform a read-only check of PUBLIC_SITE_URL/sitemap.xml (defaults to production).
- npm run submit-sitemap: legacy compatibility alias for the availability check; does not submit anything.
- npm run test:seo: run metadata, episode, feed, and sitemap regression tests. Set JUMPFLIX_TEST_URL to a running local preview URL to also test HTTP responses.

For local checks, set PUBLIC_SITE_URL or JUMPFLIX_TEST_URL to the local server URL, as applicable. Never treat a local sitemap check as a production submission.

## Movie publication dates

The catalog currently stores movie release years, not verified video publication timestamps. Movie JSON-LD no longer guesses January 1 as an upload date. Movie and breadcrumb metadata remain; VideoObject markup is emitted only when a verified publication date is available. Episode metadata uses its stored published_at value when available. Movie video-rich-result eligibility requires verified publication metadata as well as an eligible watch page.
