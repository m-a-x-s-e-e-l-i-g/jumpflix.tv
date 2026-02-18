import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const supabase = createSupabaseServiceClient();
	const { data, error } = await (supabase as any)
		.from('reviews_with_author')
		.select('id, user_id, media_id, author_name, body, created_at, updated_at')
		.order('created_at', { ascending: false })
		.limit(200);

	if (error) {
		return { reviews: [], error: error.message };
	}

	const reviews = (data ?? []) as Array<any>;
	const mediaIds = Array.from(
		new Set(
			reviews
				.map((r) => Number(r.media_id))
				.filter((id) => Number.isFinite(id))
		)
	);

	let mediaById = new Map<number, any>();
	if (mediaIds.length) {
		const { data: mediaRows } = await (supabase as any)
			.from('media_items')
			.select('id, title, slug, type')
			.in('id', mediaIds);
		for (const row of mediaRows ?? []) {
			mediaById.set(Number(row.id), row);
		}
	}

	const hydrated = reviews.map((r) => ({
		...r,
		media: mediaById.get(Number(r.media_id)) ?? null
	}));

	return { reviews: hydrated, error: null };
};

export const actions: Actions = {
	delete: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isFinite(id)) return fail(400, { message: 'Invalid id' });

		const supabase = createSupabaseServiceClient();
		const { error } = await (supabase as any).from('reviews').delete().eq('id', id);
		if (error) return fail(400, { message: error.message });

		return { ok: true };
	}
};
