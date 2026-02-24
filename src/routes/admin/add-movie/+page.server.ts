import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import { slugify } from '$lib/tv/slug';
import { importSpotifyTracklistFromYouTube } from '$lib/server/tracklist-import.server';
import { invalidateContentCache } from '$lib/server/content-service';

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
				video_id: String(form.get('video_id') || '').trim() || null,
				thumbnail: String(form.get('thumbnail') || '').trim() || null,
				blurhash: String(form.get('blurhash') || '').trim() || null,
				paid: form.get('paid') === 'true',
				provider: String(form.get('provider') || '').trim() || null,
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
	}
};
