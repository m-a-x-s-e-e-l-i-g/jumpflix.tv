import { loadPublicFundingData } from '$lib/server/funding';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { calculateUserXp } from '$lib/xp';
import { error } from '@sveltejs/kit';

export const load = async ({ parent, setHeaders }) => {
	const parentData = await parent();
	setHeaders({
		'Cache-Control': 'private, no-store',
		'CDN-Cache-Control': 'no-store',
		'Netlify-CDN-Cache-Control': 'no-store',
		Vary: 'Cookie'
	});

	const supabase = createSupabaseServiceClient();

	type TopWatchedRpcRow = {
		media_id: string;
		media_type: string;
		watchers: number;
		avg_percent: number;
	};

	type WatchHistoryTopRow = {
		user_id: string;
		media_id: string;
		media_type: string;
		percent_watched: number | null;
	};

	type EnrichedTopWatchedRow = TopWatchedRpcRow & {
		title: string;
		href: string | null;
		subtitle: string | null;
	};

	function parseMediaKey(
		key: string
	):
		| { kind: 'movie'; itemId: number }
		| { kind: 'series'; itemId: number }
		| { kind: 'episode'; seriesId: number; episodeVideoId: string }
		| null {
		const parts = String(key).split(':');
		if (parts.length < 2) return null;
		const baseType = parts[0];
		const id = Number(parts[1]);
		if (!Number.isFinite(id) || id <= 0) return null;

		const epIndex = parts.indexOf('ep');
		if (epIndex >= 0 && parts[epIndex + 1]) {
			return { kind: 'episode', seriesId: id, episodeVideoId: parts[epIndex + 1] };
		}

		if (baseType === 'movie') {
			return { kind: 'movie', itemId: id };
		}
		if (baseType === 'series') {
			return { kind: 'series', itemId: id };
		}

		return null;
	}

	const [overviewRes, activityRes, ratingsDistRes, topWatchHistoryRes, topContributorsRes] =
		await Promise.all([
		supabase.rpc('admin_stats_overview'),
		supabase.rpc('admin_watch_activity', { days: 30 }),
		supabase.rpc('admin_ratings_distribution'),
		supabase
			.from('watch_history')
			.select('user_id, media_id, media_type, percent_watched')
			.eq('status', 'active'),
		(supabase as any)
			.from('watch_history')
			.select('user_id')
			.eq('status', 'active')
			.eq('is_watched', true)
	]);
	const [ratingsByUserRes, reviewsByUserRes, suggestionsByUserRes] = await Promise.all([
		(supabase as any).from('ratings').select('user_id'),
		(supabase as any).from('reviews').select('user_id'),
		(supabase as any)
			.from('content_suggestions')
			.select('created_by')
			.eq('status', 'approved')
			.not('created_by', 'is', null)
	]);
	const funding = await loadPublicFundingData();

	const rpcErrors = [
		overviewRes.error,
		activityRes.error,
		ratingsDistRes.error,
		topContributorsRes.error,
		ratingsByUserRes.error,
		reviewsByUserRes.error,
		suggestionsByUserRes.error
	].filter((e): e is NonNullable<typeof e> => Boolean(e));
	if (rpcErrors.length > 0) {
		const message = rpcErrors.map((e) => e.message).join(' | ');
		if (message.includes('Could not find the function')) {
			throw error(
				500,
				'Missing stats SQL functions in Supabase. Apply these migrations to your Supabase project: supabase/migrations/20260128000000_add_admin_stats_functions.sql and supabase/migrations/20260213000001_add_review_stats.sql.'
			);
		}
		throw error(500, message);
	}
	if (topWatchHistoryRes.error) {
		throw error(500, topWatchHistoryRes.error.message);
	}

	const [moviesCountRes, seriesCountRes, episodesCountRes] = await Promise.all([
		supabase.from('media_items').select('id', { count: 'exact', head: true }).eq('type', 'movie'),
		supabase.from('media_items').select('id', { count: 'exact', head: true }).eq('type', 'series'),
		supabase.from('series_episodes').select('id', { count: 'exact', head: true })
	]);

	const [tracksCountRes, trackLinksCountRes] = await Promise.all([
		supabase.from('songs').select('id', { count: 'exact', head: true }),
		supabase.from('video_songs').select('id', { count: 'exact', head: true })
	]);

	const spotChaptersCountRes = await (supabase as any)
		.from('spot_chapters')
		.select('id', { count: 'exact', head: true });

	let spotChaptersCountError = spotChaptersCountRes.error;
	let spotChaptersCount = spotChaptersCountRes.count ?? 0;
	if (spotChaptersCountError) {
		const msg = String(spotChaptersCountError.message ?? '').toLowerCase();
		if (msg.includes('spot_chapters') && (msg.includes('does not exist') || msg.includes('relation'))) {
			spotChaptersCountError = null;
			spotChaptersCount = 0;
		}
	}

	const countErrors = [
		moviesCountRes.error,
		seriesCountRes.error,
		episodesCountRes.error,
		tracksCountRes.error,
		trackLinksCountRes.error,
		spotChaptersCountError
	].filter((e): e is NonNullable<typeof e> => Boolean(e));
	if (countErrors.length > 0) {
		throw error(500, countErrors.map((e) => e.message).join(' | '));
	}

	const catalog = {
		movies: moviesCountRes.count ?? 0,
		series: seriesCountRes.count ?? 0,
		episodes: episodesCountRes.count ?? 0
	};

	const music = {
		tracks: tracksCountRes.count ?? 0,
		trackLinks: trackLinksCountRes.count ?? 0
	};

	const spots = {
		approvedSpotChapters: spotChaptersCount
	};

	type FacetCountRow = { key: string; count: number };
	const bump = (map: Map<string, number>, key: unknown) => {
		if (typeof key !== 'string') return;
		const normalized = key.trim();
		if (!normalized) return;
		map.set(normalized, (map.get(normalized) ?? 0) + 1);
	};
	const topN = (map: Map<string, number>, n = 10): FacetCountRow[] => {
		return Array.from(map.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, Math.max(1, n))
			.map(([key, count]) => ({ key, count }));
	};

	const { data: facetRows, error: facetsError } = await supabase
		.from('media_items')
		.select(
			'facet_type, facet_environment, facet_focus, facet_production, facet_presentation, facet_medium, facet_movement, type, creators, starring, year'
		);
	if (facetsError) throw error(500, facetsError.message);

	const facetTypeCounts = new Map<string, number>();
	const environmentCounts = new Map<string, number>();
	const focusCounts = new Map<string, number>();
	const productionCounts = new Map<string, number>();
	const presentationCounts = new Map<string, number>();
	const mediumCounts = new Map<string, number>();
	const movementCounts = new Map<string, number>();
	const movieCounts = { movies: 0, series: 0 };
	const creatorNames = new Set<string>();
	const athleteNames = new Set<string>();
	let minYear: number | null = null;
	let maxYear: number | null = null;

	const addNames = (set: Set<string>, values: unknown) => {
		if (!Array.isArray(values)) return;
		for (const v of values) {
			if (typeof v !== 'string') continue;
			const normalized = v.trim();
			if (!normalized) continue;
			set.add(normalized.toLowerCase());
		}
	};
	const considerYear = (value: unknown) => {
		if (typeof value !== 'string') return;
		const match = value.match(/\b(19\d{2}|20\d{2})\b/g);
		if (!match) return;
		for (const m of match) {
			const y = Number(m);
			if (!Number.isFinite(y)) continue;
			minYear = minYear === null ? y : Math.min(minYear, y);
			maxYear = maxYear === null ? y : Math.max(maxYear, y);
		}
	};

	for (const row of facetRows ?? []) {
		if (row.type === 'movie') movieCounts.movies += 1;
		if (row.type === 'series') movieCounts.series += 1;
		bump(facetTypeCounts, row.facet_type);
		bump(environmentCounts, row.facet_environment);
		bump(focusCounts, (row as any).facet_focus);
		bump(productionCounts, (row as any).facet_production);
		bump(presentationCounts, (row as any).facet_presentation);
		bump(mediumCounts, (row as any).facet_medium);
		for (const movement of row.facet_movement ?? []) bump(movementCounts, movement);
		addNames(creatorNames, (row as any).creators);
		addNames(athleteNames, (row as any).starring);
		considerYear((row as any).year);
	}

	const peopleStats = {
		creators: creatorNames.size,
		athletes: athleteNames.size
	};
	const yearsCovered = {
		min: minYear,
		max: maxYear
	};
	const fundingSummary = funding.summary;

	const facetStats = {
		contentCounts: movieCounts,
		facetType: topN(facetTypeCounts, 10),
		environment: topN(environmentCounts, 10),
		focus: topN(focusCounts, 10),
		production: topN(productionCounts, 10),
		presentation: topN(presentationCounts, 10),
		medium: topN(mediumCounts, 10),
		movement: topN(movementCounts, 10)
	};

	const topWatchMap = new Map<
		string,
		{
			media_id: string;
			media_type: string;
			watcherIds: Set<string>;
			totalPercent: number;
			percentSamples: number;
		}
	>();
	const watchHistoryRows = ((topWatchHistoryRes.data as any[]) ?? []) as WatchHistoryTopRow[];
	for (const row of watchHistoryRows) {
		const parsedKey = parseMediaKey(row.media_id);
		const canonicalMediaId = parsedKey
			? parsedKey.kind === 'movie'
				? `movie:${parsedKey.itemId}`
				: `series:${parsedKey.kind === 'series' ? parsedKey.itemId : parsedKey.seriesId}`
			: String(row.media_id ?? '');
		const canonicalMediaType = parsedKey
			? parsedKey.kind === 'movie'
				? 'movie'
				: 'series'
			: String(row.media_type ?? '');

		const aggregate = topWatchMap.get(canonicalMediaId) ?? {
			media_id: canonicalMediaId,
			media_type: canonicalMediaType,
			watcherIds: new Set<string>(),
			totalPercent: 0,
			percentSamples: 0
		};

		if (row.user_id) {
			aggregate.watcherIds.add(String(row.user_id));
		}
		if (typeof row.percent_watched === 'number' && Number.isFinite(row.percent_watched)) {
			aggregate.totalPercent += row.percent_watched;
			aggregate.percentSamples += 1;
		}

		topWatchMap.set(canonicalMediaId, aggregate);
	}

	const rawTop: TopWatchedRpcRow[] = Array.from(topWatchMap.values())
		.map((entry) => ({
			media_id: entry.media_id,
			media_type: entry.media_type,
			watchers: entry.watcherIds.size,
			avg_percent: entry.percentSamples > 0 ? Number((entry.totalPercent / entry.percentSamples).toFixed(1)) : 0
		}))
		.sort((a, b) => b.watchers - a.watchers || b.avg_percent - a.avg_percent)
		.slice(0, 10);

	const parsed = rawTop
		.map((row) => ({ row, parsed: parseMediaKey(row.media_id) }))
		.filter(
			(
				entry
			): entry is {
				row: TopWatchedRpcRow;
				parsed: NonNullable<ReturnType<typeof parseMediaKey>>;
			} => Boolean(entry.parsed)
		);

	const movieIds = Array.from(
		new Set(
			parsed
				.filter((entry) => entry.parsed.kind === 'movie')
				.map((entry) => (entry.parsed.kind === 'movie' ? entry.parsed.itemId : null))
				.filter((id): id is number => typeof id === 'number')
		)
	);
	const seriesIds = Array.from(
		new Set(
			parsed
				.filter((entry) => entry.parsed.kind === 'series')
				.map((entry) => (entry.parsed.kind === 'series' ? entry.parsed.itemId : null))
				.filter((id): id is number => typeof id === 'number')
		)
	);
	const titleByMovieId = new Map<number, { title: string; slug: string }>();
	const titleBySeriesId = new Map<number, { title: string; slug: string }>();

	if (movieIds.length > 0 || seriesIds.length > 0) {
		const ids = Array.from(new Set([...movieIds, ...seriesIds]));
		const { data, error: mediaError } = await supabase
			.from('media_items')
			.select('id, type, title, slug')
			.in('id', ids);
		if (mediaError) throw error(500, mediaError.message);
		for (const row of data ?? []) {
			if (row.type === 'movie') titleByMovieId.set(row.id, { title: row.title, slug: row.slug });
			if (row.type === 'series') titleBySeriesId.set(row.id, { title: row.title, slug: row.slug });
		}
	}

	const topWatchedMedia: EnrichedTopWatchedRow[] = rawTop.map((row) => {
		const parsedKey = parseMediaKey(row.media_id);
		if (!parsedKey) {
			return {
				...row,
				title: row.media_id,
				href: null,
				subtitle: null
			};
		}

		if (parsedKey.kind === 'movie') {
			const movie = titleByMovieId.get(parsedKey.itemId);
			return {
				...row,
				title: movie?.title ?? `Movie #${parsedKey.itemId}`,
				href: movie?.slug ? `/movie/${movie.slug}` : null,
				subtitle: null
			};
		}

		if (parsedKey.kind === 'series') {
			const series = titleBySeriesId.get(parsedKey.itemId);
			return {
				...row,
				title: series?.title ?? `Series #${parsedKey.itemId}`,
				href: series?.slug ? `/series/${series.slug}` : null,
				subtitle: null
			};
		}

		return {
			...row,
			title: row.media_id,
			href: null,
			subtitle: null
		};
	});

	type UserCountMap = Map<string, number>;
	const incrementUserCount = (map: UserCountMap, userId: unknown) => {
		if (typeof userId !== 'string') return;
		const normalized = userId.trim();
		if (!normalized) return;
		map.set(normalized, (map.get(normalized) ?? 0) + 1);
	};

	const watchedCounts = new Map<string, number>();
	for (const row of (topContributorsRes.data as Array<{ user_id: unknown }> | null) ?? []) {
		incrementUserCount(watchedCounts, row.user_id);
	}

	const ratingsCounts = new Map<string, number>();
	for (const row of (ratingsByUserRes.data as Array<{ user_id: unknown }> | null) ?? []) {
		incrementUserCount(ratingsCounts, row.user_id);
	}

	const reviewsCounts = new Map<string, number>();
	for (const row of (reviewsByUserRes.data as Array<{ user_id: unknown }> | null) ?? []) {
		incrementUserCount(reviewsCounts, row.user_id);
	}

	const suggestionCounts = new Map<string, number>();
	for (const row of (suggestionsByUserRes.data as Array<{ created_by: unknown }> | null) ?? []) {
		incrementUserCount(suggestionCounts, row.created_by);
	}

	const contributorUserIds = Array.from(
		new Set([
			...watchedCounts.keys(),
			...ratingsCounts.keys(),
			...reviewsCounts.keys(),
			...suggestionCounts.keys()
		])
	);

	const usernameById = new Map<string, string>();
	if (contributorUserIds.length > 0) {
		try {
			const unresolvedIds = new Set(contributorUserIds);
			const perPage = 1000;
			let page = 1;

			while (unresolvedIds.size > 0) {
				const { data, error: listUsersError } = await (supabase as any).auth.admin.listUsers({
					page,
					perPage
				});
				if (listUsersError) {
					console.error('[stats] Failed to list users for XP leaderboard:', listUsersError.message);
					break;
				}

				const users = data?.users ?? [];
				if (users.length === 0) break;

				for (const listedUser of users) {
					const listedUserId = String(listedUser.id ?? '');
					if (!unresolvedIds.has(listedUserId)) continue;
					const emailLocalPart =
						typeof listedUser.email === 'string' && listedUser.email.trim()
							? listedUser.email.trim().split('@')[0]?.trim() || ''
							: '';
					const username =
						typeof listedUser.user_metadata?.name === 'string' && listedUser.user_metadata.name.trim()
							? listedUser.user_metadata.name.trim()
							: typeof listedUser.user_metadata?.username === 'string' && listedUser.user_metadata.username.trim()
								? listedUser.user_metadata.username.trim()
								: emailLocalPart
									? emailLocalPart
									: 'User';
					usernameById.set(listedUserId, username);
					unresolvedIds.delete(listedUserId);
				}

				if (users.length < perPage) break;
				page += 1;
			}
		} catch (listUsersError) {
			console.error('[stats] Failed to build XP leaderboard usernames:', listUsersError);
		}
	}

	const topContributors = contributorUserIds
		.map((userId) => {
			const watched_count = watchedCounts.get(userId) ?? 0;
			const ratings_count = ratingsCounts.get(userId) ?? 0;
			const reviews_count = reviewsCounts.get(userId) ?? 0;
			const suggestions_count = suggestionCounts.get(userId) ?? 0;
			const xp = calculateUserXp({
				watchingCount: watched_count,
				ratingCount: ratings_count,
				reviewingCount: reviews_count,
				contributionsCount: suggestions_count
			});

			return {
				user_id: userId,
				username: usernameById.get(userId) ?? 'User',
				watched_count,
				ratings_count,
				reviews_count,
				suggestions_count,
				xp_total: xp.total
			};
		})
		.filter((row) => row.xp_total > 0)
		.sort(
			(a, b) =>
				b.xp_total - a.xp_total ||
				b.suggestions_count - a.suggestions_count ||
				b.reviews_count - a.reviews_count ||
				b.ratings_count - a.ratings_count ||
				b.watched_count - a.watched_count
		)
		.slice(0, 10);

	return {
		overview: overviewRes.data as any,
		catalog,
		music,
		spots,
		peopleStats,
		yearsCovered,
		fundingSummary,
		facetStats,
		watchActivity: (activityRes.data as any[]) ?? [],
		ratingsDistribution: (ratingsDistRes.data as any[]) ?? [],
		topWatchedMedia,
		topContributors
	};
};
