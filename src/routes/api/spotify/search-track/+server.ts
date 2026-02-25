import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { hasSpotifyCredentials, searchSpotifyTracks } from '$lib/server/spotify.server';

function asTrimmedString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function asSafeLimit(value: unknown): number {
	const n = typeof value === 'number' ? value : Number(String(value ?? ''));
	if (!Number.isFinite(n)) return 10;
	return Math.min(10, Math.max(1, Math.floor(n)));
}

export const POST: RequestHandler = async ({ request, locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'You must be signed in' }, { status: 401 });
	}

	if (!hasSpotifyCredentials()) {
		return json({ error: 'Spotify search is not configured on this server' }, { status: 503 });
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const title = asTrimmedString(body?.title);
	const artist = asTrimmedString(body?.artist) ?? undefined;
	const limit = asSafeLimit(body?.limit);

	if (!title) {
		return json({ error: 'title is required' }, { status: 400 });
	}
	if (title.length > 200 || (artist && artist.length > 200)) {
		return json({ error: 'Query too long' }, { status: 400 });
	}

	try {
		const tracks = await searchSpotifyTracks({ title, artist, limit });
		return json({ tracks });
	} catch (err: any) {
		return json({ error: err?.message || 'Spotify search failed' }, { status: 500 });
	}
};
