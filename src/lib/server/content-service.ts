import { createSupabaseClient } from '$lib/server/supabaseClient';
import type { Database } from '$lib/supabase/types';
import type { ContentItem, Episode, Movie, Season, Series } from '$lib/tv/types';

type MediaItemRow = Database['public']['Tables']['media_items']['Row'];
type SeriesSeasonRow = Database['public']['Tables']['series_seasons']['Row'];
type SeriesEpisodeRow = Database['public']['Tables']['series_episodes']['Row'];
type MediaItemWithSeasons = MediaItemRow & { series_seasons?: SeriesSeasonRow[] | null };
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

function mapMovie(row: MediaItemRow): Movie {
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
		starring: row.starring && row.starring.length ? row.starring : undefined
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
		seasons
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
