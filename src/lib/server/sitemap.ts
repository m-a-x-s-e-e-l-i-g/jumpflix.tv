import { FEEDS } from '../tv/feeds';
import { getUrlForItem, slugify } from '../tv/slug';
import { matchesFeed } from '../tv/utils';
import type { ContentItem } from '../tv/types';
import { verifiedDate } from '../seo';

type EpisodeEntry = {
	slug: string;
	seasonNumber: number;
	episodeNumber: number;
	updatedAt?: string;
};

function escapeXml(value: string) {
	return value
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&apos;');
}

export function buildSitemap(site: string, content: ContentItem[], episodes: EpisodeEntry[]) {
	const entries = new Map<string, string | undefined>();
	function add(path: string, updatedAt?: string) {
		const date = verifiedDate(updatedAt);
		const existing = entries.get(path);
		entries.set(path, date && (!existing || date > existing) ? date : existing);
	}
	for (const path of ['/', '/about', '/video-map', '/stats']) add(path);
	for (const item of content) {
		if (!item.slug) continue;
		add(getUrlForItem(item), item.updatedAt);
		for (const name of [...(item.creators ?? []), ...(item.starring ?? [])]) {
			const slug = slugify(name);
			if (slug) add(`/people/${slug}`, item.updatedAt);
		}
	}
	const series = new Map(
		content.filter((item) => item.type === 'series').map((item) => [item.slug, item])
	);
	for (const episode of episodes) {
		const item = series.get(episode.slug);
		if (!item) continue;
		const path = `/series/${episode.slug}/seasons/${episode.seasonNumber}/episodes/${episode.episodeNumber}`;
		add(path, item.updatedAt);
		add(path, episode.updatedAt);
		// Changes to episodes also change their series page.
		add(getUrlForItem(item), episode.updatedAt);
	}
	for (const feed of FEEDS) {
		const path = `/collections/${feed.slug}`;
		add(path);
		for (const item of content.filter((entry) => matchesFeed(entry, feed.slug)))
			add(path, item.updatedAt);
	}
	const origin = site.replace(/\/$/, '');
	const urls = [...entries]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(
			([path, date]) =>
				`  <url><loc>${escapeXml(origin + path)}</loc>${date ? `<lastmod>${date}</lastmod>` : ''}</url>`
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}
