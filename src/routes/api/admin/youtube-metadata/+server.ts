import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';

import { extractYouTubePlayerResponse, youtubeUploadDate } from '$lib/server/video-metadata';

function inferYearFromIsoDate(isoDate: string): string {
	const clean = isoDate.trim();
	const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
	return m?.[1] ?? '';
}

function formatDurationRoundedToMinutes(seconds: number): string {
	if (seconds <= 0) return '';
	const minutesTotal = Math.max(1, Math.round(seconds / 60));
	const h = Math.floor(minutesTotal / 60);
	const m = minutesTotal % 60;
	if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
	return `${m}m`;
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

	const publishedAt = youtubeUploadDate(html, videoId) || '';
	const year = publishedAt ? inferYearFromIsoDate(publishedAt) : '';

	return json({
		title: String(d.title || ''),
		description: String(d.shortDescription || ''),
		year,
		duration: formatDurationRoundedToMinutes(lengthSeconds),
		author: String(d.author || ''),
		videoId: String(d.videoId || videoId),
		publishedAt
	});
};
