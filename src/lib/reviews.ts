import { supabase } from '$lib/supabaseClient';

export type ReviewRow = {
	id: number;
	user_id: string;
	media_id: number;
	author_name: string | null;
	body: string;
	created_at: string;
	updated_at: string;
};

function normalizeMediaId(mediaId: number | string): number {
	const n = typeof mediaId === 'number' ? mediaId : Number(mediaId);
	if (!Number.isFinite(n)) throw new Error('Invalid media id');
	return n;
}

export async function fetchMediaReviews(mediaId: number | string, limit = 20): Promise<ReviewRow[]> {
	const normalizedId = normalizeMediaId(mediaId);
	const { data, error } = await (supabase as any)
		.from('reviews')
		.select('id, user_id, media_id, author_name, body, created_at, updated_at')
		.eq('media_id', normalizedId)
		.order('created_at', { ascending: false })
		.limit(Math.max(1, Math.min(200, limit)));

	if (error) throw new Error(error.message);
	return (data ?? []) as ReviewRow[];
}

export async function fetchUserReview(mediaId: number | string, userId: string): Promise<ReviewRow | null> {
	const normalizedId = normalizeMediaId(mediaId);
	if (!userId) return null;

	const { data, error } = await (supabase as any)
		.from('reviews')
		.select('id, user_id, media_id, author_name, body, created_at, updated_at')
		.eq('media_id', normalizedId)
		.eq('user_id', userId)
		.maybeSingle();

	if (error) throw new Error(error.message);
	return (data ?? null) as ReviewRow | null;
}

export async function upsertReview(params: {
	mediaId: number | string;
	userId: string;
	body: string;
	authorName?: string | null;
}): Promise<ReviewRow> {
	const normalizedId = normalizeMediaId(params.mediaId);
	const userId = params.userId;
	if (!userId) throw new Error('Not authenticated');

	const body = String(params.body ?? '').trim();
	if (!body) throw new Error('Review cannot be empty');

	const clampedBody = body.length > 2000 ? body.slice(0, 2000) : body;
	const authorName = (params.authorName ?? null) ? String(params.authorName).trim().slice(0, 80) : null;

	const { data, error } = await (supabase as any)
		.from('reviews')
		.upsert(
			{
				media_id: normalizedId,
				user_id: userId,
				author_name: authorName,
				body: clampedBody
			},
			{ onConflict: 'user_id,media_id' }
		)
		.select('id, user_id, media_id, author_name, body, created_at, updated_at')
		.single();

	if (error) throw new Error(error.message);
	return data as ReviewRow;
}

export async function deleteReview(reviewId: number): Promise<void> {
	const id = Number(reviewId);
	if (!Number.isFinite(id)) throw new Error('Invalid review id');
	const { error } = await (supabase as any).from('reviews').delete().eq('id', id);
	if (error) throw new Error(error.message);
}
