import { error as httpError } from '@sveltejs/kit';
import { ResilientCache } from './resilient-cache';
import { createSupabaseClient } from '$lib/server/supabaseClient';
import type { Database } from '$lib/supabase/types';
import type {
	ContentItem,
	Episode,
	Movie,
	Season,
	Series,
	Facets,
	VideoTrack
} from '$lib/tv/types';

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
type SeriesSeasonWithEpisodesForPlaylist = SeriesSeasonRow & {
	episodes?: SeriesEpisodeRow[] | null;
};

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
	const rowExplicit = Boolean((row as any).explicit);
	const warningSet = new Set<string>(
		Array.isArray(row.content_warnings) ? row.content_warnings.map((w) => String(w)) : []
	);
	if (rowExplicit) warningSet.add('strong-language');
	const normalizedWarnings = warningSet.size ? Array.from(warningSet) : null;

	// Calculate automatic facets
	const era = calculateEraFacet(row.year);
	const length = calculateLengthFacet(row.duration);

	const hasFacets =
		row.facet_type ||
		(row.facet_movement && row.facet_movement.length > 0) ||
		row.facet_environment ||
		row.facet_focus ||
		row.facet_production ||
		row.facet_presentation ||
		(normalizedWarnings && normalizedWarnings.length > 0) ||
		row.facet_medium ||
		era ||
		length;

	if (!hasFacets) {
		return undefined;
	}

	return removeUndefined({
		type: row.facet_type ?? undefined,
		focus: row.facet_focus ?? undefined,
		movement:
			row.facet_movement && row.facet_movement.length > 0 ? (row.facet_movement as any) : undefined,
		environment: row.facet_environment ?? undefined,
		production: row.facet_production ?? undefined,
		presentation: row.facet_presentation ?? undefined,
		contentWarnings: normalizedWarnings ? (normalizedWarnings as any) : undefined,
		medium: row.facet_medium ?? undefined,
		era: era ?? undefined,
		length: length ?? undefined
	});
}

// Calculate era facet from year string
function calculateEraFacet(
	year: string | null
): '2000s' | '2010s' | '2020s' | '2030s' | 'pre-2000' | null {
	if (!year || !/^\d{4}$/.test(year)) return null;

	const yearNum = parseInt(year);
	if (yearNum >= 2030) return '2030s';
	if (yearNum >= 2020) return '2020s';
	if (yearNum >= 2010) return '2010s';
	if (yearNum >= 2000) return '2000s';
	return 'pre-2000';
}

// Calculate length facet from duration string
// Duration format examples: "5m", "1h 12m", "40m", "2h"
function calculateLengthFacet(
	duration: string | null
): 'short-form' | 'medium-form' | 'long-form' | null {
	if (!duration || typeof duration !== 'string') return null;

	let minutes = 0;
	const hMatch = duration.match(/(\d+)\s*h/i);
	const mMatch = duration.match(/(\d+)\s*m/i);

	if (hMatch) minutes += parseInt(hMatch[1]) * 60;
	if (mMatch) minutes += parseInt(mMatch[1]);

	if (minutes === 0) return null;

	// Short-form: under 15 minutes (typical for shorts, clips, trailers)
	// Medium-form: 15-45 minutes (typical for session edits, short films)
	// Long-form: 45+ minutes (typical for feature films, documentaries)
	if (minutes < 15) return 'short-form';
	if (minutes < 45) return 'medium-form';
	return 'long-form';
}

function mapMovie(
	row: MediaItemWithSeasonsAndTracks,
	ratingSummary: MediaRatingSummaryRow | null
): Movie {
	const tracksSource = Array.isArray((row as any).video_songs)
		? ((row as any).video_songs as VideoSongWithSong[])
		: [];
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
							id: song.id,
							spotifyTrackId: song.spotify_track_id ?? undefined,
							spotifyUrl: song.spotify_url ?? undefined,
							title: song.title,
							artist: song.artist,
							durationMs: song.duration_ms ?? undefined,
							explicit:
								typeof (song as any).explicit === 'boolean' ? (song as any).explicit : undefined
						})
					});
				})
		: undefined;

	return removeUndefined({
		id: row.id,
		slug: row.slug,
		type: 'movie' as const,
		title: row.title,
		availabilityStatus: row.availability_status,
		description: row.description ?? undefined,
		thumbnail: row.thumbnail ?? undefined,
		blurhash: row.blurhash ?? undefined,
		paid: row.paid ?? undefined,
		provider: row.provider ?? undefined,
		externalUrl: row.external_url ?? undefined,
		streamUrl: row.stream_url ?? undefined,
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
		explicit: typeof (row as any).explicit === 'boolean' ? (row as any).explicit : undefined,
		facets: mapFacets(row),
		createdAt: row.created_at ?? undefined,
		updatedAt: row.updated_at ?? undefined
	});
}

function mapSeason(
	row: Pick<SeriesSeasonRow, 'id' | 'season_number' | 'playlist_id' | 'custom_name'>
): Season {
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
		availabilityStatus: row.availability_status,
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
		explicit: typeof (row as any).explicit === 'boolean' ? (row as any).explicit : undefined,
		facets: mapFacets(row),
		createdAt: row.created_at ?? undefined,
		updatedAt: row.updated_at ?? undefined
	});
}

const contentCache = new ResilientCache<ContentItem[]>();

export function getContentServiceStatus(): {
	lastError: string | null;
	cachedItemCount: number;
	cacheFetchedAt: string | null;
} {
	return {
		lastError: contentCache.lastError,
		cachedItemCount: contentCache.value?.length ?? 0,
		cacheFetchedAt:
			Number.isFinite(contentCache.fetchedAt) && contentCache.value
				? new Date(contentCache.fetchedAt).toISOString()
				: null
	};
}

