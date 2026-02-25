import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '$lib/supabase/types';
import { bestEffortSearchSpotifyTrack, hasSpotifyCredentials } from '$lib/server/spotify.server';
import { fetchYouTubeTrackCandidates } from '$lib/server/youtube-tracklist.server';

export async function importSpotifyTracklistFromYouTube(params: {
	supabase: SupabaseClient<Database>;
	movieId: number;
	youtubeVideoId: string;
}): Promise<{ imported: number; skipped: number; candidates: number }> {
	if (!hasSpotifyCredentials()) {
		return { imported: 0, skipped: 0, candidates: 0 };
	}

	// Avoid re-importing if a tracklist already exists.
	const { count, error: existingErr } = await params.supabase
		.from('video_songs')
		.select('id', { count: 'exact', head: true })
		.eq('video_id', params.movieId);
	if (!existingErr && (count ?? 0) > 0) {
		return { imported: 0, skipped: 0, candidates: 0 };
	}

	const { candidates, importSource } = await fetchYouTubeTrackCandidates(params.youtubeVideoId);
	if (!candidates.length) return { imported: 0, skipped: 0, candidates: 0 };

	let imported = 0;
	let skipped = 0;

	for (const cand of candidates) {
		try {
			const result = await bestEffortSearchSpotifyTrack({ title: cand.title, artist: cand.artist });
			if (!result) {
				skipped++;
				continue;
			}

			const { data: song, error: songErr } = await params.supabase
				.from('songs')
				.upsert(
					{
						spotify_track_id: result.id,
						spotify_url: result.url,
						title: result.title,
						artist: result.artist,
						duration_ms: result.durationMs ?? null
					},
					{ onConflict: 'spotify_track_id' }
				)
				.select('id')
				.single();
			if (songErr || !song) throw new Error(songErr?.message ?? 'Failed to upsert song');

			const { error: videoSongErr } = await params.supabase.from('video_songs').upsert(
				{
					video_id: params.movieId,
					song_id: song.id,
					start_offset_seconds: cand.startOffsetSeconds,
					start_timecode: cand.startTimecode ?? null,
					source: 'automation',
					import_source: importSource
				},
				{ onConflict: 'video_id,song_id,start_offset_seconds' }
			);
			if (videoSongErr) throw new Error(videoSongErr.message);

			imported++;
		} catch {
			skipped++;
		}
	}

	return { imported, skipped, candidates: candidates.length };
}
