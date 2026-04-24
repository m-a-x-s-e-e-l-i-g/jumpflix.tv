import { env } from '$env/dynamic/public';
import { fetchAllContent } from '$lib/server/content-service';
import { createSupabaseClient } from '$lib/server/supabaseClient';
import type { ContentItem } from '$lib/tv/types';
import { slugify } from '$lib/tv/slug';

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
	const personLastmod = new Map<string, string>();
	for (const item of content) {
		if (!item?.slug) continue;
		const path = item.type === 'movie' ? `/movie/${item.slug}` : `/series/${item.slug}`;
		const lastmod = item.updatedAt ? new Date(item.updatedAt).toISOString() : undefined;
		entries.push({ path, lastmod });

		const itemPeople = [
			...(Array.isArray((item as any).creators) ? ((item as any).creators as unknown[]) : []),
			...(Array.isArray((item as any).starring) ? ((item as any).starring as unknown[]) : [])
		];

		for (const personName of itemPeople) {
			if (typeof personName !== 'string') continue;
			const personSlug = slugify(personName);
			if (!personSlug) continue;

			const existing = personLastmod.get(personSlug);
			if (!lastmod || (existing && existing >= lastmod)) continue;
			personLastmod.set(personSlug, lastmod);
		}
	}

	for (const [personSlug, personUpdatedAt] of personLastmod.entries()) {
		entries.push({ path: `/people/${personSlug}`, lastmod: personUpdatedAt });
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
