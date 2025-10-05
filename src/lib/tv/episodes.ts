// Minimal fetcher to get YouTube playlist items as episodes using the public Atom feed
// No API key required. Note: This relies on YouTube's public feeds and may be rate limited.

import type { Episode } from './types';

function between(input: string, startTag: string, endTag: string): string | undefined {
	const start = input.indexOf(startTag);
	if (start === -1) return undefined;
	const end = input.indexOf(endTag, start + startTag.length);
	if (end === -1) return undefined;
	return input.substring(start + startTag.length, end);
}

export async function fetchYouTubePlaylistEpisodes(playlistId: string): Promise<Episode[]> {
	const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
	const res = await fetch(url);
	if (!res.ok) return [];
	const xml = await res.text();
	// Naive split by <entry>
	const chunks = xml.split('<entry>').slice(1); // drop header part
	const eps: Episode[] = chunks
		.map((chunk, idx) => {
			const entry = chunk.split('</entry>')[0] || chunk;
			const title =
				between(entry, '<title>', '</title>')?.replace(/\s+/g, ' ').trim() || `Episode ${idx + 1}`;
			const publishedAt = between(entry, '<published>', '</published>');
			// yt:videoId might include namespace, match loosely
			const vidMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
			const videoId = vidMatch?.[1] || '';
			// media:thumbnail elements; choose the last occurrence (typically highest res)
			const thumbMatches = [...entry.matchAll(/<media:thumbnail[^>]*url="([^"]+)"[^>]*\/>/g)];
			const thumbnail = thumbMatches.length ? thumbMatches[thumbMatches.length - 1][1] : undefined;
			return { id: videoId, title, publishedAt, thumbnail, position: idx + 1 } satisfies Episode;
		})
		.filter((ep) => ep.id);
	return eps;
}
