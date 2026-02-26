import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isAdminUser } from '$lib/server/admin';
import { invalidateContentCache } from '$lib/server/content-service';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import {
	applyMediaPatch,
	applyNewEpisode,
	applyNewSeason,
	type MediaPatch
} from '$lib/server/content-suggestions';
import { trySendTelegramMessage } from '$lib/server/telegram';
import { normalizeParkourSpotId } from '$lib/utils';

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
			return json(
				{ error: 'seasonNumber and episodeNumber are required for episode suggestions' },
				{ status: 400 }
			);
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
		let didMutateContent = false;
		try {
			if (payload) {
				if (kind === 'spot_chapter') {
					const patchAny = payload as any;
						const spotIdRaw = asTrimmedString(patchAny?.spotId ?? patchAny?.spot_id);
						const spotId = spotIdRaw ? normalizeParkourSpotId(spotIdRaw) : null;
					const startSeconds = asSafeInt(patchAny?.startSeconds ?? patchAny?.start_seconds);
					const endSeconds = asSafeInt(patchAny?.endSeconds ?? patchAny?.end_seconds);
					const playbackKey = asTrimmedString(patchAny?.playbackKey ?? patchAny?.playback_key);
					const spotChapterId = asSafeInt(patchAny?.spotChapterId ?? patchAny?.spot_chapter_id);
					if (!spotId || startSeconds === null || endSeconds === null) {
						return json(
							{ error: 'Missing spotId/startSeconds/endSeconds' },
							{ status: 400 }
						);
					}
					if (endSeconds <= startSeconds) {
						return json(
							{ error: 'endSeconds must be greater than startSeconds' },
							{ status: 400 }
						);
					}
					if (mediaType === 'series' && !playbackKey) {
						return json({ error: 'playbackKey is required for series spot chapters' }, { status: 400 });
					}

					if (spotChapterId) {
						const { data: updated, error: updateSpotChapterError } = await (supabase as any)
							.from('spot_chapters')
							.update({
								spot_id: spotId,
									start_seconds: startSeconds,
									end_seconds: endSeconds,
								created_from_suggestion_id: suggestionId,
								approved_by: user.id,
								approved_at: new Date().toISOString()
							})
							.eq('id', spotChapterId)
							.eq('media_id', mediaId)
							.eq('media_type', mediaType)
							.eq('playback_key', mediaType === 'series' ? playbackKey : '')
							.select('id');

						if (updateSpotChapterError) {
							return json({ error: updateSpotChapterError.message }, { status: 400 });
						}
						if (!Array.isArray(updated) || updated.length === 0) {
							return json({ error: 'Spot chapter not found for update' }, { status: 400 });
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
									created_from_suggestion_id: suggestionId,
									approved_by: user.id,
									approved_at: new Date().toISOString()
								},
								{ onConflict: 'created_from_suggestion_id' }
							);
						if (spotChapterError) {
							return json({ error: spotChapterError.message }, { status: 400 });
						}
						didMutateContent = true;
					}
				} else {
					const effectivePatch: MediaPatch = payload as any;
					if (kind === 'new_season') {
						await applyNewSeason(
							supabase,
							mediaId,
							(effectivePatch as any).season ?? effectivePatch
						);
						didMutateContent = true;
					} else if (kind === 'new_episode') {
						await applyNewEpisode(
							supabase,
							mediaId,
							(effectivePatch as any).episode ?? effectivePatch
						);
						didMutateContent = true;
					} else {
						await applyMediaPatch(supabase, mediaId, effectivePatch);
						didMutateContent = true;
					}
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
				if (didMutateContent) {
					await invalidateContentCache();
				}
				return json({ error: updateError.message }, { status: 400 });
			}

			if (didMutateContent) {
				await invalidateContentCache();
			}
		} catch (err: any) {
			if (didMutateContent) {
				await invalidateContentCache();
			}
			return json({ error: err?.message || 'Failed to apply admin suggestion' }, { status: 400 });
		}
	}

	// Non-admin submissions: notify via Telegram when it enters the pending queue.
	if (!isAdmin) {
		const adminUrl = `${url.origin}/admin/suggestions?id=${suggestionId}`;
		const scope = targetScope === 'episode' ? `episode S${seasonNumber}E${episodeNumber}` : 'media';
		const notePreview = note ? note.slice(0, 200) : '';
		const messageLines = [
			`New pending content suggestion #${suggestionId}`,
			adminUrl,
			`${mediaType} · ${kind} · ${scope}`,
			notePreview ? `Note: ${notePreview}${(note?.length ?? 0) > 200 ? '…' : ''}` : null
		].filter(Boolean);

		await trySendTelegramMessage(messageLines.join('\n'), { disableWebPagePreview: true });
	}

	return json({ ok: true, id: suggestionId, status: isAdmin ? 'approved' : 'pending' });
};
