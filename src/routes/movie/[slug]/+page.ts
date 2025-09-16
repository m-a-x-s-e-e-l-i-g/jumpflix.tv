import { getItemBySlug } from '$lib/tv/slug';
import { error } from '@sveltejs/kit';

export const load = async ({ params }: any) => {
  const { slug } = params as { slug: string };
  const item = getItemBySlug('movie', slug);
  if (!item) throw error(404, 'Movie not found');
  return { item };
};
