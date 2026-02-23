import type { RequestHandler } from '@sveltejs/kit';
import { fetchEpisodesByPlaylist, fetchEpisodesBySeasonId } from '$lib/server/content-service';
import { fetchYouTubePlaylistEpisodes } from '$lib/tv/episodes';
import type { Episode } from '$lib/tv/types';

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id as string;
	if (!id) return new Response(JSON.stringify({ episodes: [] }), { status: 400 });
	try {
		let episodes: Episode[] = [];

		// Check if id is a number (season_id) or string (playlist_id)
		const isSeasonId = /^\d+$/.test(id);

		if (isSeasonId) {
			// Fetch by season ID (for series without YouTube playlists)
			try {
				episodes = await fetchEpisodesBySeasonId(parseInt(id, 10));
			} catch (err) {
				episodes = [];
			}
		} else {
			// Fetch by playlist ID (for YouTube series)
			try {
				episodes = await fetchEpisodesByPlaylist(id);
			} catch (err) {
				episodes = [];
			}

			// If we got DB-backed episodes but they don't have stable playback ids (YouTube video ids),
			// fall back to the YouTube API so watch-history keys like `series:<id>:ep:<videoId>` match.
			// (Non-11-char ids here typically mean `video_id` wasn't populated in the DB.)
			const looksLikeYouTubeVideoId = (value: unknown) => /^[A-Za-z0-9_-]{11}$/.test(String(value ?? ''));
			const hasInvalidEpisodeIds = episodes.some((ep) => !looksLikeYouTubeVideoId((ep as any)?.id));
			if (episodes.length && hasInvalidEpisodeIds) {
				episodes = [];
			}

			// Fallback to YouTube API if no episodes found
			if (!episodes.length) {
				episodes = await fetchYouTubePlaylistEpisodes(id);
			}
		}

		return new Response(JSON.stringify({ episodes }), {
			headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' }
		});
	} catch (e) {
		return new Response(JSON.stringify({ episodes: [] }), {
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		});
	}
};
