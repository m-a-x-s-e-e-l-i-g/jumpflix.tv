import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { validateBearerToken } from '$lib/server/bearerAuth';
import { resolveSpotIds } from '$lib/server/parkourSpot';
import { canonicalizeSpotChapterRows, collectSpotCountries, hydrateSpotInfo, type SpotCountry } from '$lib/server/spotChapters';
import { createSupabaseClient } from '$lib/server/supabaseClient';
import { normalizeParkourSpotId } from '$lib/utils';

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
 *   facets?: object,
 *   countries?: Array<{ code?: string; name?: string }>,
 *   url: string,
 *   spots: Array<{ spotId: string; startSeconds: number; endSeconds: number; playbackKey?: string; countries?: Array<{ code?: string; name?: string }> }>
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
				'id, slug, type, title, description, thumbnail, year, duration, creators, starring, facet_type, facet_mood, facet_movement, facet_environment, facet_film_style, facet_theme'
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
			.select('id, spot_id, start_seconds, end_seconds, playback_key')
			.eq('media_id', mediaId)
			.order('start_seconds', { ascending: true });

		const spotChapters: {
			spotId: string;
			startSeconds: number;
			endSeconds: number;
			playbackKey?: string;
			countries?: SpotCountry[];
		}[] = [];

		if (!chaptersError && Array.isArray(chapters)) {
			const canonicalSpotIdsByRow = await canonicalizeSpotChapterRows(
				chapters.map((row) => ({
					id: Number(row.id),
					media_id: mediaId,
					media_type: mediaItem.type,
					playback_key: String(row.playback_key ?? '').trim(),
					spot_id: String(row.spot_id ?? ''),
					start_seconds: Number(row.start_seconds),
					end_seconds: Number(row.end_seconds)
				}))
			);
			const canonicalSpotIdsByOriginal = await resolveSpotIds(
				chapters.map((row) => String(row.spot_id ?? '').trim()).filter(Boolean)
			);

			for (const row of chapters) {
				const originalSpotId = normalizeParkourSpotId(row.spot_id) ?? String(row.spot_id ?? '').trim();
				const spotId =
					canonicalSpotIdsByRow.get(Number(row.id)) ??
					canonicalSpotIdsByOriginal.get(originalSpotId) ??
					originalSpotId;
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

		const hydratedSpotChapters = await hydrateSpotInfo(
			spotChapters.map((chapter, index) => ({
				suggestionId: -(index + 1),
				spotId: chapter.spotId,
				startSeconds: chapter.startSeconds,
				endSeconds: chapter.endSeconds,
				playbackKey: chapter.playbackKey ?? null,
				startTimecode: null,
				endTimecode: null,
				note: null,
				spot: null
			}))
		);

		const spotCountriesById = new Map<string, SpotCountry[]>();
		for (const chapter of hydratedSpotChapters) {
			spotCountriesById.set(chapter.spotId, chapter.spot?.countries ?? []);
		}
		const countries = collectSpotCountries(hydratedSpotChapters.map((chapter) => chapter.spot));
		const spots = spotChapters.map((chapter) => ({
			...chapter,
			...(spotCountriesById.get(chapter.spotId)?.length
				? { countries: spotCountriesById.get(chapter.spotId) }
				: {})
		}));

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

		const thumbnailUrl = (() => {
			const raw = String(mediaItem.thumbnail ?? '').trim();
			if (!raw) return null;
			if (raw.startsWith('http://') || raw.startsWith('https://')) return raw;
			if (raw.startsWith('/')) return `https://www.jumpflix.tv${raw}`;
			return raw;
		})();

		const response: Record<string, unknown> = {
			id: mediaItem.id,
			slug: mediaItem.slug,
			type: mediaItem.type,
			title: mediaItem.title,
			url: videoUrl,
			spots
		};

		if (mediaItem.description) response.description = mediaItem.description;
		if (thumbnailUrl) response.thumbnail = thumbnailUrl;
		if (mediaItem.year) response.year = mediaItem.year;
		if (mediaItem.duration) response.duration = mediaItem.duration;
		if (mediaItem.creators?.length) response.creators = mediaItem.creators;
		if (mediaItem.starring?.length) response.starring = mediaItem.starring;
		if (Object.keys(facets).length) response.facets = facets;
		if (countries.length) response.countries = countries;

		return json(response, { headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' } });
	} catch (err: unknown) {
		const message = err instanceof Error ? err.message : 'Internal server error';
		return json({ error: message }, { status: 500 });
	}
};
