import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { error } from '@sveltejs/kit';
import { calculateUserXp } from '$lib/xp';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type WatchedButNotRatedItem = {
	id: number;
	title: string;
	type: string;
	href: string;
	lastWatched: string;
};

function firstNonEmptyString(...values: unknown[]): string {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}

	return '';
}

function getEmailPrefix(email: unknown): string {
	const normalizedEmail = firstNonEmptyString(email);
	if (!normalizedEmail) return '';

	return normalizedEmail.split('@')[0]?.trim() || '';
}

function parseWatchedItemId(mediaId: unknown, mediaType: unknown): number | null {
	if (mediaType !== 'movie' && mediaType !== 'series') return null;
	if (typeof mediaId !== 'string') return null;

	const trimmed = mediaId.trim();
	if (!trimmed) return null;

	const directMatch = trimmed.match(/^\d+$/);
	if (directMatch) {
		const parsed = Number.parseInt(trimmed, 10);
		return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
	}

	const prefixedMatch = trimmed.match(/^(movie|series):(\d+)(?::|$)/i);
	if (!prefixedMatch) return null;

	const parsed = Number.parseInt(prefixedMatch[2], 10);
	if (!Number.isSafeInteger(parsed) || parsed <= 0) return null;

	return parsed;
}

async function loadWatchedButNotRated(supabase: any, userId: string) {
	const { data: watchRows, error: watchError } = await supabase
		.from('watch_history')
		.select('media_id, media_type, updated_at')
		.eq('user_id', userId)
		.eq('status', 'active')
		.eq('is_watched', true)
		.in('media_type', ['movie', 'series']);

	if (watchError) {
		throw error(500, watchError.message);
	}

	const lastWatchedByItemId = new Map<number, string>();
	for (const row of watchRows ?? []) {
		const itemId = parseWatchedItemId(row.media_id, row.media_type);
		if (!itemId) continue;
		const updatedAt = String(row.updated_at ?? '');
		const previous = lastWatchedByItemId.get(itemId);
		if (!previous || updatedAt > previous) {
			lastWatchedByItemId.set(itemId, updatedAt);
		}
	}

	const itemIds = Array.from(lastWatchedByItemId.keys());
	if (itemIds.length === 0) return [];

	const { data: ratingRows, error: ratingsError } = await supabase
		.from('ratings')
		.select('media_id')
		.eq('user_id', userId)
		.in('media_id', itemIds);

	if (ratingsError) {
		throw error(500, ratingsError.message);
	}

	const ratedIds = new Set(
		(ratingRows ?? [])
			.map((row: { media_id: unknown }) => Number(row.media_id))
			.filter((id: number) => Number.isFinite(id))
	);

	const unwatchedRatedIds = itemIds.filter((itemId) => !ratedIds.has(itemId));
	if (unwatchedRatedIds.length === 0) return [];

	const { data: mediaRows, error: mediaError } = await supabase
		.from('media_items')
		.select('id, type, title, slug')
		.in('id', unwatchedRatedIds);

	if (mediaError) {
		throw error(500, mediaError.message);
	}

	const watchedItems: Array<WatchedButNotRatedItem | null> = (mediaRows ?? [])
		.map((item: { id: unknown; title: unknown; type: unknown; slug: unknown }) => {
			const id = Number(item.id);
			if (!Number.isFinite(id) || ratedIds.has(id)) return null;
			return {
				id,
				title: String(item.title ?? ''),
				type: String(item.type ?? ''),
				href: `/${String(item.type ?? '')}/${String(item.slug ?? '')}`,
				lastWatched: lastWatchedByItemId.get(id) ?? ''
			};
		});

	return watchedItems
		.filter((item: WatchedButNotRatedItem | null): item is WatchedButNotRatedItem => Boolean(item))
		.sort((a, b) => b.lastWatched.localeCompare(a.lastWatched))
		.slice(0, 50);
}

