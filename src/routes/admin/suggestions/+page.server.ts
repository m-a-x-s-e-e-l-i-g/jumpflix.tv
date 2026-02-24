import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import { invalidateContentCache } from '$lib/server/content-service';
import {
	applyMediaPatch,
	applyNewEpisode,
	applyNewSeason,
	type MediaPatch
} from '$lib/server/content-suggestions';
import { normalizeParkourSpotId } from '$lib/utils';

const INVALID_JSON = Symbol('invalid-json');

function asTrimmedString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function asSafeInt(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const n = typeof value === 'number' ? value : Number(String(value));
	if (!Number.isFinite(n)) return null;
	return Math.max(0, Math.floor(n));
}

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
		const parsed = safeParseJson(form.get('admin_payload'));
		if (parsed === INVALID_JSON) {
			return fail(400, { message: 'Invalid JSON in admin_payload' });
		}

		const supabase = createSupabaseServiceClient();
		const { error } = await (supabase as any)
			.from('content_suggestions')
				.update({ admin_payload: parsed })
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

		let didMutateContent = false;

		try {
			const kind = String((suggestion as any).kind ?? '');
			if (kind === 'spot_chapter') {
				const mediaType = String((suggestion as any).media_type ?? '').trim();
				if (mediaType !== 'movie' && mediaType !== 'series') {
					return fail(400, { message: 'Invalid media_type' });
				}

				const patchAny = effectivePatch as any;
				const spotIdRaw = asTrimmedString(patchAny?.spotId ?? patchAny?.spot_id);
				const spotId = spotIdRaw ? normalizeParkourSpotId(spotIdRaw) : null;
				const startSeconds = asSafeInt(patchAny?.startSeconds ?? patchAny?.start_seconds);
				const endSeconds = asSafeInt(patchAny?.endSeconds ?? patchAny?.end_seconds);
				const playbackKey = asTrimmedString(patchAny?.playbackKey ?? patchAny?.playback_key);
				const spotChapterId = asSafeInt(patchAny?.spotChapterId ?? patchAny?.spot_chapter_id);
				if (!spotId || startSeconds === null || endSeconds === null) {
					return fail(400, { message: 'Missing spotId/startSeconds/endSeconds' });
				}
				if (endSeconds <= startSeconds) {
					return fail(400, { message: 'endSeconds must be greater than startSeconds' });
				}
				if (mediaType === 'series' && !playbackKey) {
					return fail(400, { message: 'playbackKey is required for series spot chapters' });
				}

				if (spotChapterId) {
					const { data: updated, error: updateSpotChapterError } = await (supabase as any)
						.from('spot_chapters')
						.update({
							spot_id: spotId,
							created_from_suggestion_id: id,
							approved_by: user.id,
							approved_at: new Date().toISOString()
						})
						.eq('id', spotChapterId)
						.eq('media_id', mediaId)
						.eq('media_type', mediaType)
						.eq('playback_key', mediaType === 'series' ? playbackKey : '')
						.select('id');

					if (updateSpotChapterError) {
						return fail(400, { message: updateSpotChapterError.message });
					}
					if (!Array.isArray(updated) || updated.length === 0) {
						return fail(400, { message: 'Spot chapter not found for update' });
					}
					didMutateContent = true;
				} else {
					const { error: spotChapterError } = await (supabase as any)
						.from('spot_chapters')
						.upsert(
							{
								media_id: mediaId,
								media_type: mediaType,
								playback_key: mediaType === 'series' ? playbackKey : '',
								spot_id: spotId,
								start_seconds: startSeconds,
								end_seconds: endSeconds,
								created_from_suggestion_id: id,
								approved_by: user.id,
								approved_at: new Date().toISOString()
							},
							{
								onConflict: 'created_from_suggestion_id'
							}
						);

					if (spotChapterError) {
						return fail(400, { message: spotChapterError.message });
					}
					didMutateContent = true;
				}
			} else if (kind === 'new_season') {
				await applyNewSeason(supabase, mediaId, effectivePatch.season ?? effectivePatch);
				didMutateContent = true;
			} else if (kind === 'new_episode') {
				await applyNewEpisode(supabase, mediaId, effectivePatch.episode ?? effectivePatch);
				didMutateContent = true;
			} else {
				await applyMediaPatch(supabase, mediaId, effectivePatch);
				didMutateContent = true;
			}
		} catch (err: any) {
			if (didMutateContent) {
				await invalidateContentCache();
			}
			return fail(400, { message: err?.message || 'Failed to apply suggestion' });
		}

		const { error: updateError } = await (supabase as any)
			.from('content_suggestions')
			.update({
				status: 'approved',
				admin_payload: parsed,
				processed_at: new Date().toISOString(),
				processed_by: user.id
			})
			.eq('id', id);

		if (updateError) {
			if (didMutateContent) {
				await invalidateContentCache();
			}
			return fail(400, { message: updateError.message });
		}

		if (didMutateContent) {
			await invalidateContentCache();
		}
		return { ok: true };
	},

	decline: async ({ request, locals }) => {
		const { user } = await locals.safeGetSession();
		requireAdmin(user);

		const form = await request.formData();
		const id = Number(form.get('id'));
		if (!Number.isFinite(id)) return fail(400, { message: 'Invalid id' });

		const supabase = createSupabaseServiceClient();
		const { error } = await (supabase as any)
			.from('content_suggestions')
			.update({
				status: 'declined',
				processed_at: new Date().toISOString(),
				processed_by: user.id
			})
			.eq('id', id);

		if (error) return fail(400, { message: error.message });
		return { ok: true };
	}
};
