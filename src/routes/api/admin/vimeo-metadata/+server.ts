import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';

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

	const videoUrl = `https://vimeo.com/${encodeURIComponent(videoId)}`;
	const oembedUrl = `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(videoUrl)}`;

	let body: {
		title?: unknown;
		description?: unknown;
		author_name?: unknown;
		upload_date?: unknown;
		duration?: unknown;
		thumbnail_url?: unknown;
	};

	try {
		const res = await fetch(oembedUrl, {
			headers: { 'user-agent': 'Mozilla/5.0 (compatible; JumpFlixAdminBot/1.0)' }
		});
		if (!res.ok) throw new Error(`HTTP ${res.status}`);
		body = (await res.json()) as typeof body;
	} catch (err: unknown) {
		const msg = err instanceof Error ? err.message : 'unknown error';
		throw error(502, `Could not fetch Vimeo metadata: ${msg}`);
	}

	const publishedAt = typeof body.upload_date === 'string' ? body.upload_date : '';
	const year = publishedAt ? inferYearFromIsoDate(publishedAt) : '';
	const durationSeconds = Number(body.duration) || 0;

	return json({
		title: typeof body.title === 'string' ? body.title : '',
		description: typeof body.description === 'string' ? body.description : '',
		year,
		duration: formatDurationRoundedToMinutes(durationSeconds),
		author: typeof body.author_name === 'string' ? body.author_name : '',
		videoId,
		publishedAt,
		thumbnailUrl: typeof body.thumbnail_url === 'string' ? body.thumbnail_url : ''
	});
};
