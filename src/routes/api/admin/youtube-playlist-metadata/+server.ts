import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requireAdmin } from '$lib/server/admin';
import { fetchPlaylistMetadata } from '$lib/server/youtube-playlist.server';

export const GET: RequestHandler = async ({ url, locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const playlistId = url.searchParams.get('playlistId')?.trim() ?? '';
	if (!playlistId) {
		throw error(400, 'playlistId is required');
	}

	// Basic validation — YouTube playlist IDs start with PL, FL, UU, etc.
	if (!/^[A-Za-z0-9_-]{10,}$/.test(playlistId)) {
		throw error(400, 'Invalid playlist ID');
	}

	try {
		const metadata = await fetchPlaylistMetadata(playlistId);
		return json(metadata);
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch playlist metadata';
		throw error(500, message);
	}
};
