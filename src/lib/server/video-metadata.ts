import { movieVideoSource, type VideoMetadata } from '../tv/video-discovery';
import type { Movie } from '../tv/types';
import { verifiedDate } from '../seo';

export function extractYouTubePlayerResponse(html: string): Record<string, any> | null {
	const index = html.search(
		/(?:ytInitialPlayerResponse\s*=|window\["ytInitialPlayerResponse"\]\s*=)/
	);
	if (index < 0) return null;
	const start = html.indexOf('{', index);
	if (start < 0) return null;
	let depth = 0,
		inString = false,
		escaped = false;
	for (let i = start; i < html.length; i++) {
		const ch = html[i];
		if (inString) {
			if (escaped) escaped = false;
			else if (ch === '\\') escaped = true;
			else if (ch === '"') inString = false;
			continue;
		}
		if (ch === '"') inString = true;
		else if (ch === '{') depth++;
		else if (ch === '}' && --depth === 0) {
			try {
				return JSON.parse(html.slice(start, i + 1));
			} catch {
				return null;
			}
		}
	}
	return null;
}

export function youtubeUploadDate(html: string, videoId: string): string | undefined {
	const player = extractYouTubePlayerResponse(html);
	if (player?.videoDetails?.videoId !== videoId) return undefined;
	const date = player?.microformat?.playerMicroformatRenderer?.uploadDate;
	return typeof date === 'string' ? verifiedDate(date) : undefined;
}

export function vimeoUploadDate(
	body: Record<string, unknown>,
	videoId: string
): string | undefined {
	if (String(body.video_id ?? '') !== videoId) return undefined;
	// Vimeo oEmbed may use a space-separated timestamp without a timezone.
	// Keep only the provider's calendar date in that case, rather than inventing a timezone.
	const date = typeof body.upload_date === 'string' ? body.upload_date : '';
	return verifiedDate(date.includes(' ') ? date.split(' ')[0] : date);
}

/** Provider requests happen during import/backfill, never in public page loads. */
export async function fetchMovieVideoMetadata(
	movie: Movie,
	request = fetch
): Promise<VideoMetadata | null> {
	const source = movieVideoSource(movie);
	if (!source?.embedUrl || !['youtube', 'vimeo'].includes(source.kind)) return null;
	const id = source.sourceKey.split('/')[1];
	const providerUrl =
		source.kind === 'youtube'
			? `https://www.youtube.com/watch?v=${id}`
			: `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(`https://${source.sourceKey.replace('vimeo/', 'vimeo.com/')}`)}`;
	const response = await request(providerUrl, {
		headers: { 'user-agent': 'Mozilla/5.0 (compatible; JumpFlixAdminBot/1.0)' },
		signal: AbortSignal.timeout(15000)
	});
	if (!response.ok) throw new Error(`Provider metadata returned HTTP ${response.status}`);
	const publishedAt =
		source.kind === 'youtube'
			? youtubeUploadDate(await response.text(), id)
			: vimeoUploadDate(await response.json(), id);
	return publishedAt ? { sourceKey: source.sourceKey, publishedAt } : null;
}
