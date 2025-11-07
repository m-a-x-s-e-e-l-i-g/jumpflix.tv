import { createSupabaseClient } from '$lib/server/supabaseClient';
import type { Database } from '$lib/supabase/types';
import type { ContentItem, Episode, Movie, Season, Series, Facets } from '$lib/tv/types';

type MediaItemRow = Database['public']['Tables']['media_items']['Row'];
type SeriesSeasonRow = Database['public']['Tables']['series_seasons']['Row'];
type SeriesEpisodeRow = Database['public']['Tables']['series_episodes']['Row'];
type MediaRatingSummaryRow = Database['public']['Views']['media_ratings_summary']['Row'];
type MediaItemWithSeasons = MediaItemRow & { 
	series_seasons?: SeriesSeasonRow[] | null;
	media_ratings_summary?: MediaRatingSummaryRow[] | null;
};
type SeriesSeasonWithEpisodes = SeriesSeasonRow & { episodes?: SeriesEpisodeRow[] | null };

// Helper to remove undefined values for SvelteKit serialization
function removeUndefined<T extends Record<string, any>>(obj: T): T {
	const result: any = {};
	for (const [key, value] of Object.entries(obj)) {
		if (value !== undefined) {
			result[key] = value;
		}
	}
	return result as T;
}

// Helper to map facets from database row
function mapFacets(row: MediaItemRow): Facets | undefined {
	const hasFacets = row.facet_type || 
		(row.facet_mood && row.facet_mood.length > 0) || 
		(row.facet_movement && row.facet_movement.length > 0) || 
		row.facet_environment || 
		row.facet_film_style || 
		row.facet_theme;
	
	if (!hasFacets) {
		return undefined;
	}

	// Calculate automatic facets
	const era = calculateEraFacet(row.year);

	return removeUndefined({
		type: row.facet_type ?? undefined,
		mood: row.facet_mood && row.facet_mood.length > 0 ? row.facet_mood as any : undefined,
		movement: row.facet_movement && row.facet_movement.length > 0 ? row.facet_movement as any : undefined,
		environment: row.facet_environment ?? undefined,
		filmStyle: row.facet_film_style ?? undefined,
		theme: row.facet_theme ?? undefined,
		era: era ?? undefined
	});
}

// Calculate era facet from year string
function calculateEraFacet(year: string | null): '2000s' | '2010s' | '2020s' | '2030s' | 'pre-2000' | null {
	if (!year || !/^\d{4}$/.test(year)) return null;
	
	const yearNum = parseInt(year);
	if (yearNum >= 2030) return '2030s';
	if (yearNum >= 2020) return '2020s';
	if (yearNum >= 2010) return '2010s';
	if (yearNum >= 2000) return '2000s';
	return 'pre-2000';
}

function mapMovie(row: MediaItemWithSeasons): Movie {
	const ratingSummary = Array.isArray(row.media_ratings_summary) && row.media_ratings_summary.length > 0
		? row.media_ratings_summary[0]
		: null;
	
	return removeUndefined({
		id: row.id,
		slug: row.slug,
		type: 'movie' as const,
		title: row.title,
		description: row.description ?? undefined,
		thumbnail: row.thumbnail ?? undefined,
		blurhash: row.blurhash ?? undefined,
		paid: row.paid ?? undefined,
		provider: row.provider ?? undefined,
		externalUrl: row.external_url ?? undefined,
		year: row.year ?? undefined,
		duration: row.duration ?? undefined,
		videoId: row.video_id ?? undefined,
		vimeoId: row.vimeo_id ?? undefined,
		trakt: row.trakt ?? undefined,
		creators: row.creators && row.creators.length ? row.creators : undefined,
		starring: row.starring && row.starring.length ? row.starring : undefined,
		averageRating: ratingSummary?.average_rating ?? undefined,
		ratingCount: ratingSummary?.rating_count ?? undefined,
		facets: mapFacets(row)
	});
}

function mapSeason(row: SeriesSeasonRow): Season {
	return removeUndefined({
		seasonNumber: row.season_number,
		playlistId: row.playlist_id ?? undefined
	});
}

function mapSeries(row: MediaItemWithSeasons): Series {
	const seasonsSource = Array.isArray(row.series_seasons) ? row.series_seasons : [];
	const seasons = seasonsSource
		.map((season) => mapSeason(season))
		.sort((a, b) => a.seasonNumber - b.seasonNumber);

	const ratingSummary = Array.isArray(row.media_ratings_summary) && row.media_ratings_summary.length > 0
		? row.media_ratings_summary[0]
		: null;

	return removeUndefined({
		id: row.id,
		slug: row.slug,
		type: 'series' as const,
		title: row.title,
		description: row.description ?? undefined,
		thumbnail: row.thumbnail ?? undefined,
		blurhash: row.blurhash ?? undefined,
		paid: row.paid ?? undefined,
		provider: row.provider ?? undefined,
		externalUrl: row.external_url ?? undefined,
		creators: row.creators && row.creators.length ? row.creators : undefined,
		starring: row.starring && row.starring.length ? row.starring : undefined,
		videoCount: row.video_count ?? undefined,
		seasons,
		averageRating: ratingSummary?.average_rating ?? undefined,
		ratingCount: ratingSummary?.rating_count ?? undefined,
		facets: mapFacets(row)
	});
}

export async function fetchAllContent(): Promise<ContentItem[]> {
	try {
		const supabase = createSupabaseClient();
		const { data, error } = await supabase
			.from('media_items')
			.select(
				`
					*,
					series_seasons (
						id,
						series_id,
						season_number,
						playlist_id
					),
					media_ratings_summary (
						average_rating,
						rating_count
					)
				`
				);

		if (error) {
			console.error('[content-service] Failed to load media items:', error);
			return [];
		}

		if (!data) {
			return [];
		}

		const rows = data as MediaItemWithSeasons[];
		const items: ContentItem[] = rows.map((row) =>
			isSeriesRow(row) ? mapSeries(row) : mapMovie(row)
		);

		return items.sort((a, b) => a.title.localeCompare(b.title));
	} catch (err) {
		console.error('[content-service] Unexpected error:', err);
		return [];
	}
}

export async function fetchEpisodesByPlaylist(playlistId: string): Promise<Episode[]> {
	const supabase = createSupabaseClient();
	const { data, error } = await supabase
		.from('series_seasons')
		.select(
			`
				id,
				season_number,
				episodes:series_episodes (
					id,
					episode_number,
					video_id,
					title,
					description,
					published_at,
					thumbnail,
					duration
				)
			`
			)
		.eq('playlist_id', playlistId)
		.maybeSingle<SeriesSeasonWithEpisodes>();

	if (error) {
		throw new Error(`Failed to load episodes for playlist ${playlistId}: ${error.message}`);
	}

	const season = data as SeriesSeasonWithEpisodes | null;
	if (!season || !Array.isArray(season.episodes) || season.episodes.length === 0) {
		return [];
	}

	return season.episodes
		.sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0))
		.map((episode) => removeUndefined({
			id: episode.video_id ?? String(episode.id),
			title: episode.title ?? `Episode ${episode.episode_number ?? ''}`,
			description: episode.description ?? undefined,
			publishedAt: episode.published_at ?? undefined,
			thumbnail: episode.thumbnail ?? undefined,
			position: episode.episode_number ?? undefined,
			duration: episode.duration ?? undefined
		}));
}

function isSeriesRow(row: MediaItemWithSeasons | null | undefined): row is MediaItemWithSeasons {
	return row?.type === 'series';
}
