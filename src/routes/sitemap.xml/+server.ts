import { env } from '$env/dynamic/public';
import { fetchAllContent } from '$lib/server/content-service';
import { createSupabaseClient } from '$lib/server/supabaseClient';
import type { ContentItem } from '$lib/tv/types';

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
	const now = new Date().toISOString();

	// Base routes
	const entries: Array<{ path: string; lastmod?: string }> = [{ path: '/', lastmod: undefined }];

	// Public stats overview
	entries.push({ path: '/stats', lastmod: undefined });

	const content = await fetchAllContent();
	for (const item of content) {
		if (!item?.slug) continue;
		const path = item.type === 'movie' ? `/movie/${item.slug}` : `/series/${item.slug}`;
		const lastmod = item.updatedAt ? new Date(item.updatedAt).toISOString() : undefined;
		entries.push({ path, lastmod });
	}

	const deduped = Array.from(new Map(entries.map((entry) => [entry.path, entry])).values());

	const urls = deduped
		.sort((a, b) => a.path.localeCompare(b.path))
		.map(({ path, lastmod }) => {
			const effectiveLastmod = lastmod ?? now;
			const loc = `${SITE}${path}`;
			return `  <url>\n    <loc>${xmlEscape(loc)}</loc>\n    <lastmod>${effectiveLastmod}</lastmod>\n  </url>`;
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
