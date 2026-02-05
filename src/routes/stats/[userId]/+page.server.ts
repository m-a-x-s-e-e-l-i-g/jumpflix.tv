import { error } from '@sveltejs/kit';

const UUID_RE =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const load = async ({ params, locals, setHeaders }) => {
	const userId = params.userId;
	if (!UUID_RE.test(userId)) throw error(404, 'Not found');

	const { user: viewer } = await locals.safeGetSession();

	setHeaders({
		'x-robots-tag': 'noindex, nofollow'
	});

	const supabase = locals.supabase;

	const [overviewRes, distRes, ratedRes, watchedNotRatedRes] = await Promise.all([
		supabase.rpc('user_stats_overview', { target_user: userId }),
		supabase.rpc('user_ratings_distribution', { target_user: userId }),
		supabase.rpc('user_rated_media', { target_user: userId }),
		supabase.rpc('user_watched_not_rated', { target_user: userId, limit_n: 50 })
	]);

	const rpcErrors = [overviewRes.error, distRes.error, ratedRes.error, watchedNotRatedRes.error].filter(
		(e): e is NonNullable<typeof e> => Boolean(e)
	);
	if (rpcErrors.length > 0) {
		const message = rpcErrors.map((e) => e.message).join(' | ');
		if (message.includes('Could not find the function') || message.includes('user_stats_overview')) {
			throw error(
				500,
				'Missing stats SQL functions in Supabase. Apply the migration supabase/migrations/20260204000000_add_user_stats_functions.sql to your Supabase project.'
			);
		}
		throw error(500, message);
	}

	const overview = (overviewRes.data ?? null) as any;
	if (!overview?.found) throw error(404, 'User not found');

	const username: string = String(overview.username ?? 'User');

	type RatingDistRow = { rating: number; count: number };
	const distRows = ((distRes.data ?? []) as any[]) ?? [];
	const ratingDistribution: RatingDistRow[] = distRows.map((row) => ({
		rating: Number(row.rating) || 0,
		count: Number(row.count) || 0
	}));

	const ratedRows = ((ratedRes.data ?? []) as any[]) ?? [];
	const ratedItems = (ratedRows as Array<{
		media_id: number;
		rating: number;
		updated_at: string;
		type: string;
		title: string;
		slug: string;
	}>).map((r) => ({
		id: Number(r.media_id) || 0,
		rating: Number(r.rating) || 0,
		updated_at: String(r.updated_at ?? ''),
		title: String(r.title ?? ''),
		type: String(r.type ?? ''),
		href: `/${String(r.type ?? '')}/${String(r.slug ?? '')}`
	}));

	const watchedRows = ((watchedNotRatedRes.data ?? []) as any[]) ?? [];
	const watchedButNotRated = (watchedRows as Array<{
		id: number;
		type: string;
		title: string;
		slug: string;
		last_watched: string;
	}>).map((item) => ({
		id: Number(item.id) || 0,
		title: String(item.title ?? ''),
		type: String(item.type ?? ''),
		href: `/${String(item.type ?? '')}/${String(item.slug ?? '')}`
	}));

	let suggestionsCount: number | null = null;
	if (viewer?.id && viewer.id === userId) {
		const { count, error: suggestionsError } = await (supabase as any)
			.from('content_suggestions')
			.select('id', { count: 'exact', head: true })
			.eq('created_by', userId);
		if (!suggestionsError) {
			suggestionsCount = count ?? 0;
		}
	}

	return {
		username,
		userId,
		stats: {
			averageRating: Number(overview.average_rating) || 0,
			ratingCount: Number(overview.ratings_count) || 0,
			suggestionsCount,
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
			watchedButNotRated
		}
	};
};
