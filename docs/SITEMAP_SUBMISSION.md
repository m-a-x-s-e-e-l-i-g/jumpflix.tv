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

## How It Works

1. **During Build**: When you run `npm run build`, the sitemap is generated as part of the SvelteKit prerendering process
2. **After Build**: The `scripts/submit-sitemap.mjs` script automatically runs and submits the sitemap to:
   - Google Search Console (via ping endpoint)
   - Bing Webmaster Tools (via ping endpoint)

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
- ❌ Error indicators with details for failed submissions
- 📊 Summary of successful vs. total submissions

## Notes

- Sitemap submission failures will not cause the build to fail
- The script automatically constructs the sitemap URL based on your `PUBLIC_SITE_URL`
- Both Google and Bing submissions happen in parallel for efficiency