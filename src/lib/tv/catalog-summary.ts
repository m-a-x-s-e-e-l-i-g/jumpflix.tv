import type { ContentItem } from './types';

/** Search needs titles/artists, not Spotify metadata or playback timestamps. */
export function toCatalogSummary(item: ContentItem): ContentItem {
	if (item.type !== 'movie') return item;
	const { tracks, ...summary } = item;
	return {
		...summary,
		musicSearch: tracks?.map(({ song }) => [song.title, song.artist] as [string, string])
	};
}
