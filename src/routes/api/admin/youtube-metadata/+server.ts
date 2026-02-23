import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';

function extractBalancedJson(html: string, marker: string): unknown {
	const idx = html.indexOf(marker);
	if (idx === -1) return null;
	const braceStart = html.indexOf('{', idx);
	if (braceStart === -1) return null;

	let depth = 0;
	let inString = false;
	let escape = false;

	for (let i = braceStart; i < html.length; i++) {
		const ch = html[i];
		if (inString) {
			if (escape) {
				escape = false;
			} else if (ch === '\\') {
				escape = true;
			} else if (ch === '"') {
				inString = false;
			}
			continue;
		}
		if (ch === '"') {
			inString = true;
			continue;
		}
		if (ch === '{') depth++;
		if (ch === '}') depth--;
		if (depth === 0) {
			try {
				return JSON.parse(html.slice(braceStart, i + 1));
			} catch {
				return null;
			}
		}
	}
	return null;
}

function extractYouTubePlayerResponse(html: string): Record<string, unknown> | null {
	const result =
		extractBalancedJson(html, 'ytInitialPlayerResponse') ||
		extractBalancedJson(html, 'var ytInitialPlayerResponse') ||
		extractBalancedJson(html, 'window["ytInitialPlayerResponse"]');
	return result && typeof result === 'object' ? (result as Record<string, unknown>) : null;
}

function formatDuration(seconds: number): string {
	if (seconds <= 0) return '';
	const h = Math.floor(seconds / 3600);
	const m = Math.floor((seconds % 3600) / 60);
	const s = seconds % 60;
	if (h > 0) {
		return s > 0 ? `${h}h ${m}m ${s}s` : `${h}h ${m}m`;
	}
	return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const videoId = url.searchParams.get('videoId')?.trim();
	if (!videoId) throw error(400, 'Missing videoId');

	let html: string;
	try {
		const res = await fetch(`https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`, {
			headers: { 'user-agent': 'Mozilla/5.0 (compatible; JumpFlixAdminBot/1.0)' }
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		html = await res.text();
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'unknown error';
		throw error(502, `Could not fetch YouTube page: ${msg}`);
	}

	const player = extractYouTubePlayerResponse(html);
	const details = player?.videoDetails;
	if (!details || typeof details !== 'object') {
		throw error(502, 'Could not extract video details from YouTube page');
	}

	const d = details as Record<string, unknown>;
	const lengthSeconds = Number(d.lengthSeconds) || 0;

	const thumbnailQualities = ['maxresdefault', 'hqdefault', 'mqdefault', 'sddefault', 'default'];
	const thumbnails = thumbnailQualities.map((quality) => ({
		quality,
		url: `https://img.youtube.com/vi/${videoId}/${quality}.jpg`
	}));

	return json({
		title: String(d.title || ''),
		description: String(d.shortDescription || ''),
		duration: formatDuration(lengthSeconds),
		author: String(d.author || ''),
		videoId: String(d.videoId || videoId),
		externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
		thumbnails
	});
};
