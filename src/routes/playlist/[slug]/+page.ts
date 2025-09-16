import { getItemBySlug } from '$lib/tv/slug';
import { error } from '@sveltejs/kit';

export const load = async ({ params }: any) => {
  const { slug } = params as { slug: string };
  const item = getItemBySlug('playlist', slug);
  if (!item) throw error(404, 'Playlist not found');
  return { item };
};
