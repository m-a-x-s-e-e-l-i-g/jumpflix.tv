import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateBearerToken } from '$lib/server/bearerAuth';
import { createSupabaseClient } from '$lib/server/supabaseClient';

/**
 * GET /api/v1/videos/[id]
 *
 * Returns full metadata for a JumpFlix video by its numeric database ID,
 * including all approved spot chapters associated with it.
 *
 * Path parameter:
 *   - id – the numeric JumpFlix media item ID
 *
 * Response: {
 *   id: number,
 *   slug: string,
 *   type: "movie" | "series",
 *   title: string,
 *   description?: string,
 *   thumbnail?: string,
 *   year?: string,
 *   duration?: string,
 *   creators?: string[],
 *   starring?: string[],
 *   onTv: boolean,
 *   facets?: object,
 *   url: string,
 *   spots: Array<{ spotId: string; startSeconds: number; endSeconds: number; playbackKey?: string }>
 * }
 *
 * Authentication: Bearer token required (PARKOUR_SPOT_BEARER_TOKEN).
 */
export const GET: RequestHandler = async ({ params, request }) => {
	if (!validateBearerToken(request.headers.get('Authorization'))) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const mediaId = Number(params.id);
	if (!Number.isFinite(mediaId) || mediaId <= 0 || !Number.isInteger(mediaId)) {
		return json({ error: 'Invalid id: must be a positive integer' }, { status: 400 });
	}

	try {
		const supabase = createSupabaseClient();

		// Fetch the media item
		const { data: mediaItem, error: mediaError } = await supabase
			.from('media_items')
			.select(
				'id, slug, type, title, description, thumbnail, year, duration, creators, starring, on_tv, facet_type, facet_mood, facet_movement, facet_environment, facet_film_style, facet_theme'
			)
			.eq('id', mediaId)
			.maybeSingle();

		if (mediaError) {
			return json({ error: mediaError.message || 'Failed to load media item' }, { status: 500 });
		}
		if (!mediaItem) {
			return json({ error: 'Not found' }, { status: 404 });
		}

		// Fetch all approved spot chapters for this media item.
		// The spot_chapters table only contains admin-approved chapters, so no approval filter is needed.
		const { data: chapters, error: chaptersError } = await supabase
			.from('spot_chapters')
			.select('spot_id, start_seconds, end_seconds, playback_key')
			.eq('media_id', mediaId)
			.order('start_seconds', { ascending: true });

		const spotChapters: {
			spotId: string;
			startSeconds: number;
			endSeconds: number;
			playbackKey?: string;
		}[] = [];

		if (!chaptersError && Array.isArray(chapters)) {
			for (const row of chapters) {
				const spotId = String(row.spot_id ?? '').trim();
				const startSeconds = Number(row.start_seconds);
				const endSeconds = Number(row.end_seconds);
				if (!spotId || !Number.isFinite(startSeconds) || !Number.isFinite(endSeconds)) continue;

				const entry: {
					spotId: string;
					startSeconds: number;
					endSeconds: number;
					playbackKey?: string;
				} = {
					spotId,
					startSeconds,
					endSeconds
				};

				const playbackKey = String(row.playback_key ?? '').trim();
				if (playbackKey) entry.playbackKey = playbackKey;

				spotChapters.push(entry);
			}
		}

		// Build facets object (omit undefined/null values)
		const facets: Record<string, unknown> = {};
		if (mediaItem.facet_type) facets.type = mediaItem.facet_type;
		if (mediaItem.facet_mood?.length) facets.mood = mediaItem.facet_mood;
		if (mediaItem.facet_movement?.length) facets.movement = mediaItem.facet_movement;
		if (mediaItem.facet_environment) facets.environment = mediaItem.facet_environment;
		if (mediaItem.facet_film_style) facets.filmStyle = mediaItem.facet_film_style;
		if (mediaItem.facet_theme) facets.theme = mediaItem.facet_theme;

		const videoUrl =
			mediaItem.type === 'series'
				? `https://www.jumpflix.tv/series/${mediaItem.slug}`
				: `https://www.jumpflix.tv/movie/${mediaItem.slug}`;

		const response: Record<string, unknown> = {
			id: mediaItem.id,
			slug: mediaItem.slug,
			type: mediaItem.type,
			title: mediaItem.title,
			onTv: mediaItem.on_tv ?? false,
			url: videoUrl,
			spots: spotChapters
		};

		if (mediaItem.description) response.description = mediaItem.description;
		if (mediaItem.thumbnail) response.thumbnail = mediaItem.thumbnail;
		if (mediaItem.year) response.year = mediaItem.year;
		if (mediaItem.duration) response.duration = mediaItem.duration;
		if (mediaItem.creators?.length) response.creators = mediaItem.creators;
		if (mediaItem.starring?.length) response.starring = mediaItem.starring;
		if (Object.keys(facets).length) response.facets = facets;

		return json(response, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, { status: 500 });
	}
};
