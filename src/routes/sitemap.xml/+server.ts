import { env } from '$env/dynamic/public';
import { movieSlugMap, seriesSlugMap, getItemBySlug } from '$lib/tv/slug';

export const prerender = true;

const SITE = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');

// Note: Sitemap is automatically submitted to search engines after build
// via the post-build script (scripts/submit-sitemap.mjs)

function xmlEscape(input: string): string {
	return input
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export const GET = async () => {
	// Base routes
	const paths: string[] = ['/'];

	// Dynamic content routes (movies and series)
	const moviePaths = Array.from(movieSlugMap.keys())
		.sort()
		.map((slug) => `/movie/${slug}`);

	const seriesPaths = Array.from(seriesSlugMap.keys())
		.sort()
		.map((slug) => `/series/${slug}`);

	const all = [...paths, ...moviePaths, ...seriesPaths];

	const now = new Date().toISOString();
	const urls = all
		.map((path) => {
			const isMovie = path.startsWith('/movie/');
			const isSeries = path.startsWith('/series/');
			const slug = isMovie || isSeries ? path.split('/').pop() || '' : '';
			const item = slug ? getItemBySlug(isMovie ? 'movie' : 'series', slug) : null;
			let lastmod = now;
			if (item && item.type === 'movie' && 'year' in item && item.year) {
				lastmod = `${item.year}-01-01`;
			}
			const loc = `${SITE}${path}`;
			return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${lastmod}</lastmod>\n  </url>`;
		})
		.join('\n');

	const body = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

	return new Response(body, {
		headers: {
			'Content-Type': 'application/xml; charset=UTF-8',
			'Cache-Control': 'public, max-age=3600'
		}
	});
};
