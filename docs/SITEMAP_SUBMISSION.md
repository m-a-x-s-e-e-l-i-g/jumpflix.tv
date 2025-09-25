# Sitemap Submission Configuration

This document outlines the environment variables and configuration options for automatic sitemap submission.

## Environment Variables

### Required

- `PUBLIC_SITE_URL`: The base URL of your site (e.g., `https://www.jumpflix.tv`)
  - Used to construct the sitemap URL for submission
  - Defaults to `https://www.jumpflix.tv` if not set

### Optional

- `NODE_ENV`: Set to `production` to enable automatic sitemap submission
  - Sitemap submission is skipped in non-production environments by default
- `FORCE_SITEMAP_SUBMISSION`: Set to `true` to force sitemap submission even in non-production environments
  - Note: Submissions are also skipped when `PUBLIC_SITE_URL` points to localhost (e.g., <http://localhost:5173>)
    unless `FORCE_SITEMAP_SUBMISSION=true` is set. This prevents accidental submissions during local development.

## How It Works

1. **During Build**: When you run `npm run build`, the sitemap is generated as part of the SvelteKit prerendering process
2. **After Build**: The `scripts/submit-sitemap.mjs` script automatically runs and submits the sitemap to:
   - **Bing/IndexNow**: Uses the modern IndexNow API (supports Bing, Yandex, and other search engines)
   - **Google**: Attempts traditional ping method (may be deprecated)

## Submission Methods

### Modern Approach (Recommended)

- **IndexNow API**: Automatically submits to Bing, Yandex, and other participating search engines
- **Google Search Console API**: For reliable Google submissions (requires setup)
- **Bing Webmaster Tools API**: For advanced Bing integration (requires setup)

### Legacy Approach (Limited)

- **Ping Endpoints**: Traditional ping URLs (increasingly deprecated)

## Manual Submission

You can also manually submit the sitemap by running:

```bash
npm run submit-sitemap
```

## Build Without Submission

If you want to build without automatically submitting the sitemap, use:

```bash
npm run build:no-sitemap
```

## Submission Results

The script will output the results of each submission attempt:

- ✅ Success indicators for successful submissions
- ⚠️ Warning indicators for deprecated methods that still work
- ❌ Error indicators with details for failed submissions
- 📊 Summary of successful vs. total submissions

## Recommended Setup for Production

For the most reliable sitemap submissions, consider setting up:

### Google Search Console

1. Verify your site at [Google Search Console](https://search.google.com/search-console)
2. Use the Search Console API for programmatic submissions
3. Manual fallback: Submit via the Search Console dashboard

### Bing Webmaster Tools

1. Verify your site at [Bing Webmaster Tools](https://www.bing.com/webmasters)
2. The IndexNow API should work automatically
3. Manual fallback: Submit via the Webmaster Tools dashboard

## Notes

- Sitemap submission failures will not cause the build to fail
- The script automatically constructs the sitemap URL based on your `PUBLIC_SITE_URL`
- IndexNow submissions happen automatically and support multiple search engines
- The script validates sitemap accessibility before attempting submissions
- Google's traditional ping method is deprecated but the script attempts it for backwards compatibility
- Localhost guard: When `PUBLIC_SITE_URL` is localhost/127.0.0.1/::1/.local, submission is skipped by default
