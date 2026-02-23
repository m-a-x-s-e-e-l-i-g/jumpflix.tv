import type { RequestHandler } from './$types';
import { asVtt, hydrateSpotInfo, loadApprovedSpotChapters } from '$lib/server/spotChapters';

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

	if (!mediaId || (mediaType !== 'movie' && mediaType !== 'series')) {
		return new Response('WEBVTT\n\n', {
			status: 400,
			headers: {
				'content-type': 'text/vtt; charset=utf-8',
				'Cache-Control': 'no-store'
			}
		});
	}

	try {
		const chapters = await loadApprovedSpotChapters({ mediaId, mediaType, playbackKey });
		const withSpots = await hydrateSpotInfo(chapters);
		const vtt = asVtt(withSpots);
		return new Response(vtt, {
			headers: {
				'content-type': 'text/vtt; charset=utf-8',
				'Cache-Control': 'public, max-age=300, s-maxage=3600'
			}
		});
	} catch {
		return new Response('WEBVTT\n\n', {
			status: 200,
			headers: {
				'content-type': 'text/vtt; charset=utf-8',
				'Cache-Control': 'public, max-age=60, s-maxage=300'
			}
		});
	}
};
