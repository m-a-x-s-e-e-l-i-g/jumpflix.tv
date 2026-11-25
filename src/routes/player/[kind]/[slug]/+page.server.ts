import { error } from '@sveltejs/kit';
import { fetchMovieBySlug, fetchSeriesBySlug } from '$lib/server/content-service';
import { findEpisode } from '$lib/tv/episode-selection';
import { resolveInlinePlaybackSource, resolveMoviePlaybackSource } from '$lib/tv/playback-source';
import { isContentUnavailable } from '$lib/tv/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, url }) => {
	const { kind, slug } = params;
	const item =
		kind === 'movie'
			? await fetchMovieBySlug(slug)
			: kind === 'series'
				? await fetchSeriesBySlug(slug)
				: null;
	if (!item || item.paid || isContentUnavailable(item)) error(404, 'Video unavailable');

	if (item.type === 'movie') {
		const source = resolveMoviePlaybackSource(item);
		if (!source) error(404, 'Video unavailable');
		return {
			src: source.src,
			title: item.title,
			poster: item.thumbnail,
			keySeed: `movie:${item.id}:${source.keySuffix}`,
			mediaId: Number(item.id) || null,
			mediaType: item.type,
			tracks: item.tracks
		};
	}

	const episode = findEpisode(
		item,
		url.searchParams.get('season') ?? '',
		url.searchParams.get('episode') ?? ''
	)?.episode;
	if (!episode?.id || episode.externalUrl || /^(?:pos:|\d+$)/.test(episode.id)) {
		error(404, 'Episode unavailable');
	}
	const source = resolveInlinePlaybackSource(episode.id);
	if (!source) error(404, 'Episode unavailable');
	return {
		src: source.src,
		title: episode.title,
		poster: episode.thumbnail ?? item.thumbnail,
		keySeed: `series:${item.id}:ep:${source.keySuffix}`,
		mediaId: Number(item.id) || null,
		mediaType: item.type,
		tracks: undefined
	};
};
