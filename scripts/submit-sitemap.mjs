#!/usr/bin/env node

/**
 * Post-build script to automatically submit sitemap to search engines
 * This script should be run after the build process completes
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const SITE_URL = process.env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv';
const SITEMAP_URL = `${SITE_URL.replace(/\/$/, '')}/sitemap.xml`;

/**
 * Determine if a URL points to localhost or a loopback host
 */
function isLocalhostUrl(urlString) {
  try {
    const u = new URL(urlString);
    const host = u.hostname.toLowerCase();
    return (
      host === 'localhost' ||
      host === '::1' ||
      host === '0.0.0.0' ||
      host.startsWith('127.') ||
      host.endsWith('.local')
    );
  } catch {
    return false;
  }
}

/**
 * Submit sitemap to Google (using IndexNow API or traditional ping)
 */
async function submitToGoogle() {
  try {
    // First try the traditional ping method (still works in some cases)
    const pingUrl = `https://www.google.com/webmasters/tools/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const response = await fetch(pingUrl, { 
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SitemapSubmitter/1.0)'
      }
    });
    
    if (response.ok) {
      console.log('✅ Successfully submitted sitemap to Google');
      return true;
    } else {
      console.log(`⚠️  Google ping method returned status: ${response.status}`);
      console.log('ℹ️  Note: For reliable Google submissions, consider using Google Search Console API');
      console.log('   or manually submit via https://search.google.com/search-console');
      return false;
    }
  } catch (error) {
    console.error(`❌ Google submission error: ${error.message}`);
    console.log('ℹ️  For reliable Google submissions, use Google Search Console API or manual submission');
    return false;
  }
}

/**
 * Submit sitemap using IndexNow API (supported by Bing, Yandex, and others)
 */
async function submitToIndexNow() {
  try {
    const indexNowUrl = 'https://api.indexnow.org/indexnow';
    
    // IndexNow requires a key, but we can try without one first
    const payload = {
      host: new URL(SITE_URL).hostname,
      key: 'anonymous', // Some services accept anonymous submissions
      keyLocation: `${SITE_URL}/indexnow-key.txt`,
      urlList: [SITEMAP_URL]
    };

    const response = await fetch(indexNowUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (compatible; SitemapSubmitter/1.0)'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok || response.status === 202) {
      console.log('✅ Successfully submitted sitemap via IndexNow API');
      return true;
    } else {
      console.log(`⚠️  IndexNow submission returned status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ IndexNow submission error: ${error.message}`);
    return false;
  }
}

/**
 * Submit sitemap to Bing (try multiple methods)
 */
async function submitToBing() {
  try {
    // Try IndexNow first (modern approach)
    const indexNowSuccess = await submitToIndexNow();
    if (indexNowSuccess) {
      console.log('✅ Successfully submitted sitemap to Bing via IndexNow');
      return true;
    }

    // Fallback to traditional ping (may be deprecated)
    const pingUrl = `https://www.bing.com/webmaster/ping.aspx?siteMap=${encodeURIComponent(SITEMAP_URL)}`;
    const response = await fetch(pingUrl, { 
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SitemapSubmitter/1.0)'
      }
    });
    
    if (response.ok) {
      console.log('✅ Successfully submitted sitemap to Bing via ping');
      return true;
    } else {
      console.log(`⚠️  Bing ping method returned status: ${response.status}`);
      console.log('ℹ️  Note: For reliable Bing submissions, consider using Bing Webmaster Tools API');
      console.log('   or manually submit via https://www.bing.com/webmasters');
      return false;
    }
  } catch (error) {
    console.error(`❌ Bing submission error: ${error.message}`);
    console.log('ℹ️  For reliable Bing submissions, use Bing Webmaster Tools API or manual submission');
    return false;
  }
}

/**
 * Validate that the sitemap is accessible
 */
async function validateSitemap() {
  try {
    console.log(`🔍 Validating sitemap availability at: ${SITEMAP_URL}`);
    const response = await fetch(SITEMAP_URL, { method: 'HEAD' });
    
    if (response.ok) {
      console.log('✅ Sitemap is accessible');
      return true;
    } else {
      console.error(`❌ Sitemap validation failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Sitemap validation error: ${error.message}`);
    return false;
  }
}

/**
 * Main function to submit sitemap to all search engines
 */
async function main() {
  console.log('🚀 Starting sitemap submission process...');
  console.log(`📍 Sitemap URL: ${SITEMAP_URL}`);
  
  // Never submit when targeting localhost (unless explicitly forced)
  if (isLocalhostUrl(SITE_URL) || isLocalhostUrl(SITEMAP_URL)) {
    if (process.env.FORCE_SITEMAP_SUBMISSION) {
      console.log('⚠️  PUBLIC_SITE_URL points to localhost but FORCE_SITEMAP_SUBMISSION is set. Proceeding anyway.');
    } else {
      console.log('⏭️  Skipping sitemap submission because PUBLIC_SITE_URL points to localhost.');
      console.log('    Set FORCE_SITEMAP_SUBMISSION=true to override (not recommended).');
      return;
    }
  }
  
  // Check if we're in a production environment
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_SITEMAP_SUBMISSION) {
    console.log('⚠️  Skipping sitemap submission in non-production environment');
    console.log('   Set FORCE_SITEMAP_SUBMISSION=true to override this behavior');
    return;
  }

  // Validate sitemap first
  const sitemapValid = await validateSitemap();
  if (!sitemapValid) {
    console.log('💥 Cannot proceed with submission - sitemap is not accessible');
    process.exit(0);
  }

  console.log('\n🌐 Submitting sitemap to search engines...');
  
  const results = await Promise.allSettled([
    submitToGoogle(),
    submitToBing()
  ]);

  const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
  const total = results.length;

  console.log(`\n📊 Submission Summary: ${successful}/${total} successful`);
  
  if (successful === total) {
    console.log('🎉 All sitemap submissions completed successfully!');
  } else if (successful > 0) {
    console.log('⚠️  Some sitemap submissions failed, but at least one succeeded.');
    console.log('💡 Consider setting up API-based submissions for more reliable results.');
  } else {
    console.log('❌ All sitemap submissions failed.');
    console.log('💡 Manual submission alternatives:');
    console.log('   - Google: https://search.google.com/search-console');
    console.log('   - Bing: https://www.bing.com/webmasters');
  }
  
  process.exit(0);
}

// Run the script
main().catch((error) => {
  console.error('💥 Unexpected error during sitemap submission:', error);
  process.exit(0); // Don't fail the build
});