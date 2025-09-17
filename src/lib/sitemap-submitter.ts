import { env } from '$env/dynamic/public';

const SITE_URL = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');

/**
 * Submits sitemap to major search engines
 */
export class SitemapSubmitter {
  private sitemapUrl: string;

  constructor(sitemapPath = '/sitemap.xml') {
    this.sitemapUrl = `${SITE_URL}${sitemapPath}`;
  }

  /**
   * Submit sitemap to Google Search Console
   */
  async submitToGoogle(): Promise<{ success: boolean; message: string }> {
    try {
      const pingUrl = `https://www.google.com/ping?sitemap=${encodeURIComponent(this.sitemapUrl)}`;
      const response = await fetch(pingUrl, { method: 'GET' });
      
      if (response.ok) {
        return { success: true, message: 'Successfully submitted to Google' };
      } else {
        return { success: false, message: `Google submission failed: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `Google submission error: ${error}` };
    }
  }

  /**
   * Submit sitemap to Bing Webmaster Tools
   */
  async submitToBing(): Promise<{ success: boolean; message: string }> {
    try {
      const pingUrl = `https://www.bing.com/ping?sitemap=${encodeURIComponent(this.sitemapUrl)}`;
      const response = await fetch(pingUrl, { method: 'GET' });
      
      if (response.ok) {
        return { success: true, message: 'Successfully submitted to Bing' };
      } else {
        return { success: false, message: `Bing submission failed: ${response.status}` };
      }
    } catch (error) {
      return { success: false, message: `Bing submission error: ${error}` };
    }
  }

  /**
   * Submit sitemap to both Google and Bing
   */
  async submitToAll(): Promise<{ google: { success: boolean; message: string }; bing: { success: boolean; message: string } }> {
    const [googleResult, bingResult] = await Promise.all([
      this.submitToGoogle(),
      this.submitToBing()
    ]);

    return {
      google: googleResult,
      bing: bingResult
    };
  }
}

/**
 * Convenience function to submit sitemap to all search engines
 */
export async function submitSitemap(sitemapPath?: string) {
  const submitter = new SitemapSubmitter(sitemapPath);
  const results = await submitter.submitToAll();
  
  console.log('📍 Sitemap Submission Results:');
  console.log(`Google: ${results.google.success ? '✅' : '❌'} ${results.google.message}`);
  console.log(`Bing: ${results.bing.success ? '✅' : '❌'} ${results.bing.message}`);
  
  return results;
}