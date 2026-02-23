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
 *   - type    (optional, "movie" | "series") – filter to only films (movie) or series
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
	const typeParam = url.searchParams.get('type')?.trim().toLowerCase() || null;
	const typeFilter =
		typeParam === 'movie' || typeParam === 'film' ? 'movie' : typeParam === 'series' ? 'series' : null;
	if (typeParam && !typeFilter) {
		return json({ error: 'Invalid type: must be "movie" or "series"' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseClient();

		// Build spot_chapters query.
		// The spot_chapters table only contains admin-approved chapters, so no approval filter is needed.
		let chaptersQuery = supabase.from('spot_chapters').select('media_id, spot_id, media_type');

		if (spotIdFilter) {
			chaptersQuery = chaptersQuery.eq('spot_id', spotIdFilter);
		}
		if (typeFilter) {
			chaptersQuery = chaptersQuery.eq('media_type', typeFilter);
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
			? (chapters as { media_id: number; spot_id: string; media_type: 'movie' | 'series' }[])
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

		const videos = Array.from(spotsByMediaId.keys())
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
