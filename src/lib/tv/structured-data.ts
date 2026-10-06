import { decode } from 'html-entities';
import { verifiedDate } from '../seo';
import { getEpisodeUrl, getUrlForItem, slugify } from './slug';
import type { ContentItem } from './types';

export function isoDuration(value?: string): string | undefined {
	const match = value?.trim().match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?$/i);
	if (!match) return undefined;
	const minutes = Number(match[1] || 0) * 60 + Number(match[2] || 0);
	return minutes > 0 ? `PT${minutes}M` : undefined;
}

function credits(names: string[] | undefined, origin: string) {
	// Catalog credits include both people and crews; do not guess an entity type.
	return names
		?.filter((name) => name.trim())
		.map((name) => ({
			name: decode(name).trim(),
			url: `${origin}/people/${slugify(name)}`
		}));
}

/** Describe the work and its real catalog records, without exposing playback credentials. */
export function buildContentSchema(item: ContentItem, site: string) {
	const origin = site.replace(/\/$/, '');
	const url = origin + getUrlForItem(item);
	const type = item.type === 'movie' ? 'Movie' : 'TVSeries';
	const schema = {
		'@context': 'https://schema.org',
		'@type': type,
		'@id': `${url}#${item.type}`,
		url,
		mainEntityOfPage: url,
		name: decode(item.title),
		description: item.description
			? decode(item.description).replace(/\s+/g, ' ').trim()
			: undefined,
		image: new URL(item.thumbnail || '/images/jumpflix.webp', origin).href,
		genre: item.facets?.type?.replace(/-/g, ' '),
		keywords: ['Parkour', 'Freerunning', ...(item.facets?.movement ?? []), item.facets?.environment]
			.filter(Boolean)
			.map((keyword) => keyword!.replace(/-/g, ' ')),
		creator: credits(item.creators, origin),
		actor: credits(item.starring, origin)
	};
	if (item.type === 'movie') return { ...schema, duration: isoDuration(item.duration) };
	const seasons = item.seasons.map((season) => ({
		'@type': 'TVSeason',
		seasonNumber: season.seasonNumber,
		name: season.customName ? decode(season.customName) : undefined,
		numberOfEpisodes: season.episodes?.length,
		partOfSeries: { '@id': schema['@id'] },
		episode: season.episodes
			?.filter((episode) => Number.isInteger(episode.position) && episode.position! > 0)
			.map((episode) => {
				const episodeUrl =
					origin +
					getEpisodeUrl(item, {
						seasonNumber: season.seasonNumber,
						episodeNumber: episode.position!
					});
				return {
					'@type': 'TVEpisode',
					'@id': `${episodeUrl}#episode`,
					url: episodeUrl,
					name: decode(episode.title),
					episodeNumber: episode.position,
					datePublished: verifiedDate(episode.publishedAt),
					duration: isoDuration(episode.duration),
					partOfSeries: { '@id': schema['@id'] }
				};
			})
	}));
	return {
		...schema,
		numberOfSeasons: seasons.length,
		numberOfEpisodes: item.episodeCount,
		containsSeason: seasons
	};
}
