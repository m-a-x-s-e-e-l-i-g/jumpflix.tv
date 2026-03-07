import type { RequestHandler } from './$types';
import { asVtt, hydrateSpotInfo, loadApprovedSpotChapters } from '$lib/server/spotChapters';
import { asSafeInt } from '$lib/utils';

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
		// Important: do not cache an empty VTT when the backend temporarily fails.
		// Otherwise CDNs/browsers can cache the "no chapters" response and chapters appear to
		// randomly disappear for a while.
		return new Response('WEBVTT\n\n', {
			status: 503,
			headers: {
				'content-type': 'text/vtt; charset=utf-8',
				'Cache-Control': 'no-store',
				'Retry-After': '5'
			}
		});
	}
};
