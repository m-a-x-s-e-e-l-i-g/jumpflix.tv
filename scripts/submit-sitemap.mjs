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
 * Submit sitemap to Google
 */
async function submitToGoogle() {
  try {
    const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const response = await fetch(pingUrl, { method: 'GET' });
    
    if (response.ok) {
      console.log('✅ Successfully submitted sitemap to Google');
      return true;
    } else {
      console.error(`❌ Google submission failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Google submission error: ${error.message}`);
    return false;
  }
}

/**
 * Submit sitemap to Bing
 */
async function submitToBing() {
  try {
    const pingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(SITEMAP_URL)}`;
    const response = await fetch(pingUrl, { method: 'GET' });
    
    if (response.ok) {
      console.log('✅ Successfully submitted sitemap to Bing');
      return true;
    } else {
      console.error(`❌ Bing submission failed with status: ${response.status}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Bing submission error: ${error.message}`);
    return false;
  }
}

/**
 * Main function to submit sitemap to all search engines
 */
async function main() {
  console.log('🚀 Starting sitemap submission process...');
  console.log(`📍 Sitemap URL: ${SITEMAP_URL}`);
  
  // Check if we're in a production environment
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_SITEMAP_SUBMISSION) {
    console.log('⚠️  Skipping sitemap submission in non-production environment');
    console.log('   Set FORCE_SITEMAP_SUBMISSION=true to override this behavior');
    return;
  }

  const results = await Promise.allSettled([
    submitToGoogle(),
    submitToBing()
  ]);

  const successful = results.filter(result => result.status === 'fulfilled' && result.value).length;
  const total = results.length;

  console.log(`\n📊 Submission Summary: ${successful}/${total} successful`);
  
  if (successful === total) {
    console.log('🎉 All sitemap submissions completed successfully!');
    process.exit(0);
  } else {
    console.log('⚠️  Some sitemap submissions failed. Check the logs above for details.');
    process.exit(0); // Don't fail the build for sitemap submission failures
  }
}

// Run the script
main().catch((error) => {
  console.error('💥 Unexpected error during sitemap submission:', error);
  process.exit(0); // Don't fail the build
});