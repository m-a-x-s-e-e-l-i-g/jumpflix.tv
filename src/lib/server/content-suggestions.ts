import { parseTimecodeToSeconds } from '$lib/utils/timecode';
import type { createSupabaseServiceClient } from '$lib/server/supabaseClient';

function uniqStrings(values: string[]): string[] {
	const out: string[] = [];
	const seen = new Set<string>();
	for (const raw of values) {
		const v = (raw ?? '').trim();
		if (!v) continue;
		const key = v.toLowerCase();
		if (seen.has(key)) continue;
		seen.add(key);
		out.push(v);
	}
	return out;
}

function applyArrayOps(current: string[] | null, add?: unknown, remove?: unknown): string[] {
	const base = Array.isArray(current) ? current.map((v) => String(v)) : [];
	const addList = Array.isArray(add) ? add.map((v) => String(v)) : [];
	const removeList = Array.isArray(remove) ? remove.map((v) => String(v)) : [];

	const removed = new Set(removeList.map((v) => v.trim().toLowerCase()).filter(Boolean));
	const filtered = base.filter((v) => !removed.has(v.trim().toLowerCase()));
	return uniqStrings([...filtered, ...addList]);
}

function extractSpotifyTrackId(urlOrId: string): string | null {
	const input = (urlOrId ?? '').trim();
	if (!input) return null;
	// Allow raw ID
	if (/^[A-Za-z0-9]{10,}$/.test(input) && !input.includes('/')) return input;
	const match = input.match(/spotify\.com\/track\/([A-Za-z0-9]+)/i);
	return match?.[1] ?? null;
}

export type MediaPatch = {
	set?: Record<string, any>;
	add?: Record<string, any>;
	remove?: Record<string, any>;
	track?: {
		action?: 'add' | 'remove';
		spotifyUrl?: string;
		spotifyTrackId?: string;
		title?: string;
		artist?: string;
		startTimecode?: string;
		startAtSeconds?: number;
		position?: number;
	};
	tracks_add?: any[];
	tracks_remove?: any[];
	season?: any;
	episode?: any;
};

export async function applyMediaPatch(
	supabase: ReturnType<typeof createSupabaseServiceClient>,
	mediaId: number,
	patch: MediaPatch
) {
	const { data: media, error: mediaError } = await supabase
		.from('media_items')
		.select(
			'id, type, description, creators, starring, facet_mood, facet_movement, facet_type, facet_environment, facet_film_style, facet_theme, thumbnail, paid, provider, external_url'
		)
		.eq('id', mediaId)
		.maybeSingle();

	if (mediaError) throw new Error(mediaError.message);
	if (!media) throw new Error('Media not found');

	const next: any = {};

	const set = patch?.set && typeof patch.set === 'object' ? patch.set : {};
	if ('description' in set) next.description = set.description ?? null;
	if ('thumbnail' in set) next.thumbnail = set.thumbnail ?? null;
	if ('paid' in set) next.paid = set.paid ?? null;
	if ('provider' in set) next.provider = set.provider ?? null;
	if ('external_url' in set) next.external_url = set.external_url ?? null;

	if ('facet_type' in set) next.facet_type = set.facet_type ?? null;
	if ('facet_environment' in set) next.facet_environment = set.facet_environment ?? null;
	if ('facet_film_style' in set) next.facet_film_style = set.facet_film_style ?? null;
	if ('facet_theme' in set) next.facet_theme = set.facet_theme ?? null;

	const add = patch?.add && typeof patch.add === 'object' ? patch.add : {};
	const remove = patch?.remove && typeof patch.remove === 'object' ? patch.remove : {};

	if ('creators' in add || 'creators' in remove) {
		next.creators = applyArrayOps((media as any).creators, (add as any).creators, (remove as any).creators);
	}
	if ('starring' in add || 'starring' in remove) {
		next.starring = applyArrayOps((media as any).starring, (add as any).starring, (remove as any).starring);
	}
	if ('facet_mood' in add || 'facet_mood' in remove) {
		next.facet_mood = applyArrayOps((media as any).facet_mood, (add as any).facet_mood, (remove as any).facet_mood);
	}
	if ('facet_movement' in add || 'facet_movement' in remove) {
		next.facet_movement = applyArrayOps(
			(media as any).facet_movement,
			(add as any).facet_movement,
			(remove as any).facet_movement
		);
	}

	if (Object.keys(next).length) {
		const { error: updateError } = await supabase.from('media_items').update(next).eq('id', mediaId);
		if (updateError) throw new Error(updateError.message);
	}

	// Tracks: optional apply for movies only
	const tracks: any[] = [];
	if (patch?.track && typeof patch.track === 'object') {
		tracks.push(patch.track);
	}
	if (Array.isArray(patch?.tracks_add)) {
		for (const t of patch.tracks_add) tracks.push({ ...(t ?? {}), action: 'add' });
	}
	if (Array.isArray(patch?.tracks_remove)) {
		for (const t of patch.tracks_remove) tracks.push({ ...(t ?? {}), action: 'remove' });
	}

	if (tracks.length && (media as any).type === 'movie') {
		for (const t of tracks) {
			const action = t?.action === 'remove' ? 'remove' : 'add';
			const spotifyUrl = String(t?.spotifyUrl ?? t?.spotify_url ?? '').trim();
			const spotifyTrackId = extractSpotifyTrackId(String(t?.spotifyTrackId ?? t?.spotify_track_id ?? spotifyUrl));
			if (!spotifyTrackId) throw new Error('Missing Spotify track id/url in track patch');

			if (action === 'remove') {
				const { data: song, error: songErr } = await supabase
					.from('songs')
					.select('id')
					.eq('spotify_track_id', spotifyTrackId)
					.maybeSingle();
				if (songErr) throw new Error(songErr.message);
				if (song?.id) {
					const { error: delErr } = await supabase
						.from('video_songs')
						.delete()
						.eq('video_id', mediaId)
						.eq('song_id', song.id);
					if (delErr) throw new Error(delErr.message);
				}
				continue;
			}

			const title = String(t?.title ?? '').trim();
			const artist = String(t?.artist ?? '').trim();
			if (!title || !artist) {
				throw new Error('Track add requires title and artist (edit admin payload before approving)');
			}

			const startAtSecondsRaw = t?.startAtSeconds ?? t?.start_at_seconds ?? t?.startOffsetSeconds ?? t?.start_offset_seconds;
			const startAtSeconds = Number.isFinite(Number(startAtSecondsRaw))
				? Math.max(0, Math.floor(Number(startAtSecondsRaw)))
				: null;
			const startTimecode = String(t?.startTimecode ?? t?.start_timecode ?? '').trim() || null;
			const parsedFromTc = startTimecode ? parseTimecodeToSeconds(startTimecode) : null;
			const effectiveOffset = startAtSeconds ?? parsedFromTc;
			if (effectiveOffset === null) throw new Error('Track add requires start offset seconds or a valid timecode');
			const positionRaw = t?.position;
			const position = Number.isFinite(Number(positionRaw)) ? Math.max(1, Math.floor(Number(positionRaw))) : 1;

			const { error: upsertSongErr } = await supabase
				.from('songs')
				.upsert(
					{
						spotify_track_id: spotifyTrackId,
						spotify_url: spotifyUrl || `https://open.spotify.com/track/${spotifyTrackId}`,
						title,
						artist
					} as any,
					{ onConflict: 'spotify_track_id' }
				);
			if (upsertSongErr) throw new Error(upsertSongErr.message);

			const { data: song, error: songErr } = await supabase
				.from('songs')
				.select('id')
				.eq('spotify_track_id', spotifyTrackId)
				.maybeSingle();
			if (songErr) throw new Error(songErr.message);
			if (!song?.id) throw new Error('Failed to resolve song id');

			const { error: upsertVideoSongErr } = await supabase
				.from('video_songs')
				.upsert(
					{
						video_id: mediaId,
						song_id: song.id,
						start_offset_seconds: effectiveOffset,
						start_timecode: startTimecode,
						position,
						source: 'manual'
					} as any,
					{ onConflict: 'video_id,song_id' }
				);
			if (upsertVideoSongErr) throw new Error(upsertVideoSongErr.message);
		}
	}
}

