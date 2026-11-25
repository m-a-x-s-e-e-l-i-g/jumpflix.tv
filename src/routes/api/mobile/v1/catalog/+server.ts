import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchAllContent, getContentServiceStatus } from '$lib/server/content-service';
import { catalogPage, parseCatalogPagination } from '$lib/server/mobile-catalog';

export const GET: RequestHandler = async ({ url }) => {
	const pagination = parseCatalogPagination(url.searchParams);
	if (!pagination) error(400, 'Use a non-negative integer offset and a limit from 1 to 200.');
	const items = await fetchAllContent();
	return json(catalogPage(items, pagination.offset, pagination.limit), {
		headers: {
			'Cache-Control': getContentServiceStatus().lastError
				? 'no-store'
				: 'public, max-age=60, s-maxage=300, stale-while-revalidate=300'
		}
	});
};
