#!/usr/bin/env node
// Compatibility entry point: legacy ping services are no longer supported.
console.log('Automatic sitemap pings have been retired. This command only checks availability.');
await import('./check-sitemap.mjs');