export async function applyNewSeason(
	supabase: ReturnType<typeof createSupabaseServiceClient>,
	seriesId: number,
	season: any
) {
	const seasonNumber = Number(season?.season_number);
	if (!Number.isFinite(seasonNumber) || seasonNumber < 1) {
		throw new Error('Invalid season_number');
	}
	const row: any = {
		series_id: seriesId,
		season_number: Math.floor(seasonNumber)
	};
	if (season?.playlist_id !== undefined) row.playlist_id = season.playlist_id || null;
	if (season?.custom_name !== undefined) row.custom_name = season.custom_name || null;

	const { error } = await supabase.from('series_seasons').upsert(row, { onConflict: 'series_id,season_number' });
	if (error) throw new Error(error.message);
}

export async function applyNewEpisode(
	supabase: ReturnType<typeof createSupabaseServiceClient>,
	seriesId: number,
	episode: any
) {
	const seasonNumber = Number(episode?.season_number);
	const episodeNumber = Number(episode?.episode_number);
	if (!Number.isFinite(seasonNumber) || seasonNumber < 1) throw new Error('Invalid season_number');
	if (!Number.isFinite(episodeNumber) || episodeNumber < 1) throw new Error('Invalid episode_number');

	const sn = Math.floor(seasonNumber);
	const en = Math.floor(episodeNumber);

	let seasonId: number | null = null;
	{
		const { data, error } = await supabase
			.from('series_seasons')
			.select('id')
			.eq('series_id', seriesId)
			.eq('season_number', sn)
			.maybeSingle();
		if (error) throw new Error(error.message);
		seasonId = (data as any)?.id ?? null;
	}

	if (!seasonId) {
		const { data, error } = await supabase
			.from('series_seasons')
			.insert({ series_id: seriesId, season_number: sn, playlist_id: episode?.playlist_id ?? null } as any)
			.select('id')
			.maybeSingle();
		if (error) throw new Error(error.message);
		seasonId = (data as any)?.id ?? null;
	}

	if (!seasonId) throw new Error('Failed to create/find season');

	const row: any = {
		season_id: seasonId,
		episode_number: en
	};
	if (episode?.video_id !== undefined) row.video_id = episode.video_id || null;
	if (episode?.title !== undefined) row.title = episode.title || null;
	if (episode?.description !== undefined) row.description = episode.description || null;
	if (episode?.published_at !== undefined) row.published_at = episode.published_at || null;
	if (episode?.thumbnail !== undefined) row.thumbnail = episode.thumbnail || null;
	if (episode?.duration !== undefined) row.duration = episode.duration || null;

	const { error } = await supabase.from('series_episodes').upsert(row, { onConflict: 'season_id,episode_number' });
	if (error) throw new Error(error.message);
}
