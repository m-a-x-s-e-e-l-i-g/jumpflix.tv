import { browser } from '$app/environment';
import { getEpisodeUrl, getUrlForItem } from '$lib/tv/slug';
import type { ContentItem } from '$lib/tv/types';
import { withUtm } from '$lib/utils';

export function buildItemUrl(
	item: ContentItem,
	opts?: { epId?: string; episodeNumber?: number; seasonNumber?: number }
) {
	const base = getUrlForItem(item);
	const useEpisodePath = item.type === 'series' && typeof opts?.episodeNumber === 'number';
	const path = useEpisodePath
		? getEpisodeUrl(item as any, {
				episodeNumber: Math.max(1, Math.floor(opts!.episodeNumber!)),
				seasonNumber: opts?.seasonNumber
			})
		: base;

	const params = new URLSearchParams();
	if (item.type === 'series' && !opts?.episodeNumber && opts?.epId) {
		params.set('ep', opts.epId);
	}

	const query = params.toString();
	return `${path}${query ? `?${query}` : ''}`;
}

export function extractSeasonEpisodeFromPath(path: string): { season?: number; episode?: number } {
	const match = path.match(/\/seasons\/(\d+)\/episodes\/(\d+)/);
	if (!match) return {};

	const season = Math.max(1, parseInt(match[1] || '1', 10));
	const episode = Math.max(1, parseInt(match[2] || '1', 10));
	return { season, episode };
}

export function buildPageTitle(
	item: ContentItem,
	opts?: { season?: number; episode?: number }
): string {
	if (item.type === 'movie') {
		const year = (item as any).year ? ` (${(item as any).year})` : '';
		return `${item.title}${year} — Watch Parkour Film on JUMPFLIX`;
	}

	const season = opts?.season;
	const episode = opts?.episode;
	if (typeof episode === 'number') {
		const seasonCode = typeof season === 'number' ? `s${String(season).padStart(2, '0')}` : '';
		const episodeCode = `e${String(episode).padStart(2, '0')}`;
		const combined = seasonCode ? `${seasonCode}${episodeCode}` : episodeCode;
		return `${item.title} ${combined} — Watch Parkour Series on JUMPFLIX`;
	}

	return `${item.title} — Watch Parkour Series on JUMPFLIX`;
}

export function openExternalContent(content: ContentItem) {
	if (!content?.externalUrl || !browser) return;
	window.open(withUtm(content.externalUrl), '_blank', 'noopener');
}
