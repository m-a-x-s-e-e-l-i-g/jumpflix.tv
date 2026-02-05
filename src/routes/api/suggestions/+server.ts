import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAdminUser } from '$lib/server/admin';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { applyMediaPatch, applyNewEpisode, applyNewSeason, type MediaPatch } from '$lib/server/content-suggestions';

function asTrimmedString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function asSafeInt(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const n = typeof value === 'number' ? value : Number(String(value));
	if (!Number.isFinite(n)) return null;
	const i = Math.floor(n);
	return i >= 0 ? i : null;
}

export const POST: RequestHandler = async ({ request, locals, url }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		return json({ error: 'You must be signed in to submit suggestions' }, { status: 401 });
	}

	let body: any;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON' }, { status: 400 });
	}

	const mediaId = asSafeInt(body?.mediaId);
	const mediaType = asTrimmedString(body?.mediaType);
	const targetScope = asTrimmedString(body?.targetScope) ?? 'media';
	const kind = asTrimmedString(body?.kind);
	const note = asTrimmedString(body?.note);
	const contactEmail = asTrimmedString(body?.contactEmail);
	const seasonNumber = asSafeInt(body?.seasonNumber);
	const episodeNumber = asSafeInt(body?.episodeNumber);
	const payload = body?.payload && typeof body.payload === 'object' ? body.payload : undefined;

	if (!mediaId) return json({ error: 'mediaId is required' }, { status: 400 });
	if (mediaType !== 'movie' && mediaType !== 'series') {
		return json({ error: 'mediaType must be movie or series' }, { status: 400 });
	}
	if (targetScope !== 'media' && targetScope !== 'episode') {
		return json({ error: 'targetScope must be media or episode' }, { status: 400 });
	}
	if (!kind) return json({ error: 'kind is required' }, { status: 400 });

	if (targetScope === 'episode') {
		if (mediaType !== 'series') {
			return json({ error: 'episode target is only supported for series' }, { status: 400 });
		}
		if (!seasonNumber || !episodeNumber) {
			return json({ error: 'seasonNumber and episodeNumber are required for episode suggestions' }, { status: 400 });
		}
	}

	if (!note && !payload) {
		return json({ error: 'Provide note or payload' }, { status: 400 });
	}

	if (note && note.length > 3000) {
		return json({ error: 'Note too long' }, { status: 400 });
	}
	if (contactEmail && contactEmail.length > 200) {
		return json({ error: 'contactEmail too long' }, { status: 400 });
	}

	const row = {
		media_id: mediaId,
		media_type: mediaType,
		target_scope: targetScope,
		season_number: targetScope === 'episode' ? seasonNumber : null,
		episode_number: targetScope === 'episode' ? episodeNumber : null,
		kind,
		note: note ?? null,
		payload: payload ?? null,
		contact_email: contactEmail ?? null,
		source_path: url.pathname,
		status: 'pending',
		created_by: user.id
	};

	const isAdmin = isAdminUser(user);

	const { data: inserted, error: insertError } = await (locals.supabase as any)
		.from('content_suggestions')
		.insert(row as any)
		.select('id')
		.maybeSingle();
	if (insertError) {
		return json({ error: insertError.message }, { status: 400 });
	}

	const suggestionId = Number((inserted as any)?.id);
	if (!Number.isFinite(suggestionId)) {
		return json({ error: 'Failed to create suggestion' }, { status: 400 });
	}

	// Admin submissions: apply immediately and mark approved (skip the moderation queue).
	if (isAdmin) {
		const supabase = createSupabaseServiceClient();
		try {
			if (payload) {
				const effectivePatch: MediaPatch = payload as any;
				if (kind === 'new_season') {
					await applyNewSeason(supabase, mediaId, (effectivePatch as any).season ?? effectivePatch);
				} else if (kind === 'new_episode') {
					await applyNewEpisode(supabase, mediaId, (effectivePatch as any).episode ?? effectivePatch);
				} else {
					await applyMediaPatch(supabase, mediaId, effectivePatch);
				}
			}

			const { error: updateError } = await (supabase as any)
				.from('content_suggestions')
				.update({
					status: 'approved',
					processed_at: new Date().toISOString(),
					processed_by: user?.id ?? null
				})
				.eq('id', suggestionId);
			if (updateError) {
				return json({ error: updateError.message }, { status: 400 });
			}
		} catch (err: any) {
			return json({ error: err?.message || 'Failed to apply admin suggestion' }, { status: 400 });
		}
	}

	return json({ ok: true, id: suggestionId, status: isAdmin ? 'approved' : 'pending' });
};
