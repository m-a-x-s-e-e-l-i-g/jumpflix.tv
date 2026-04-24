import { parseTimecodeToSeconds } from '$lib/utils/timecode';
import type { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { fetchSpotifyTrack, hasSpotifyCredentials } from '$lib/server/spotify.server';

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

// ---------------------------------------------------------------------------
// XP unit computation
// ---------------------------------------------------------------------------

// Facet-type fields that each count as a separate XP unit when changed.
// Note: content_warnings is intentionally NOT in this list — it is handled
// separately and always contributes at most 1 unit regardless of how many
// warnings are included (see computeSuggestionXpUnits).
const FACET_SET_FIELDS = [
	'facet_type',
	'facet_environment',
	'facet_focus',
	'facet_production',
	'facet_presentation',
	'facet_medium'
] as const;

// Array-type facet fields (live under add/remove).
const FACET_ARRAY_FIELDS = ['facet_movement'] as const;

/**
 * Compute the number of XP units for a single content suggestion.
 *
 * Rules:
 *  - `facets` kind: 1 unit per distinct facet-type field being set/modified,
 *    with `content_warnings` (content ratings) capped at 1 unit total.
 *  - `spot_chapter` kind: 1 unit (one spot per suggestion).
 *  - `tracks` kind: 1 unit per song affected
 *    (`track` + `tracks_add` entries + `tracks_remove` entries).
 *  - All other kinds (`description`, `people`, `new_season`, `new_episode`,
 *    etc.): 1 unit.
 *
 * Minimum returned value is 1 so that every approved suggestion always
 * contributes at least some XP.
 */
export function computeSuggestionXpUnits(kind: string, payload: unknown): number {
	if (kind === 'facets') {
		const p = payload && typeof payload === 'object' ? (payload as Record<string, any>) : {};
		const set = p.set && typeof p.set === 'object' ? (p.set as Record<string, any>) : {};
		const add = p.add && typeof p.add === 'object' ? (p.add as Record<string, any>) : {};
		const remove = p.remove && typeof p.remove === 'object' ? (p.remove as Record<string, any>) : {};

		let units = 0;

		// Single-value facet fields (from `set`).
		for (const field of FACET_SET_FIELDS) {
			if (field in set) units += 1;
		}

		// Array facet fields (from `add` or `remove`).
		for (const field of FACET_ARRAY_FIELDS) {
			const inAdd = field in add && Array.isArray(add[field]) && (add[field] as unknown[]).length > 0;
			const inRemove =
				field in remove && Array.isArray(remove[field]) && (remove[field] as unknown[]).length > 0;
			if (inAdd || inRemove) units += 1;
		}

		// Content ratings (content_warnings) count as at most 1 unit.
		const warningsInAdd =
			'content_warnings' in add &&
			Array.isArray(add['content_warnings']) &&
			(add['content_warnings'] as unknown[]).length > 0;
		const warningsInRemove =
			'content_warnings' in remove &&
			Array.isArray(remove['content_warnings']) &&
			(remove['content_warnings'] as unknown[]).length > 0;
		if (warningsInAdd || warningsInRemove) units += 1;

		return Math.max(1, units);
	}

	if (kind === 'spot_chapter') {
		// The suggestions API only allows one spot per submission (one spot_chapter
		// per request), so every spot_chapter suggestion always has exactly 1 unit.
		// Submitting N spots requires N separate API calls, giving N × 1 = N units
		// total — which is the "more spots → more XP" behaviour described in the docs.
		return 1;
	}

	if (kind === 'tracks') {
		const p = payload && typeof payload === 'object' ? (payload as Record<string, any>) : {};
		let songs = 0;

		// Single-track shorthand (action: add | remove | edit).
		if (p.track && typeof p.track === 'object') songs += 1;

		// Bulk add / remove arrays.
		if (Array.isArray(p.tracks_add)) songs += (p.tracks_add as unknown[]).length;
		if (Array.isArray(p.tracks_remove)) songs += (p.tracks_remove as unknown[]).length;

		return Math.max(1, songs);
	}

	// description, people, new_season, new_episode, and any future kinds.
	return 1;
}

export type MediaPatch = {
	set?: Record<string, any>;
	add?: Record<string, any>;
	remove?: Record<string, any>;
	track?: {
		action?: 'add' | 'remove';
		songId?: number;
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

function parseSongId(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value) && value > 0) return Math.floor(value);
	const raw = String(value ?? '').trim();
	if (!raw) return null;
	const n = Number(raw);
	if (!Number.isFinite(n) || n <= 0) return null;
	return Math.floor(n);
}

export async function applyMediaPatch(
	supabase: ReturnType<typeof createSupabaseServiceClient>,
	mediaId: number,
	patch: MediaPatch
) {
	const { data: media, error: mediaError } = await supabase
		.from('media_items')
		.select(
			'id, type, description, creators, starring, facet_movement, facet_type, facet_environment, facet_focus, facet_production, facet_presentation, facet_medium, content_warnings, thumbnail, paid, provider, external_url'
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
	if ('facet_focus' in set) next.facet_focus = set.facet_focus ?? null;
	if ('facet_production' in set) next.facet_production = set.facet_production ?? null;
	if ('facet_presentation' in set) next.facet_presentation = set.facet_presentation ?? null;
	if ('facet_medium' in set) next.facet_medium = set.facet_medium ?? null;

	const add = patch?.add && typeof patch.add === 'object' ? patch.add : {};
	const remove = patch?.remove && typeof patch.remove === 'object' ? patch.remove : {};

	if ('creators' in add || 'creators' in remove) {
		next.creators = applyArrayOps(
			(media as any).creators,
			(add as any).creators,
			(remove as any).creators
		);
	}
	if ('starring' in add || 'starring' in remove) {
		next.starring = applyArrayOps(
			(media as any).starring,
			(add as any).starring,
			(remove as any).starring
		);
	}
	if ('facet_movement' in add || 'facet_movement' in remove) {
		next.facet_movement = applyArrayOps(
			(media as any).facet_movement,
			(add as any).facet_movement,
			(remove as any).facet_movement
		);
	}
	if ('content_warnings' in add || 'content_warnings' in remove) {
		next.content_warnings = applyArrayOps(
			(media as any).content_warnings,
			(add as any).content_warnings,
			(remove as any).content_warnings
		);
	}

	if (Object.keys(next).length) {
		const { error: updateError } = await supabase
			.from('media_items')
			.update(next)
			.eq('id', mediaId);
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
			const operation = String(t?.operation ?? t?.op ?? '').trim().toLowerCase();
			const songId = parseSongId(t?.songId ?? t?.song_id);
			let spotifyUrl = String(t?.spotifyUrl ?? t?.spotify_url ?? '').trim();
			let spotifyTrackId = extractSpotifyTrackId(
				String(t?.spotifyTrackId ?? t?.spotify_track_id ?? spotifyUrl)
			);

			if (action === 'remove') {
				let targetSongId = songId;
				if (!targetSongId) {
					if (!spotifyTrackId) {
						throw new Error('Missing song id or Spotify track id/url in track patch');
					}
					const { data: song, error: songErr } = await supabase
						.from('songs')
						.select('id')
						.eq('spotify_track_id', spotifyTrackId)
						.maybeSingle();
					if (songErr) throw new Error(songErr.message);
					targetSongId = song?.id ?? null;
				}

				const startAtSecondsRaw =
					t?.startAtSeconds ??
					t?.start_at_seconds ??
					t?.startOffsetSeconds ??
					t?.start_offset_seconds;
				const startAtSeconds = Number.isFinite(Number(startAtSecondsRaw))
					? Math.max(0, Math.floor(Number(startAtSecondsRaw)))
					: null;
				const startTimecode = String(t?.startTimecode ?? t?.start_timecode ?? '').trim() || null;
				const parsedFromTc = startTimecode ? parseTimecodeToSeconds(startTimecode) : null;
				const effectiveOffset = startAtSeconds ?? parsedFromTc;

				if (targetSongId) {
					let del = supabase
						.from('video_songs')
						.delete()
						.eq('video_id', mediaId)
						.eq('song_id', targetSongId);
					if (typeof effectiveOffset === 'number' && Number.isFinite(effectiveOffset)) {
						del = del.eq('start_offset_seconds', effectiveOffset);
					}
					const { error: delErr } = await del;
					if (delErr) throw new Error(delErr.message);
				}
				continue;
			}

			const title = String(t?.title ?? '').trim();
			const artist = String(t?.artist ?? '').trim();
			if (!title || !artist) {
				throw new Error(
					'Track add requires title and artist (edit admin payload before approving)'
				);
			}

			const startAtSecondsRaw =
				t?.startAtSeconds ??
				t?.start_at_seconds ??
				t?.startOffsetSeconds ??
				t?.start_offset_seconds;
			const startAtSeconds = Number.isFinite(Number(startAtSecondsRaw))
				? Math.max(0, Math.floor(Number(startAtSecondsRaw)))
				: null;
			const startTimecode = String(t?.startTimecode ?? t?.start_timecode ?? '').trim() || null;
			const parsedFromTc = startTimecode ? parseTimecodeToSeconds(startTimecode) : null;
			const effectiveOffset = startAtSeconds ?? parsedFromTc;
			if (effectiveOffset === null)
				throw new Error('Track add requires start offset seconds or a valid timecode');

			const prevStartAtSecondsRaw =
				t?.previousStartAtSeconds ??
				t?.previous_start_at_seconds ??
				t?.previousStartOffsetSeconds ??
				t?.previous_start_offset_seconds;
			const prevStartAtSeconds = Number.isFinite(Number(prevStartAtSecondsRaw))
				? Math.max(0, Math.floor(Number(prevStartAtSecondsRaw)))
				: null;
			const prevStartTimecode =
				String(t?.previousStartTimecode ?? t?.previous_start_timecode ?? '').trim() || null;
			const prevParsedFromTc = prevStartTimecode ? parseTimecodeToSeconds(prevStartTimecode) : null;
			const prevEffectiveOffset = prevStartAtSeconds ?? prevParsedFromTc;

			let targetSongId = songId;
			if (!targetSongId) {
				if (spotifyTrackId) {
					let spotifyExplicit: boolean | undefined;
					if (hasSpotifyCredentials()) {
						try {
							const spotifyTrack = await fetchSpotifyTrack(spotifyTrackId);
							spotifyUrl = spotifyTrack.url || spotifyUrl;
							if (typeof spotifyTrack.explicit === 'boolean') {
								spotifyExplicit = spotifyTrack.explicit;
							}
						} catch {
							// Keep workflow resilient if Spotify lookup fails.
						}
					}

					// Spotify-backed: upsert by track id.
					// NOTE: we intentionally avoid best-effort Spotify searching here; if the user
					// didn't provide a URL/ID, we treat it as a manual (no-link) track.
					const songUpsertPayload: any = {
						spotify_track_id: spotifyTrackId,
						spotify_url: spotifyUrl || `https://open.spotify.com/track/${spotifyTrackId}`,
						title,
						artist,
						duration_ms: null
					};
					if (typeof spotifyExplicit === 'boolean') {
						songUpsertPayload.explicit = spotifyExplicit;
					}

					const { error: upsertSongErr } = await supabase.from('songs').upsert(
						songUpsertPayload,
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
					targetSongId = song.id;
				} else {
					// Manual: store title+artist only (no Spotify link).
					const { data: inserted, error: insertErr } = await supabase
						.from('songs')
						.insert({
							spotify_track_id: null,
							spotify_url: null,
							title,
							artist,
							duration_ms: null
						} as any)
						.select('id')
						.single();
					if (insertErr) throw new Error(insertErr.message);
					if (!inserted?.id) throw new Error('Failed to insert song');
					targetSongId = inserted.id;
				}
			}

			// If this is an edit (timestamp change), update the existing row instead of inserting a new one.
			// With duplicates enabled, upserting on (video_id,song_id,start_offset_seconds) would otherwise
			// create a second entry when the timestamp changes.
			if (operation === 'edit') {
				if (typeof prevEffectiveOffset === 'number' && Number.isFinite(prevEffectiveOffset)) {
					const { data: updated, error: updateErr } = await supabase
						.from('video_songs')
						.update({
							start_offset_seconds: effectiveOffset,
							start_timecode: startTimecode,
							source: 'manual'
						} as any)
						.eq('video_id', mediaId)
						.eq('song_id', targetSongId)
						.eq('start_offset_seconds', prevEffectiveOffset)
						.select('id');
					if (updateErr) throw new Error(updateErr.message);
					if (Array.isArray(updated) && updated.length > 0) {
						continue;
					}
				} else {
					const { data: rows, error: fetchRowsErr } = await supabase
						.from('video_songs')
						.select('id')
						.eq('video_id', mediaId)
						.eq('song_id', targetSongId)
						.limit(2);
					if (fetchRowsErr) throw new Error(fetchRowsErr.message);
					if (Array.isArray(rows) && rows.length === 1) {
						const { error: updateByIdErr } = await supabase
							.from('video_songs')
							.update({
								start_offset_seconds: effectiveOffset,
								start_timecode: startTimecode,
								source: 'manual'
							} as any)
							.eq('id', (rows[0] as any).id);
						if (updateByIdErr) throw new Error(updateByIdErr.message);
						continue;
					}
					if (Array.isArray(rows) && rows.length > 1) {
						throw new Error(
							'Track edit is ambiguous (multiple matching track entries). Include previousStartAtSeconds/previousStartTimecode in the payload.'
						);
					}
				}
				// If we couldn't find a row to update, fall back to add behavior.
			}

			const { error: upsertVideoSongErr } = await supabase.from('video_songs').upsert(
				{
					video_id: mediaId,
					song_id: targetSongId,
					start_offset_seconds: effectiveOffset,
					start_timecode: startTimecode,
					source: 'manual'
				} as any,
				{ onConflict: 'video_id,song_id,start_offset_seconds' }
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

	const { error } = await supabase
		.from('series_seasons')
		.upsert(row, { onConflict: 'series_id,season_number' });
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
	if (!Number.isFinite(episodeNumber) || episodeNumber < 1)
		throw new Error('Invalid episode_number');

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
			.insert({
				series_id: seriesId,
				season_number: sn,
				playlist_id: episode?.playlist_id ?? null
			} as any)
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

	const { error } = await supabase
		.from('series_episodes')
		.upsert(row, { onConflict: 'season_id,episode_number' });
	if (error) throw new Error(error.message);
}
