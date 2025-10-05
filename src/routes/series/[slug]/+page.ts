import { getItemBySlug } from '$lib/tv/slug';
import { error } from '@sveltejs/kit';

export const load = async ({ params }: any) => {
	const { slug } = params as { slug: string };
	const item = getItemBySlug('series', slug);
	if (!item) throw error(404, 'Series not found');
	return { item, episodes: [] };
};
