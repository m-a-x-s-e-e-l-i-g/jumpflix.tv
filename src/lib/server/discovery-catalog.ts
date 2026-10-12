import { decode } from 'html-entities';
import { FEEDS } from '../tv/feeds';
import { getEpisodeUrl, getUrlForItem, slugify } from '../tv/slug';
import type { ContentItem } from '../tv/types';
import { matchesFeed } from '../tv/utils';
import { verifiedDate } from '../seo';

export const DISCOVERY_TITLE = 'Parkour & Freerunning Film Guide | JUMPFLIX';
export const DISCOVERY_DESCRIPTION =
	'Explore parkour and freerunning films, documentaries, series and classic edits. Find collections, creators, athletes and official viewing links in the JUMPFLIX archive.';

/** Catalog text stays text in both HTML and Markdown, including encoded markup. */
export function catalogText(value?: string): string {
	return decode(value ?? '')
		.replace(/<[^>]*>/g, '')
		.replace(/\s+/g, ' ')
		.trim();
}

function person(name: string, origin: string) {
	const slug = slugify(name);
	return { name: catalogText(name), url: slug ? `${origin}/people/${slug}` : null };
}

/** Explicit projection: never publish playback URLs, credentials or user records. */
export function buildDiscoveryCatalog(content: ContentItem[], site: string) {
	const origin = site.replace(/\/$/, '');
	const catalog = content.filter((item) => item.slug);
	const items = catalog.map((item) => ({
		title: catalogText(item.title),
		type: item.type,
		url: origin + getUrlForItem(item),
		description: catalogText(item.description),
		year: item.type === 'movie' && /^\d{4}$/.test(item.year ?? '') ? item.year : undefined,
		duration: item.type === 'movie' ? catalogText(item.duration) : undefined,
		format: item.facets?.type?.replace(/-/g, ' '),
		access: item.availabilityStatus === 'unavailable' ? 'Unavailable' : item.paid ? 'Paid' : 'Free',
		creators: (item.creators ?? [])
			.filter((name) => catalogText(name))
			.map((name) => person(name, origin)),
		athletes: (item.starring ?? [])
			.filter((name) => catalogText(name))
			.map((name) => person(name, origin)),
		addedAt: verifiedDate(item.createdAt),
		episodes:
			item.type === 'series'
				? item.seasons.flatMap((season) =>
						(season.episodes ?? [])
							.filter((episode) => Number.isInteger(episode.position) && episode.position! > 0)
							.map((episode) => ({
								title: catalogText(episode.title),
								season: season.seasonNumber,
								number: episode.position!,
								url:
									origin +
									getEpisodeUrl(item, {
										seasonNumber: season.seasonNumber,
										episodeNumber: episode.position!
									})
							}))
					)
				: []
	}));
	items.sort((a, b) => a.title.localeCompare(b.title, 'en') || a.url.localeCompare(b.url));
	const people = new Map<string, { name: string; url: string | null; titles: number }>();
	for (const item of items) {
		const credits = new Map(
			[...item.creators, ...item.athletes].map((credit) => [credit.url ?? credit.name, credit])
		);
		for (const credit of credits.values()) {
			const key = credit.url ?? credit.name;
			const entry = people.get(key) ?? { ...credit, titles: 0 };
			entry.titles++;
			people.set(key, entry);
		}
	}
	const years = items
		.map((item) => item.year)
		.filter((year): year is string => Boolean(year))
		.sort();
	return {
		origin,
		items,
		stats: {
			titles: items.length,
			films: items.filter((item) => item.type === 'movie').length,
			series: items.filter((item) => item.type === 'series').length,
			documentaries: items.filter((item) => item.format === 'documentary').length,
			free: items.filter((item) => item.access === 'Free').length,
			paid: items.filter((item) => item.access === 'Paid').length,
			unavailable: items.filter((item) => item.access === 'Unavailable').length,
			people: people.size,
			firstYear: years[0],
			lastYear: years.at(-1)
		},
		collections: FEEDS.map((feed) => ({
			slug: feed.slug,
			title: feed.title('en'),
			description: feed.introduction('en'),
			url: `${origin}/collections/${feed.slug}`,
			count: catalog.filter((item) => matchesFeed(item, feed.slug)).length
		})),
		people: [...people.values()].sort(
			(a, b) => b.titles - a.titles || a.name.localeCompare(b.name, 'en')
		),
		recent: items
			.filter((item) => item.addedAt)
			.sort((a, b) => b.addedAt!.localeCompare(a.addedAt!) || a.url.localeCompare(b.url))
			.slice(0, 8)
	};
}

