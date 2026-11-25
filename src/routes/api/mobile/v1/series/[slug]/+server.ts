import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchSeriesBySlug } from '$lib/server/content-service';
import { toMobileItem } from '$lib/server/mobile-catalog';

export const GET: RequestHandler = async ({ params }) => {
	const series = await fetchSeriesBySlug(params.slug);
	if (!series) error(404, 'Series not found.');
	return json(toMobileItem(series), {
		headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' }
	});
};
