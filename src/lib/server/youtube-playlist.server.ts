/**
 * Server-side YouTube playlist utilities.
 * Uses the public Atom feed (no API key required) to fetch playlist items.
 */

export interface PlaylistItem {
	id: string; // video ID
	title: string;
	description?: string;
	publishedAt?: string;
	thumbnail?: string;
	position: number;
}

export interface PlaylistMetadata {
	playlistId: string;
	title: string;
	channelName: string;
	videoCount: number;
	year: string;
	items: PlaylistItem[];
}

function between(input: string, startTag: string, endTag: string): string | undefined {
	const start = input.indexOf(startTag);
	if (start === -1) return undefined;
	const end = input.indexOf(endTag, start + startTag.length);
	if (end === -1) return undefined;
	return input.substring(start + startTag.length, end);
}

/**
 * Fetch playlist items from YouTube's public Atom feed.
 * Note: the Atom feed is limited to the most recent 15 videos.
 */
export async function fetchPlaylistItems(playlistId: string): Promise<PlaylistItem[]> {
	const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
	const res = await fetch(url, {
		headers: { 'User-Agent': 'Mozilla/5.0 (compatible; JUMPFLIX/1.0)' }
	});
	if (!res.ok) {
		throw new Error(`Failed to fetch YouTube playlist feed: HTTP ${res.status}`);
	}

	const xml = await res.text();
	const chunks = xml.split('<entry>').slice(1);

	const items: PlaylistItem[] = chunks
		.map((chunk, idx) => {
			const entry = chunk.split('</entry>')[0] ?? chunk;
			const title =
				between(entry, '<title>', '</title>')?.replace(/\s+/g, ' ').trim() ?? `Episode ${idx + 1}`;
			const publishedAt = between(entry, '<published>', '</published>');
			const description = between(entry, '<media:description>', '</media:description>')?.trim();
			const vidMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
			const videoId = vidMatch?.[1] ?? '';
			const thumbMatches = Array.from(
				entry.matchAll(/<media:thumbnail[^>]*url="([^"]+)"[^>]*\/>/g)
			);
			const thumbnail =
				thumbMatches.length > 0 ? thumbMatches[thumbMatches.length - 1]?.[1] : undefined;

			return { id: videoId, title, description, publishedAt, thumbnail, position: idx + 1 };
		})
		.filter((item) => item.id.length > 0);

	return items;
}

/**
 * Fetch playlist title and channel name by scraping the playlist page.
 */
async function scrapePlaylistInfo(
	playlistId: string
): Promise<{ title: string; channelName: string }> {
	const url = `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
	const res = await fetch(url, {
		headers: {
			'User-Agent':
				'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
			'Accept-Language': 'en-US,en;q=0.9'
		}
	});

	if (!res.ok) {
		return { title: '', channelName: '' };
	}

	const html = await res.text();

	// Extract title from <title> tag: "Playlist Name - YouTube"
	const titleMatch = html.match(/<title>([^<]+)<\/title>/);
	const rawTitle = titleMatch?.[1]?.trim() ?? '';
	const title = rawTitle.replace(/\s*[-–]\s*YouTube\s*$/, '').trim();

	// Try to extract channel name from ytInitialData
	let channelName = '';
	try {
		const dataMatch = html.match(/var ytInitialData\s*=\s*(\{.{0,2000000}\});/s);
		if (dataMatch?.[1]) {
			const data = JSON.parse(dataMatch[1]) as Record<string, unknown>;
			// Navigate to owner channel name in the data
			const header = (
				(data?.header as Record<string, unknown>)
					?.playlistHeaderRenderer as Record<string, unknown>
			);
			if (header) {
				const ownerText = (header?.ownerText as Record<string, unknown>)?.runs;
				if (Array.isArray(ownerText) && ownerText.length > 0) {
					channelName = String((ownerText[0] as Record<string, unknown>)?.text ?? '');
				}
			}
		}
	} catch {
		// ignore parse errors
	}

	return { title, channelName };
}

/**
 * Fetch full playlist metadata: title, channel name, items from Atom feed.
 */
export async function fetchPlaylistMetadata(playlistId: string): Promise<PlaylistMetadata> {
	const [items, info] = await Promise.all([
		fetchPlaylistItems(playlistId),
		scrapePlaylistInfo(playlistId)
	]);

	const firstPublishedAt = items[0]?.publishedAt ?? '';
	const year = firstPublishedAt ? new Date(firstPublishedAt).getFullYear().toString() : '';

	return {
		playlistId,
		title: info.title,
		channelName: info.channelName,
		videoCount: items.length,
		year,
		items
	};
}
