import { publicCacheHeaders } from '$lib/server/public-cache';
import type { PageServerLoad } from './$types';
import { fetchMovieBySlug } from '$lib/server/content-service';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const { slug } = params as { slug: string };
	const [item, auth] = await Promise.all([fetchMovieBySlug(slug), parent()]);
	const isAuthenticated = Boolean(auth.user);
	if (!item) throw error(404, 'Movie not found');

	setHeaders(publicCacheHeaders(isAuthenticated));

	return { item };
};
