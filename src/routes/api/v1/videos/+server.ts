import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateBearerToken } from '$lib/server/bearerAuth';
import { createSupabaseClient } from '$lib/server/supabaseClient';

/**
 * GET /api/v1/videos
 *
 * Returns a mapping of JumpFlix video IDs to parkour spot IDs.
 *
 * Query parameters:
 *   - spotId  (optional) – filter to videos that feature this spot ID
 *   - onTv    (optional, "true") – filter to videos that have been broadcast on TV
 *
 * Response: { videos: Array<{ jumpflixId: number; spotIds: string[] }> }
 *
 * Authentication: Bearer token required (PARKOUR_SPOT_BEARER_TOKEN).
 */
export const GET: RequestHandler = async ({ url, request }) => {
	if (!validateBearerToken(request.headers.get('Authorization'))) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const spotIdFilter = url.searchParams.get('spotId')?.trim() || null;
	const onTvFilter = url.searchParams.get('onTv') === 'true';

	try {
		const supabase = createSupabaseClient();

		// Build spot_chapters query.
		// The spot_chapters table only contains admin-approved chapters, so no approval filter is needed.
		let chaptersQuery = supabase.from('spot_chapters').select('media_id, spot_id');

		if (spotIdFilter) {
			chaptersQuery = chaptersQuery.eq('spot_id', spotIdFilter);
		}

		const { data: chapters, error: chaptersError } = await chaptersQuery;

		if (chaptersError) {
			const msg = String(chaptersError.message ?? '').toLowerCase();
			if (
				msg.includes('spot_chapters') &&
				(msg.includes('does not exist') || msg.includes('relation'))
			) {
				return json(
					{ videos: [] },
					{ headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }
				);
			}
			return json(
				{ error: chaptersError.message || 'Failed to load spot chapters' },
				{ status: 500 }
			);
		}

		const rows = Array.isArray(chapters)
			? (chapters as { media_id: number; spot_id: string }[])
			: [];

		// Group spot IDs by media ID
		const spotsByMediaId = new Map<number, Set<string>>();
		for (const row of rows) {
			const mediaId = Number(row.media_id);
			const spotId = String(row.spot_id ?? '').trim();
			if (!Number.isFinite(mediaId) || !spotId) continue;
			if (!spotsByMediaId.has(mediaId)) spotsByMediaId.set(mediaId, new Set());
			spotsByMediaId.get(mediaId)!.add(spotId);
		}

		if (spotsByMediaId.size === 0) {
			return json(
				{ videos: [] },
				{ headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } }
			);
		}

		// Apply onTv filter: fetch media_items for the matched IDs and check on_tv flag
		const mediaIds = Array.from(spotsByMediaId.keys());
		let filteredMediaIds = mediaIds;

		if (onTvFilter) {
			const { data: mediaRows, error: mediaError } = await supabase
				.from('media_items')
				.select('id')
				.in('id', mediaIds)
				.eq('on_tv', true);

			if (mediaError) {
				return json({ error: mediaError.message || 'Failed to load media items' }, { status: 500 });
			}

			filteredMediaIds = (mediaRows ?? []).map((r) => Number(r.id));
		}

		const videos = filteredMediaIds
			.filter((id) => spotsByMediaId.has(id))
			.map((id) => ({
				jumpflixId: id,
				spotIds: Array.from(spotsByMediaId.get(id)!)
			}));

		return json({ videos }, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, { status: 500 });
	}
};
