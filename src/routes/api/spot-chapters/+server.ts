import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hydrateSpotInfo, loadApprovedSpotChapters } from '$lib/server/spotChapters';

function asSafeInt(value: string | null): number | null {
	if (!value) return null;
	const n = Number(value);
	if (!Number.isFinite(n)) return null;
	const i = Math.floor(n);
	return i > 0 ? i : null;
}

export const GET: RequestHandler = async ({ url }) => {
	const mediaId = asSafeInt(url.searchParams.get('mediaId'));
	const mediaType = (url.searchParams.get('mediaType') ?? '').trim();
	const playbackKey = (url.searchParams.get('playbackKey') ?? '').trim() || null;

	if (!mediaId) return json({ error: 'mediaId is required' }, { status: 400 });
	if (mediaType !== 'movie' && mediaType !== 'series') {
		return json({ error: 'mediaType must be movie or series' }, { status: 400 });
	}

	try {
		const chapters = await loadApprovedSpotChapters({
			mediaId,
			mediaType,
			playbackKey
		});
		const withSpots = await hydrateSpotInfo(chapters);
		return json(
			{ chapters: withSpots },
			{ headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }
		);
	} catch (err: any) {
		return json({ error: err?.message || 'Failed to load spot chapters' }, { status: 400 });
	}
};
