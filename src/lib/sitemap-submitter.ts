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
      const pingUrl = `https://www.google.com/webmasters/tools/ping?sitemap=${encodeURIComponent(this.sitemapUrl)}`;
      const response = await fetch(pingUrl, { 
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SitemapSubmitter/1.0)'
        }
      });
      
      if (response.ok) {
        return { success: true, message: 'Successfully submitted to Google' };
      } else {
        return { success: false, message: `Google submission returned status: ${response.status}. Consider using Google Search Console API for reliable submissions.` };
      }
    } catch (error) {
      return { success: false, message: `Google submission error: ${error}. Consider using Google Search Console API for reliable submissions.` };
    }
  }

  /**
   * Submit sitemap to Bing Webmaster Tools
   */
  async submitToBing(): Promise<{ success: boolean; message: string }> {
    try {
      const pingUrl = `https://www.bing.com/webmaster/ping.aspx?siteMap=${encodeURIComponent(this.sitemapUrl)}`;
      const response = await fetch(pingUrl, { 
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SitemapSubmitter/1.0)'
        }
      });
      
      if (response.ok) {
        return { success: true, message: 'Successfully submitted to Bing' };
      } else {
        return { success: false, message: `Bing submission returned status: ${response.status}. Consider using Bing Webmaster Tools API for reliable submissions.` };
      }
    } catch (error) {
      return { success: false, message: `Bing submission error: ${error}. Consider using Bing Webmaster Tools API for reliable submissions.` };
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