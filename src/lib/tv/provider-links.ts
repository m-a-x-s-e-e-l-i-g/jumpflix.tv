import { withUtm } from '$lib/utils';
import type { ContentItem, Episode } from './types';
import { getPublicProviderLinkSource, resolveMoviePlaybackSource } from './playback-source';

export type ProviderLink = {
	kind: 'youtube' | 'vimeo';
	url: string;
	title: string;
	ariaLabel: string;
};

export function getProviderLink(item: ContentItem, episode: Episode | null): ProviderLink | null {
	if (item.type === 'movie') {
		const movie = item;
		const publicSource = getPublicProviderLinkSource(resolveMoviePlaybackSource(movie));
		if (publicSource) {
			if (publicSource.kind === 'youtube') {
				return {
					kind: 'youtube',
					url: withUtm(publicSource.url),
					title: 'Open on YouTube',
					ariaLabel: 'Open on YouTube'
				};
			}
			return {
				kind: 'vimeo',
				url: withUtm(publicSource.url),
				title: 'Open on Vimeo',
				ariaLabel: 'Open on Vimeo'
			};
		}

		return null;
	}

	if (item.type === 'series') {
		// Prefer linking the selected episode when available (video URL)
		if (episode?.id) {
			const id = String(episode.id).trim();
			if (!id) return null;
			// Only show YouTube link if the ID matches YouTube video ID pattern (11 chars, alphanumeric + dash/underscore)
			// Database IDs (numeric or longer strings) should not show a YouTube link
			if (!/^[A-Za-z0-9_-]{11}$/.test(id)) return null;
			return {
				kind: 'youtube',
				url: withUtm(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`),
				title: 'Open episode on YouTube',
				ariaLabel: 'Open episode on YouTube'
			};
		}

		// Otherwise, link the series' YouTube playlist (season 1 / first available playlist)
		const series = item as any;
		const seasons = Array.isArray(series?.seasons) ? (series.seasons as any[]) : [];
		const playlistIdRaw = seasons.find((s) => typeof s?.playlistId === 'string' && s.playlistId.trim())
			?.playlistId;
		const playlistId = typeof playlistIdRaw === 'string' ? playlistIdRaw.trim() : '';
		if (!playlistId) return null;
		return {
			kind: 'youtube',
			url: withUtm(`https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`),
			title: 'Open series on YouTube',
			ariaLabel: 'Open series on YouTube'
		};
	}

	return null;
}
