import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchSpots } from '$lib/server/parkourSpot';

export const GET: RequestHandler = async ({ url }) => {
	const q = url.searchParams.get('q') ?? undefined;
	const minLat = url.searchParams.get('minLat') ?? undefined;
	const maxLat = url.searchParams.get('maxLat') ?? undefined;
	const minLng = url.searchParams.get('minLng') ?? undefined;
	const maxLng = url.searchParams.get('maxLng') ?? undefined;
	const limit = url.searchParams.get('limit') ?? undefined;

	try {
		const data = await searchSpots({ q, minLat, maxLat, minLng, maxLng, limit });
		return json(data, {
			headers: {
				// Keep responses reasonably fresh without hammering upstream.
				'Cache-Control': 'public, max-age=60, s-maxage=300'
			}
		});
	} catch (err: any) {
		return json({ error: err?.message || 'Failed to search spots' }, { status: 400 });
	}
};
