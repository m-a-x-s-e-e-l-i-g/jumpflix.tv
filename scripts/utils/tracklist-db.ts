import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';
import type { SpotifyTrack } from './spotify.js';

export async function upsertSongFromSpotify(
	supabase: SupabaseClient<Database>,
	track: SpotifyTrack
): Promise<{ songId: number }> {
	const { data, error } = await supabase
		.from('songs')
		.upsert(
			{
				spotify_track_id: track.id,
				spotify_url: track.url,
				title: track.title,
				artist: track.artist,
				duration_ms: track.durationMs ?? null
			},
			{ onConflict: 'spotify_track_id' }
		)
		.select('id')
		.single();

	if (error || !data) {
		throw new Error(`Failed to upsert song: ${error?.message ?? 'unknown error'}`);
	}

	return { songId: data.id };
}

export async function upsertVideoSong(
	supabase: SupabaseClient<Database>,
	params: {
		videoId: number;
		songId: number;
		startOffsetSeconds: number;
		startTimecode?: string;
		source: 'automation' | 'manual';
		importSource?: 'youtube_chapters' | 'youtube_music' | 'mixed';
	}
): Promise<void> {
	const { error } = await supabase.from('video_songs').upsert(
		{
			video_id: params.videoId,
			song_id: params.songId,
			start_offset_seconds: params.startOffsetSeconds,
			start_timecode: params.startTimecode ?? null,
			source: params.source,
			import_source: params.importSource ?? null
		},
		{ onConflict: 'video_id,song_id' }
	);

	if (error) throw new Error(`Failed to upsert video song: ${error.message}`);
}

export async function fetchVideoTracklist(
	supabase: SupabaseClient<Database>,
	videoId: number
): Promise<
	Array<{
		id: number;
		start_offset_seconds: number;
		start_timecode: string | null;
		source: 'automation' | 'manual';
		import_source: 'youtube_chapters' | 'youtube_music' | 'mixed' | null;
		song: {
			id: number;
			spotify_track_id: string;
			spotify_url: string;
			title: string;
			artist: string;
			duration_ms: number | null;
		};
	}>
> {
	const { data, error } = await supabase
		.from('video_songs')
		.select(
			`
      id,
      start_offset_seconds,
      start_timecode,
      source,
      import_source,
      song:songs!video_songs_song_id_fkey (
        id,
        spotify_track_id,
        spotify_url,
        title,
        artist,
        duration_ms
      )
    `
		)
		.eq('video_id', videoId)
		.order('start_offset_seconds', { ascending: true })
		.order('id', { ascending: true });

	if (error) throw new Error(`Failed to fetch tracklist: ${error.message}`);
	return (data as any[]) ?? [];
}

export async function clearVideoTracklist(
	supabase: SupabaseClient<Database>,
	videoId: number
): Promise<void> {
	const { error } = await supabase.from('video_songs').delete().eq('video_id', videoId);
	if (error) throw new Error(`Failed to clear tracklist: ${error.message}`);
}