export const load = async ({ params, locals, setHeaders }) => {
	const userId = params.userId;
	if (!UUID_RE.test(userId)) throw error(404, 'Not found');

	const { user: viewer } = await locals.safeGetSession();

	setHeaders({
		'x-robots-tag': 'noindex, nofollow'
	});

	const supabase = locals.supabase;
	const serviceSupabase = createSupabaseServiceClient();

	const [overviewRes, distRes, ratedRes, watchedNotRatedRes, reviewsRes] = await Promise.all([
		supabase.rpc('user_stats_overview', { target_user: userId }),
		supabase.rpc('user_ratings_distribution', { target_user: userId }),
		supabase.rpc('user_rated_media', { target_user: userId }),
		loadWatchedButNotRated(serviceSupabase, userId),
		(supabase as any)
			.from('reviews')
			.select('id, media_id, body, created_at, updated_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(20)
	]);

	const rpcErrors = [
		overviewRes.error,
		distRes.error,
		ratedRes.error
	].filter((e): e is NonNullable<typeof e> => Boolean(e));
	if (rpcErrors.length > 0) {
		const message = rpcErrors.map((e) => e.message).join(' | ');
		if (
			message.includes('Could not find the function') ||
			message.includes('user_stats_overview')
		) {
			throw error(
				500,
				'Missing stats SQL functions in Supabase. Apply the migration supabase/migrations/20260204000000_add_user_stats_functions.sql to your Supabase project.'
			);
		}
		throw error(500, message);
	}

	if (reviewsRes.error) {
		throw error(500, reviewsRes.error.message);
	}

	const overview = (overviewRes.data ?? null) as any;
	if (!overview?.found) throw error(404, 'User not found');

	let username = firstNonEmptyString(overview.username);
	try {
		const { data: authUserData, error: authUserError } = await (serviceSupabase as any).auth.admin.getUserById(userId);
		if (authUserError) {
			console.error('[stats:user] Failed to load auth user for username fallback:', authUserError.message);
		} else {
			const authUser = authUserData?.user;
			username =
				firstNonEmptyString(
					authUser?.user_metadata?.name,
					authUser?.user_metadata?.username,
					getEmailPrefix(authUser?.email),
					username
				) || 'User';
		}
	} catch (authUserError) {
		console.error('[stats:user] Failed to resolve username fallback:', authUserError);
	}

	username ||= 'User';
	const isOwnProfile = viewer?.id === userId;

	type RatingDistRow = { rating: number; count: number };
	const distRows = (distRes.data ?? []) as any[];
	const ratingDistribution: RatingDistRow[] = distRows.map((row) => ({
		rating: Number(row.rating) || 0,
		count: Number(row.count) || 0
	}));

	const ratedRows = (ratedRes.data ?? []) as any[];
	const ratedItems = (
		ratedRows as Array<{
			media_id: number;
			rating: number;
			updated_at: string;
			type: string;
			title: string;
			slug: string;
		}>
	).map((r) => ({
		id: Number(r.media_id) || 0,
		rating: Number(r.rating) || 0,
		updated_at: String(r.updated_at ?? ''),
		title: String(r.title ?? ''),
		type: String(r.type ?? ''),
		href: `/${String(r.type ?? '')}/${String(r.slug ?? '')}`
	}));

	const watchedButNotRated = watchedNotRatedRes.map((item: WatchedButNotRatedItem) => ({
		id: Number(item.id) || 0,
		title: String(item.title ?? ''),
		type: String(item.type ?? ''),
		href: String(item.href ?? '')
	}));

	const reviewRows = (reviewsRes.data ?? []) as any[];
	const reviewMediaIds = Array.from(
		new Set(reviewRows.map((r) => Number(r.media_id)).filter((id) => Number.isFinite(id)))
	);

	let mediaById = new Map<number, any>();
	if (reviewMediaIds.length) {
		const { data: mediaRows, error: mediaError } = await (supabase as any)
			.from('media_items')
			.select('id, title, slug, type')
			.in('id', reviewMediaIds);
		if (mediaError) throw error(500, mediaError.message);
		for (const row of mediaRows ?? []) {
			mediaById.set(Number(row.id), row);
		}
	}

	const recentReviews = reviewRows.map((row) => {
		const mediaId = Number(row.media_id) || 0;
		const media = mediaById.get(mediaId) ?? null;
		return {
			id: Number(row.id) || 0,
			body: String(row.body ?? ''),
			created_at: String(row.created_at ?? ''),
			updated_at: String(row.updated_at ?? ''),
			media: media
				? {
					id: Number(media.id) || 0,
					title: String(media.title ?? ''),
					type: String(media.type ?? ''),
					href: `/${String(media.type ?? '')}/${String(media.slug ?? '')}`
				}
				: null
		};
	});

	let suggestionsCount: number | null = null;
	let suggestionStatusCounts: { approved: number; pending: number; rejected: number } | null = null;

	const approvedRes = await (serviceSupabase as any)
		.from('content_suggestions')
		.select('xp_units')
		.eq('created_by', userId)
		.eq('status', 'approved');

	if (!approvedRes.error) {
		const approvedCount = Array.isArray(approvedRes.data) ? approvedRes.data.length : 0;
		const contributionXpUnits = ((approvedRes.data as Array<{ xp_units?: unknown }> | null) ?? [])
			.reduce((sum, row) => {
				const units = typeof row.xp_units === 'number' && row.xp_units >= 1 ? Math.floor(row.xp_units) : 1;
				return sum + units;
			}, 0);

		suggestionsCount = contributionXpUnits;

		if (isOwnProfile) {
			const [pendingRes, rejectedRes] = await Promise.all([
				(serviceSupabase as any)
					.from('content_suggestions')
					.select('id', { count: 'exact', head: true })
					.eq('created_by', userId)
					.eq('status', 'pending'),
				(serviceSupabase as any)
					.from('content_suggestions')
					.select('id', { count: 'exact', head: true })
					.eq('created_by', userId)
					.eq('status', 'rejected')
			]);

			if (!pendingRes.error && !rejectedRes.error) {
				suggestionStatusCounts = {
					approved: approvedCount,
					pending: pendingRes.count ?? 0,
					rejected: rejectedRes.count ?? 0
				};
			}
		}
	}

	const xp = calculateUserXp({
		watchingCount: Number(overview.watched_items) || 0,
		ratingCount: Number(overview.ratings_count) || 0,
		reviewingCount: Number(overview.reviews_count) || 0,
		contributionsCount: suggestionsCount ?? 0
	});

	return {
		username,
		userId,
		isOwnProfile,
		stats: {
			xp,
			averageRating: Number(overview.average_rating) || 0,
			ratingCount: Number(overview.ratings_count) || 0,
			reviewsCount: Number(overview.reviews_count) || 0,
			suggestionsCount,
			suggestionStatusCounts,
			watchedCount: Number(overview.watched_items) || 0,
			watchedEpisodesCount: Number(overview.watched_episodes) || 0,
			watchedMoviesCount: Number(overview.watched_movies) || 0,
			watchedSeriesCount: Number(overview.watched_series) || 0,
			catalogTotals: {
				movies: Number(overview.catalog_movies) || 0,
				episodes: Number(overview.catalog_episodes) || 0
			},
			totalPositionSeconds: Number(overview.total_position_seconds) || 0,
			totalDurationSeconds: Number(overview.total_duration_seconds) || 0,
			avgPercentWatched: Number(overview.avg_percent_watched) || 0,
			ratingDistribution,
			ratedItems,
			watchedButNotRated,
			recentReviews
		}
	};
};
