import { getItemBySlug } from '$lib/tv/slug';
import { error } from '@sveltejs/kit';

export const load = async ({ params }: any) => {
	const { slug, season, episode } = params as { slug: string; season: string; episode: string };
	const item = getItemBySlug('series', slug);
	if (!item) throw error(404, 'Series not found');
	const seasonNumber = Number(season);
	const episodeNumber = Number(episode);
	if (!Number.isFinite(episodeNumber) || episodeNumber < 1) throw error(404, 'Episode not found');
	return {
		item,
		initialEpisodeNumber: Math.floor(episodeNumber),
		initialSeasonNumber: Number.isFinite(seasonNumber) ? Math.floor(seasonNumber) : null
	};
};
