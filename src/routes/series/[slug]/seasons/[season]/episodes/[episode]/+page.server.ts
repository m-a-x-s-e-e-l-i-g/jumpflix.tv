import { fetchRelatedContent } from '$lib/server/content-service';
import { publicCacheHeaders } from '$lib/server/public-cache';
import type { PageServerLoad } from './$types';
import { fetchSeriesBySlug } from '$lib/server/content-service';
import { findEpisode } from '$lib/tv/episode-selection';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const { slug, season, episode } = params as { slug: string; season: string; episode: string };
	const [parentData, item] = await Promise.all([parent(), fetchSeriesBySlug(slug)]);
	if (!item) throw error(404, 'Series not found');
	const selection = findEpisode(item, season, episode);
	if (!selection) throw error(404, 'Episode not found');

	const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
	setHeaders(publicCacheHeaders(isAuthenticated));

	return {
		item,
		related: await fetchRelatedContent(item),
		episode: selection.episode,
		initialEpisodeNumber: selection.episodeNumber,
		initialSeasonNumber: selection.seasonNumber
	};
};
