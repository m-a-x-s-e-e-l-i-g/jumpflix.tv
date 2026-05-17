import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import { slugify } from '$lib/tv/slug';
import { importSpotifyTracklistFromYouTube } from '$lib/server/tracklist-import.server';
import { invalidateContentCache } from '$lib/server/content-service';
import { fetchPlaylistItems } from '$lib/server/youtube-playlist.server';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);
	return {};
};

function parseArrayInput(input: string): string[] {
	if (!input.trim()) return [];
	return input
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();

		const title = String(form.get('title') || '').trim();
		if (!title) return fail(400, { message: 'Title is required' });

		const year = String(form.get('year') || '').trim() || null;
		const defaultSlug = year ? `${slugify(title)}-${year}` : slugify(title);
		const slugInput = String(form.get('slug') || '').trim();
		const slug = slugInput || defaultSlug;

		const providerInput = String(form.get('provider') || '').trim().toLowerCase();
		let normalizedProvider: string | null = providerInput || null;

		let youtubeVideoId = String(form.get('video_id') || '').trim() || null;
		let vimeoId = String(form.get('vimeo_id') || '').trim() || null;

		if (providerInput === 'vimeo') {
			if (!vimeoId && youtubeVideoId) vimeoId = youtubeVideoId;
			youtubeVideoId = null;
		}

		if (providerInput === 'youtube') {
			if (!youtubeVideoId && vimeoId) youtubeVideoId = vimeoId;
			vimeoId = null;
		}

		if (!normalizedProvider) {
			if (vimeoId && !youtubeVideoId) normalizedProvider = 'vimeo';
			if (youtubeVideoId && !vimeoId) normalizedProvider = 'youtube';
		}

		const supabase = createSupabaseServiceClient();

		const { data, error } = await supabase
			.from('media_items')
			.insert({
				slug,
				type: 'movie',
				title,
				description: String(form.get('description') || '').trim() || null,
				year,
				duration: String(form.get('duration') || '').trim() || null,
				video_id: youtubeVideoId,
				vimeo_id: vimeoId,
				thumbnail: String(form.get('thumbnail') || '').trim() || null,
				blurhash: String(form.get('blurhash') || '').trim() || null,
				paid: form.get('paid') === 'true',
				provider: normalizedProvider,
				external_url: String(form.get('external_url') || '').trim() || null,
				trakt: String(form.get('trakt') || '').trim() || null,
				creators: parseArrayInput(String(form.get('creators') || '')),
				starring: parseArrayInput(String(form.get('starring') || ''))
			})
			.select()
			.single();

		if (error) {
			return fail(400, { message: error.message });
		}

		// Best-effort: auto-import Spotify-backed tracklist from YouTube metadata.
		// Never block saving the movie on this step.
		try {
			const ytId = String((data as any)?.video_id ?? '').trim();
			if (ytId) {
				await importSpotifyTracklistFromYouTube({
					supabase,
					movieId: Number((data as any).id),
					youtubeVideoId: ytId
				});
			}
		} catch {
			// best-effort only
		}

		// Ensure the new movie is visible immediately after redirect.
		await invalidateContentCache();

		redirect(302, `/movie/${data.slug}`);
	},

	savePlaylistSeries: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();

		const title = String(form.get('title') || '').trim();
		if (!title) return fail(400, { message: 'Title is required' });

		const playlistId = String(form.get('playlist_id') || '').trim();
		if (!playlistId) return fail(400, { message: 'Playlist ID is required' });

		const year = String(form.get('year') || '').trim() || null;
		const defaultSlug = year ? `${slugify(title)}-${year}` : slugify(title);
		const slugInput = String(form.get('slug') || '').trim();
		const slug = slugInput || defaultSlug;

		const supabase = createSupabaseServiceClient();

		// 1. Create the series media item
		const { data: series, error: seriesError } = await supabase
			.from('media_items')
			.insert({
				slug,
				type: 'series',
				title,
				description: String(form.get('description') || '').trim() || null,
				year,
				thumbnail: String(form.get('thumbnail') || '').trim() || null,
				blurhash: String(form.get('blurhash') || '').trim() || null,
				paid: form.get('paid') === 'true',
				provider: 'youtube',
				creators: parseArrayInput(String(form.get('creators') || '')),
				starring: parseArrayInput(String(form.get('starring') || ''))
			})
			.select()
			.single();

		if (seriesError) {
			return fail(400, { message: seriesError.message });
		}

		// 2. Create season 1 with the playlist ID
		const seasonName = String(form.get('season_name') || '').trim() || null;
		const { data: season, error: seasonError } = await supabase
			.from('series_seasons')
			.insert({
				series_id: Number(series.id),
				season_number: 1,
				playlist_id: playlistId,
				custom_name: seasonName
			})
			.select()
			.single();

		if (seasonError) {
			// Roll back the series if season creation fails
			await supabase.from('media_items').delete().eq('id', series.id);
			return fail(400, { message: `Failed to create season: ${seasonError.message}` });
		}

		// 3. Sync episodes from the playlist (best-effort)
		let episodesSynced = 0;
		try {
			const items = await fetchPlaylistItems(playlistId);
			if (items.length > 0) {
				const episodes = items.map((item) => ({
					season_id: Number(season.id),
					episode_number: item.position,
					video_id: item.id,
					title: item.title,
					thumbnail: item.thumbnail ?? null,
					published_at: item.publishedAt ?? null
				}));
				const { error: episodesError } = await supabase.from('series_episodes').insert(episodes);
				if (!episodesError) episodesSynced = items.length;
			}
		} catch {
			// best-effort only — series and season are already saved
		}

		await invalidateContentCache();

		redirect(302, `/series/${series.slug}`);
	}
};
