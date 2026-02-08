import { createSupabaseClient } from '$lib/server/supabaseClient';
import type { Database } from '$lib/supabase/types';
import type { ContentItem, Episode, Movie, Season, Series, Facets, VideoTrack } from '$lib/tv/types';

type MediaItemRow = Database['public']['Tables']['media_items']['Row'];
type SeriesSeasonRow = Database['public']['Tables']['series_seasons']['Row'];
type SeriesEpisodeRow = Database['public']['Tables']['series_episodes']['Row'];
type MediaRatingSummaryRow = Database['public']['Views']['media_ratings_summary']['Row'];
type VideoSongRow = Database['public']['Tables']['video_songs']['Row'];
type SongRow = Database['public']['Tables']['songs']['Row'];
type SeriesSeasonWithEpisodes = SeriesSeasonRow & { 
	series_episodes?: SeriesEpisodeRow[] | null;
};

type MediaItemWithSeasons = MediaItemRow & {
	series_seasons?: SeriesSeasonWithEpisodes[] | null;
};

type VideoSongWithSong = VideoSongRow & { song?: SongRow | null };

type MediaItemWithSeasonsAndTracks = MediaItemWithSeasons & {
	video_songs?: VideoSongWithSong[] | null;
};
type SeriesSeasonWithEpisodesForPlaylist = SeriesSeasonRow & { episodes?: SeriesEpisodeRow[] | null };

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
	// Calculate automatic facets
	const era = calculateEraFacet(row.year);

	const hasFacets = row.facet_type || 
		(row.facet_mood && row.facet_mood.length > 0) || 
		(row.facet_movement && row.facet_movement.length > 0) || 
		row.facet_environment || 
		row.facet_film_style || 
		row.facet_theme || 
		era;
	
	if (!hasFacets) {
		return undefined;
	}

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


function mapMovie(row: MediaItemWithSeasonsAndTracks, ratingSummary: MediaRatingSummaryRow | null): Movie {
	
	const tracksSource = Array.isArray((row as any).video_songs) ? ((row as any).video_songs as VideoSongWithSong[]) : [];
	const tracks: VideoTrack[] | undefined = tracksSource.length
		? tracksSource
				.filter((vs) => Boolean(vs.song))
				.sort((a, b) => {
					const aStart = typeof a.start_offset_seconds === 'number' ? a.start_offset_seconds : 0;
					const bStart = typeof b.start_offset_seconds === 'number' ? b.start_offset_seconds : 0;
					if (aStart !== bStart) return aStart - bStart;
					const aId = typeof a.id === 'number' ? a.id : 0;
					const bId = typeof b.id === 'number' ? b.id : 0;
					return aId - bId;
				})
				.map((vs) => {
					const song = vs.song as SongRow;
					return removeUndefined({
						startAtSeconds: vs.start_offset_seconds,
						startTimecode: vs.start_timecode ?? undefined,
						source: (vs.source as 'automation' | 'manual') ?? 'manual',
						importSource: (vs.import_source as any) ?? undefined,
						song: removeUndefined({
							spotifyTrackId: song.spotify_track_id,
							spotifyUrl: song.spotify_url,
							title: song.title,
							artist: song.artist,
							durationMs: song.duration_ms ?? undefined
						})
					});
				})
		: undefined;

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
		tracks,
		averageRating: ratingSummary?.average_rating ?? undefined,
		ratingCount: ratingSummary?.rating_count ?? undefined,
		facets: mapFacets(row),
		createdAt: row.created_at ?? undefined,
		updatedAt: row.updated_at ?? undefined
	});
}

function mapSeason(row: Pick<SeriesSeasonRow, 'id' | 'season_number' | 'playlist_id' | 'custom_name'>): Season {
	return removeUndefined({
		id: row.id,
		seasonNumber: row.season_number,
		playlistId: row.playlist_id ?? undefined,
		customName: row.custom_name ?? undefined
	});
}

