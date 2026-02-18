import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import {
	applyMediaPatch,
	applyNewEpisode,
	applyNewSeason,
	type MediaPatch
} from '$lib/server/content-suggestions';

const INVALID_JSON = Symbol('invalid-json');

function safeParseJson(value: FormDataEntryValue | null): any | null {
	if (value === null) return null;
	const text = typeof value === 'string' ? value.trim() : '';
	if (!text) return null;
	try {
		return JSON.parse(text);
	} catch {
		return INVALID_JSON;
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	requireAdmin(user);

	const supabase = createSupabaseServiceClient();
	const { data, error } = await (supabase as any)
		.from('content_suggestions')
		.select('*, media:media_items(id, title, slug, type)')
		.order('created_at', { ascending: false })
		.limit(200);

	if (error) {
		return { suggestions: [], error: error.message };
	}

	return { suggestions: data ?? [], error: null };
};

export const actions: Actions = {
	save: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isFinite(id)) return fail(400, { message: 'Invalid id' });

		const adminNote = String(form.get('admin_note') ?? '').trim() || null;
		const parsed = safeParseJson(form.get('admin_payload'));
		if (parsed === INVALID_JSON) {
			return fail(400, { message: 'Invalid JSON in admin_payload' });
		}

		const supabase = createSupabaseServiceClient();
		const { error } = await (supabase as any)
			.from('content_suggestions')
			.update({ admin_note: adminNote, admin_payload: parsed })
			.eq('id', id);

		if (error) return fail(400, { message: error.message });
		return { ok: true };
	},

	approve: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isFinite(id)) return fail(400, { message: 'Invalid id' });

		const adminNote = String(form.get('admin_note') ?? '').trim() || null;
		const parsed = safeParseJson(form.get('admin_payload'));
		if (parsed === INVALID_JSON) {
			return fail(400, { message: 'Invalid JSON in admin_payload' });
		}

		const supabase = createSupabaseServiceClient();
		const { data: suggestion, error: fetchError } = await (supabase as any)
			.from('content_suggestions')
			.select('*')
			.eq('id', id)
			.maybeSingle();

		if (fetchError) return fail(400, { message: fetchError.message });
		if (!suggestion) return fail(404, { message: 'Suggestion not found' });

		const mediaId = Number((suggestion as any).media_id);
		if (!Number.isFinite(mediaId)) return fail(400, { message: 'Invalid media_id' });

		const effectivePatch: MediaPatch = (parsed ??
			(suggestion as any).admin_payload ??
			(suggestion as any).payload ??
			{}) as any;

		try {
			const kind = String((suggestion as any).kind ?? '');
			if (kind === 'new_season') {
				await applyNewSeason(supabase, mediaId, effectivePatch.season ?? effectivePatch);
			} else if (kind === 'new_episode') {
				await applyNewEpisode(supabase, mediaId, effectivePatch.episode ?? effectivePatch);
			} else {
				await applyMediaPatch(supabase, mediaId, effectivePatch);
			}
		} catch (err: any) {
			return fail(400, { message: err?.message || 'Failed to apply suggestion' });
		}

		const { error: updateError } = await (supabase as any)
			.from('content_suggestions')
			.update({
				status: 'approved',
				admin_note: adminNote,
				admin_payload: parsed,
				processed_at: new Date().toISOString(),
				processed_by: user.id
			})
			.eq('id', id);

		if (updateError) return fail(400, { message: updateError.message });
		return { ok: true };
	},

	decline: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isFinite(id)) return fail(400, { message: 'Invalid id' });

		const adminNote = String(form.get('admin_note') ?? '').trim() || null;

		const supabase = createSupabaseServiceClient();
		const { error } = await (supabase as any)
			.from('content_suggestions')
			.update({
				status: 'declined',
				admin_note: adminNote,
				processed_at: new Date().toISOString(),
				processed_by: user.id
			})
			.eq('id', id);

		if (error) return fail(400, { message: error.message });
		return { ok: true };
	}
};
