import { env } from '$env/dynamic/public';
import {
	fetchAllContent,
	fetchSeriesEpisodeEntries,
	getContentServiceStatus
} from '$lib/server/content-service';
import { buildSitemap } from '$lib/server/sitemap';

// The catalog changes independently of deployments. Cache this live snapshot briefly.
export const prerender = false;

export const GET = async () => {
	try {
		const [content, episodes] = await Promise.all([
			fetchAllContent({ maxAgeMs: 5 * 60 * 1000 }),
			fetchSeriesEpisodeEntries()
		]);
		if (getContentServiceStatus().lastError) throw new Error('Catalog unavailable');
		return new Response(
			buildSitemap(env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv', content, episodes),
			{
				headers: {
					'Content-Type': 'application/xml; charset=UTF-8',
					'Cache-Control': 'public, max-age=300, s-maxage=300'
				}
			}
		);
	} catch (error) {
		console.error('[sitemap] Unable to load catalog', error);
		return new Response('Sitemap temporarily unavailable', {
			status: 503,
			headers: { 'Cache-Control': 'no-store' }
		});
	}
};
