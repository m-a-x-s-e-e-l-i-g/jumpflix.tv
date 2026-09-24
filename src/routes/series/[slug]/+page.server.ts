import { publicCacheHeaders } from '$lib/server/public-cache';
import type { PageServerLoad } from './$types';
import { fetchSeriesBySlug } from '$lib/server/content-service';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const { slug } = params as { slug: string };
	const [parentData, item] = await Promise.all([parent(), fetchSeriesBySlug(slug)]);
	if (!item) throw error(404, 'Series not found');

	const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
	setHeaders(publicCacheHeaders(isAuthenticated));

	return { item, initialSeasonNumber: item.seasons[0]?.seasonNumber ?? 1 };
};
