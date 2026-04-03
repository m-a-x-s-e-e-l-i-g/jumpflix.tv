import type { PageServerLoad } from './$types';
import { fetchMovieBySlug } from '$lib/server/content-service';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const { slug } = params as { slug: string };
	const parentData = await parent();
	const item = await fetchMovieBySlug(slug);
	if (!item) throw error(404, 'Movie not found');

	setHeaders({
		'Cache-Control': 'private, no-store',
		Vary: 'Cookie'
	});

	return { item };
};