export async function invalidateContentCache(): Promise<void> {
	contentCache.invalidate();
}

export async function fetchAllContent(options: { maxAgeMs?: number } = {}): Promise<ContentItem[]> {
	try {
		return await contentCache.get(async () => {
			const supabase = createSupabaseClient();
			const { data, error } = await supabase.from('media_items').select(
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

			if (error) throw new Error(error.message);
			if (!data) throw new Error('Catalog query returned no data');

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

			const sorted = items.sort((a, b) => a.title.localeCompare(b.title));
			return sorted;
		}, options.maxAgeMs);
	} catch {
		httpError(503, 'Catalog temporarily unavailable. Please try again shortly.');
	}
}

export async function fetchMovieBySlug(slug: string): Promise<Movie | null> {
	const trimmedSlug = slug.trim();
	if (!trimmedSlug) return null;

	const supabase = createSupabaseClient();
	const { data, error } = await supabase
		.from('media_items')
		.select(
			`
				*,
				video_songs (
					*,
					song:songs!video_songs_song_id_fkey ( * )
				)
			`
		)
		.eq('type', 'movie')
		.eq('slug', trimmedSlug)
		.maybeSingle();

	if (error) {
		throw new Error(`Failed to load movie ${trimmedSlug}: ${error.message}`);
	}

	if (!data) return null;

	const row = data as unknown as MediaItemWithSeasonsAndTracks;
	const { data: ratingSummary } = await supabase
		.from('media_ratings_summary')
		.select('*')
		.eq('media_id', row.id)
		.maybeSingle<MediaRatingSummaryRow>();

	return mapMovie(row, ratingSummary ?? null);
}

export async function fetchSeriesBySlug(slug: string): Promise<Series | null> {
	const supabase = createSupabaseClient();
	const { data, error } = await supabase
		.from('media_items')
		.select('*, series_seasons (*, series_episodes (*))')
		.eq('type', 'series')
		.eq('slug', slug)
		.maybeSingle();
	if (error) throw new Error(`Failed to load series ${slug}: ${error.message}`);
	if (!data) return null;
	const { data: ratingSummary } = await supabase
		.from('media_ratings_summary')
		.select('*')
		.eq('media_id', data.id)
		.maybeSingle<MediaRatingSummaryRow>();
	const row = data as unknown as MediaItemWithSeasons;
	const series = mapSeries(row, ratingSummary ?? null);
	// The series' own episodes belong on its detail page, including during SSR.
	for (const season of series.seasons) {
		const source = row.series_seasons?.find((entry) => entry.id === season.id);
		season.episodes = (source?.series_episodes ?? [])
			.slice()
			.sort((a, b) => a.episode_number - b.episode_number)
			.map((episode) =>
				removeUndefined({
					id: episode.video_id ?? String(episode.id),
					title: episode.title ?? `Episode ${episode.episode_number}`,
					description: episode.description ?? undefined,
					publishedAt: episode.published_at ?? undefined,
					thumbnail: episode.thumbnail ?? undefined,
					position: episode.episode_number,
					duration: episode.duration ?? undefined,
					externalUrl: episode.video_id?.trim() ? undefined : series.externalUrl
				})
			);
	}
	return series;
}

/** A bounded recommendation query; never load the entire catalog on a detail request. */
export async function fetchRelatedContent(item: ContentItem): Promise<ContentItem[]> {
	if (!item.facets?.type) return [];
	try {
		const { data, error } = await createSupabaseClient()
			.from('media_items')
			.select('id, slug, title, type, year')
			.eq('facet_type', item.facets.type)
			.neq('id', Number(item.id))
			.order('updated_at', { ascending: false })
			.limit(4);
		if (error) return [];
		return (data ?? [])
			.filter((row) => row.slug)
			.map((row) =>
				row.type === 'series'
					? { id: row.id, slug: row.slug!, title: row.title, type: 'series', seasons: [] }
					: {
							id: row.id,
							slug: row.slug!,
							title: row.title,
							type: 'movie',
							year: row.year ?? undefined
						}
			);
	} catch {
		return []; // Recommendations must not prevent the film or episode from loading.
	}
}

export type SeriesEpisodeEntry = {
	slug: string;
	seasonNumber: number;
	episodeNumber: number;
	updatedAt?: string;
};

export async function fetchSeriesEpisodeEntries(): Promise<SeriesEpisodeEntry[]> {
	try {
		const supabase = createSupabaseClient();
		const { data, error } = await supabase.from('series_episodes').select(
			`
					episode_number,
					updated_at,
					season:series_seasons (
						season_number,
						series:media_items ( slug, type )
					)
				`
		);

		if (error) {
			console.error('[content-service] Failed to load series episodes:', error);
			throw new Error(error.message);
		}

		const entries: SeriesEpisodeEntry[] = [];
		for (const row of (data ?? []) as any[]) {
			const episodeNumber = Number(row.episode_number);
			const seasonNumber = Number(row?.season?.season_number);
			const slug = row?.season?.series?.slug;
			const type = row?.season?.series?.type;
			if (type !== 'series' || !slug) continue;
			if (!Number.isSafeInteger(episodeNumber) || episodeNumber < 1) continue;
			if (!Number.isSafeInteger(seasonNumber) || seasonNumber < 1) continue;
			entries.push({
				slug,
				seasonNumber: Math.floor(seasonNumber),
				episodeNumber,
				updatedAt: row.updated_at ?? undefined
			});
		}

		return entries;
	} catch (err) {
		console.error('[content-service] Unexpected error loading episodes:', err);
		throw err;
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
			const hasValidVideoId =
				episode.video_id && typeof episode.video_id === 'string' && episode.video_id.trim() !== '';

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
