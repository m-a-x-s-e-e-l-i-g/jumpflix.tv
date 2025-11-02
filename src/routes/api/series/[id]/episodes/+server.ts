import type { RequestHandler } from '@sveltejs/kit';
import { fetchEpisodesByPlaylist } from '$lib/server/content-service';
import { fetchYouTubePlaylistEpisodes } from '$lib/tv/episodes';
import type { Episode } from '$lib/tv/types';

export const GET: RequestHandler = async ({ params }) => {
  const id = params.id as string;
  if (!id) return new Response(JSON.stringify({ episodes: [] }), { status: 400 });
  try {
  let episodes: Episode[] = [];
    try {
      episodes = await fetchEpisodesByPlaylist(id);
    } catch (err) {
      episodes = [];
    }
    if (!episodes.length) {
      episodes = await fetchYouTubePlaylistEpisodes(id);
    }
    return new Response(JSON.stringify({ episodes }), {
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=900' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ episodes: [] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
};