export type DiscoveryCatalog = ReturnType<typeof buildDiscoveryCatalog>;

function markdown(value: string) {
	return value.replace(/([\\`*_{}\[\]<>#|!])/g, '\\$1');
}

function link(name: string, url: string) {
	return `[${markdown(name)}](${url.replace(/\(/g, '%28').replace(/\)/g, '%29')})`;
}

export function renderCatalogText(catalog: DiscoveryCatalog, checkedAt: string | null) {
	const { origin, stats } = catalog;
	const lines = [
		'# JUMPFLIX — Parkour & Freerunning Film Catalog',
		'',
		DISCOVERY_DESCRIPTION,
		'',
		`Film guide: ${origin}/discover`,
		`Watch and search: ${origin}/`,
		...(checkedAt ? [`Catalog snapshot checked: ${checkedAt}`] : []),
		'',
		'## About the catalog',
		'',
		'JUMPFLIX is a community-curated archive of parkour and freerunning cinema. It includes short edits as well as long-form films, documentaries and series. Film pages link to official viewing sources and credit known creators and athletes.',
		'Browsing does not require an account. Free and paid entries are labeled separately; availability and regional restrictions can change. Unavailable entries remain in the archive for reference. Release years describe films, not video upload dates. Missing metadata is unknown.',
		'Catalog search supports titles, creators, athletes, song titles and artists from credited soundtracks. Where spot chapters and timed music credits are available, the video player shows the current parkour spot and song during playback, with links to parkour.spot and Spotify when available.',
		`Find videos by parkour spot: ${origin}/video-map — search by spot name or explore the map to open films and series linked to each location.`,
		'',
		'## Catalog statistics',
		'',
		`${stats.titles} titles: ${stats.films} films and videos, ${stats.series} series.`,
		`${stats.documentaries} titles tagged documentary; ${stats.people} credited people and crews.`,
		`${stats.free} entries listed as free, ${stats.paid} paid, ${stats.unavailable} unavailable. These are catalog labels, not a guarantee of current playback.`,
		'',
		'## Collections',
		'',
		...catalog.collections.flatMap((collection) => [
			`### ${link(collection.title, collection.url)} (${collection.count} titles)`,
			collection.description,
			''
		]),
		'## Films and series',
		''
	];
	for (const item of catalog.items) {
		lines.push(`### ${link(item.title, item.url)}`);
		lines.push(
			[
				item.type === 'movie' ? 'Film / video' : 'Series',
				item.year,
				item.duration,
				item.format,
				item.access
			]
				.filter(Boolean)
				.join(' · ')
		);
		if (item.description) lines.push(markdown(item.description));
		for (const [label, credits] of [
			['Creators', item.creators],
			['Athletes', item.athletes]
		] as const) {
			if (credits.length)
				lines.push(
					`${label}: ${credits.map((credit) => (credit.url ? link(credit.name, credit.url) : markdown(credit.name))).join(', ')}`
				);
		}
		for (const episode of item.episodes) {
			lines.push(
				`- Season ${episode.season}, episode ${episode.number}: ${link(episode.title, episode.url)}`
			);
		}
		lines.push('');
	}
	return lines.join('\n');
}
