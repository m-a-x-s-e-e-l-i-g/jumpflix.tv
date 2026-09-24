import type { PageServerLoad } from './$types';
import { fetchSeriesBySlug } from '$lib/server/content-service';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const { slug } = params as { slug: string };
	const [parentData, item] = await Promise.all([parent(), fetchSeriesBySlug(slug)]);
	if (!item) throw error(404, 'Series not found');

	const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
	setHeaders({
		'Cache-Control': isAuthenticated
			? 'private, no-store'
			: 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400',
		Vary: 'Cookie'
	});

	return { item, initialSeasonNumber: item.seasons[0]?.seasonNumber ?? 1 };
};
