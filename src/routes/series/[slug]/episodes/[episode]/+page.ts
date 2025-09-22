import { getItemBySlug } from '$lib/tv/slug';
import { error } from '@sveltejs/kit';

export const load = async ({ params }: any) => {
  const { slug, episode } = params as { slug: string; episode: string };
  const item = getItemBySlug('series', slug);
  if (!item) throw error(404, 'Series not found');
  const episodeNumber = Number(episode);
  if (!Number.isFinite(episodeNumber) || episodeNumber < 1) throw error(404, 'Episode not found');
  return { item, initialEpisodeNumber: Math.floor(episodeNumber) };
};
