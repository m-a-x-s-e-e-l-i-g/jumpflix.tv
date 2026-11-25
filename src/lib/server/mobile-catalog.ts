import { decode } from 'html-entities';
import type { ContentItem, Episode } from '../tv/types';
import { resolveMoviePlaybackSource, getPublicProviderLinkSource } from '../tv/playback-source';

const SITE = 'https://www.jumpflix.tv';

function publicUrl(value: string | undefined): string | null {
	if (!value?.trim()) return null;
	try {
		const url = new URL(value.trim(), SITE);
		return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
	} catch {
		return null;
	}
}

function episodeDto(episode: Episode) {
	const youtubeId = /^[\w-]{11}$/.test(episode.id) ? episode.id : null;
	return {
		id: episode.id,
		title: decode(episode.title),
		position: episode.position ?? null,
		thumbnail: publicUrl(episode.thumbnail),
		duration: episode.duration ?? null,
		playback: episode.externalUrl
			? { kind: 'external', url: publicUrl(episode.externalUrl) }
			: youtubeId
				? { kind: 'youtube', url: `https://www.youtube.com/watch?v=${youtubeId}` }
				: null
	};
}

/** Explicit public contract: never serialize database rows, account data, or credentials. */
export function toMobileItem(item: ContentItem) {
	const available = item.availabilityStatus !== 'unavailable';
	const canonicalUrl = `${SITE}/${item.type === 'series' ? 'series' : 'movie'}/${encodeURIComponent(item.slug)}`;
	let playback: { kind: string; url: string | null } | null = null;
	if (available && item.paid) {
		playback = { kind: 'external', url: publicUrl(item.externalUrl) ?? canonicalUrl };
	} else if (available && item.type === 'movie') {
		const source = resolveMoviePlaybackSource(item);
		const provider = getPublicProviderLinkSource(source);
		if (provider) playback = { kind: provider.kind, url: publicUrl(provider.url) };
		else if (source) playback = { kind: source.kind, url: publicUrl(source.src) };
		else if (item.externalUrl) playback = { kind: 'external', url: publicUrl(item.externalUrl) };
	}
	if (playback && !playback.url) playback = null;

	return {
		id: `${item.type}:${item.id}`,
		slug: item.slug,
		type: item.type,
		title: decode(item.title),
		description: decode(item.description ?? ''),
		thumbnail: publicUrl(item.thumbnail),
		year: item.type === 'movie' ? (item.year ?? null) : null,
		duration: item.type === 'movie' ? (item.duration ?? null) : null,
		creators: item.creators?.map((name) => decode(name)) ?? [],
		starring: item.starring?.map((name) => decode(name)) ?? [],
		category: item.facets?.type ?? null,
		movement: item.facets?.movement ?? [],
		explicit: item.explicit === true || Boolean(item.facets?.contentWarnings?.length),
		paid: item.paid === true,
		available,
		provider: item.provider ?? null,
		averageRating: item.averageRating ?? null,
		ratingCount: item.ratingCount ?? 0,
		addedAt: item.createdAt ?? null,
		url: canonicalUrl,
		playback,
		seasons:
			item.type === 'series'
				? item.seasons.map((season) => ({
						number: season.seasonNumber,
						title: season.customName ?? `Season ${season.seasonNumber}`,
						// Episode IDs can be provider video IDs.
						episodes: available && !item.paid ? (season.episodes ?? []).map(episodeDto) : []
					}))
				: []
	};
}

export function catalogPage(items: ContentItem[], offset: number, limit: number) {
	const nextOffset = offset + limit < items.length ? offset + limit : null;
	return {
		schemaVersion: 1,
		generatedAt: new Date().toISOString(),
		total: items.length,
		nextOffset,
		items: items.slice(offset, offset + limit).map(toMobileItem)
	};
}

export function parseCatalogPagination(params: URLSearchParams) {
	const rawOffset = params.get('offset') ?? '0';
	const rawLimit = params.get('limit') ?? '100';
	if (!/^\d{1,7}$/.test(rawOffset) || !/^\d{1,3}$/.test(rawLimit)) return null;
	const offset = Number(rawOffset);
	const limit = Number(rawLimit);
	return limit >= 1 && limit <= 200 ? { offset, limit } : null;
}