function mapSeries(row: MediaItemWithSeasons, ratingSummary: MediaRatingSummaryRow | null): Series {
	const seasonsSource = Array.isArray(row.series_seasons) ? row.series_seasons : [];
	const seasons = seasonsSource
		.map((season) => mapSeason(season))
		.sort((a, b) => a.seasonNumber - b.seasonNumber);

	// Calculate total episode count across all seasons
	const episodeCount = seasonsSource.reduce((total, season) => {
		const episodes = season.series_episodes;
		if (Array.isArray(episodes)) {
			return total + episodes.length;
		}
		return total;
	}, 0);

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
		trakt: row.trakt ?? undefined,
		creators: row.creators && row.creators.length ? row.creators : undefined,
		starring: row.starring && row.starring.length ? row.starring : undefined,
		seasons,
		episodeCount: episodeCount > 0 ? episodeCount : undefined,
		averageRating: ratingSummary?.average_rating ?? undefined,
		ratingCount: ratingSummary?.rating_count ?? undefined,
		facets: mapFacets(row),
		createdAt: row.created_at ?? undefined,
		updatedAt: row.updated_at ?? undefined
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
					video_songs (
						*,
						song:songs!video_songs_song_id_fkey ( * )
					),
					series_seasons (
						*,
						series_episodes ( * )
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

		const rows = data as unknown as MediaItemWithSeasonsAndTracks[];
		const summaryByMediaId = new Map<number, MediaRatingSummaryRow>();

		const mediaIds = rows.map((row) => row.id);
		if (mediaIds.length) {
			const { data: ratingRows, error: ratingsError } = await supabase
				.from('media_ratings_summary')
				.select('*')
				.in('media_id', mediaIds);

			if (ratingsError) {
				console.warn('[content-service] Failed to load rating summaries:', ratingsError);
			} else if (ratingRows && ratingRows.length) {
				for (const summary of ratingRows) {
					summaryByMediaId.set(summary.media_id, summary);
				}
			}
		}
		const items: ContentItem[] = rows.map((row) => {
			const ratingSummary = summaryByMediaId.get(row.id) ?? null;
			return isSeriesRow(row) ? mapSeries(row, ratingSummary) : mapMovie(row, ratingSummary);
		});

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
				series_id,
				episodes:series_episodes (
					id,
					episode_number,
					video_id,
					title,
					description,
					published_at,
					thumbnail,
					duration
				),
				series:media_items!series_seasons_series_id_fkey (
					external_url
				)
			`
			)
		.eq('playlist_id', playlistId)
		.maybeSingle<SeriesSeasonWithEpisodesForPlaylist>();

	if (error) {
		throw new Error(`Failed to load episodes for playlist ${playlistId}: ${error.message}`);
	}

	const season = data as SeriesSeasonWithEpisodesForPlaylist | null;
	if (!season || !Array.isArray(season.episodes) || season.episodes.length === 0) {
		return [];
	}

	// Get series external_url to use for episodes without video_id
	const seriesExternalUrl = (season as any).series?.external_url ?? undefined;

	return season.episodes
		.sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0))
		.map((episode) => {
			return removeUndefined({
				id: episode.video_id ?? String(episode.id),
				title: episode.title ?? `Episode ${episode.episode_number ?? ''}`,
				description: episode.description ?? undefined,
				publishedAt: episode.published_at ?? undefined,
				thumbnail: episode.thumbnail ?? undefined,
				position: episode.episode_number ?? undefined,
				duration: episode.duration ?? undefined,
				// Only add externalUrl if episode has no video_id (for paid external content)
				externalUrl: seriesExternalUrl
			});
		});
}

export async function fetchEpisodesBySeasonId(seasonId: number): Promise<Episode[]> {
	const supabase = createSupabaseClient();
	const { data, error } = await supabase
		.from('series_seasons')
		.select(
			`
				id,
				season_number,
				series_id,
				episodes:series_episodes (
					id,
					episode_number,
					video_id,
					title,
					description,
					published_at,
					thumbnail,
					duration
				),
				series:media_items!series_seasons_series_id_fkey (
					external_url
				)
			`
			)
		.eq('id', seasonId)
		.maybeSingle<SeriesSeasonWithEpisodesForPlaylist>();

	if (error) {
		throw new Error(`Failed to load episodes for season ${seasonId}: ${error.message}`);
	}

	const season = data as SeriesSeasonWithEpisodesForPlaylist | null;
	if (!season || !Array.isArray(season.episodes) || season.episodes.length === 0) {
		return [];
	}

	// Get series external_url to use for episodes without video_id
	const seriesExternalUrl = (season as any).series?.external_url ?? undefined;

	return season.episodes
		.sort((a, b) => (a.episode_number ?? 0) - (b.episode_number ?? 0))
		.map((episode) => {
			// Check if episode has a valid video_id (not null, undefined, or empty string)
			const hasValidVideoId = episode.video_id && typeof episode.video_id === 'string' && episode.video_id.trim() !== '';
			
			return removeUndefined({
				id: episode.video_id ?? String(episode.id),
				title: episode.title ?? `Episode ${episode.episode_number ?? ''}`,
				description: episode.description ?? undefined,
				publishedAt: episode.published_at ?? undefined,
				thumbnail: episode.thumbnail ?? undefined,
				position: episode.episode_number ?? undefined,
				duration: episode.duration ?? undefined,
				// Only add externalUrl if episode has no video_id (for paid external content)
				externalUrl: hasValidVideoId ? undefined : seriesExternalUrl
			});
		});
}

function isSeriesRow(row: MediaItemWithSeasons | null | undefined): row is MediaItemWithSeasons {
	return row?.type === 'series';
}
