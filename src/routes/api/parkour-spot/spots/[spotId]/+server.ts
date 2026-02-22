import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { fetchSpotById } from '$lib/server/parkourSpot';

export const GET: RequestHandler = async ({ params }) => {
	try {
		const data = await fetchSpotById(params.spotId);
		return json(data, {
			headers: {
				'Cache-Control': 'public, max-age=300, s-maxage=3600'
			}
		});
	} catch (err: any) {
		return json({ error: err?.message || 'Failed to fetch spot' }, { status: 400 });
	}
};
