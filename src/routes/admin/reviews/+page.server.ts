import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const supabase = createSupabaseServiceClient();
	const { data, error } = await (supabase as any)
		.from('reviews')
		.select('*, media:media_items(id, title, slug, type)')
		.order('created_at', { ascending: false })
		.limit(200);

	if (error) {
		return { reviews: [], error: error.message };
	}

	return { reviews: data ?? [], error: null };
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
