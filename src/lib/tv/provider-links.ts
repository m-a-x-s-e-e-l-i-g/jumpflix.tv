import { withUtm } from '$lib/utils';
import type { ContentItem, Episode } from './types';

export type ProviderLink = {
	kind: 'youtube' | 'vimeo';
	url: string;
	title: string;
	ariaLabel: string;
};

export function getProviderLink(item: ContentItem, episode: Episode | null): ProviderLink | null {
	if (item.type === 'movie') {
		const movie = item as any;

		if (movie.videoId) {
			const id = String(movie.videoId).trim();
			if (!id) return null;
			return {
				kind: 'youtube',
				url: withUtm(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`),
				title: 'Open on YouTube',
				ariaLabel: 'Open on YouTube'
			};
		}

		if (movie.vimeoId) {
			const id = String(movie.vimeoId).trim();
			if (!id) return null;
			return {
				kind: 'vimeo',
				url: withUtm(`https://vimeo.com/${encodeURIComponent(id)}`),
				title: 'Open on Vimeo',
				ariaLabel: 'Open on Vimeo'
			};
		}

		return null;
	}

	// Series: selectedEpisode.id is the YouTube video id
	if (item.type === 'series' && episode?.id) {
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

	return null;
}
