import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { error } from '@sveltejs/kit';

export const load = async ({ parent, setHeaders }) => {
	const parentData = await parent();
	const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
	setHeaders({
		'Cache-Control': isAuthenticated
			? 'private, no-store'
			: 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400',
		Vary: 'Cookie'
	});

	const supabase = createSupabaseServiceClient();

	type TopWatchedRpcRow = {
		media_id: string;
		media_type: string;
		watchers: number;
		avg_percent: number;
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

	const [overviewRes, activityRes, ratingsDistRes, topMediaRes] = await Promise.all([
		supabase.rpc('admin_stats_overview'),
		supabase.rpc('admin_watch_activity', { days: 30 }),
		supabase.rpc('admin_ratings_distribution'),
		supabase.rpc('admin_top_watched_media', { limit_n: 10 })
	]);

	const rpcErrors = [
		overviewRes.error,
		activityRes.error,
		ratingsDistRes.error,
		topMediaRes.error
	].filter((e): e is NonNullable<typeof e> => Boolean(e));
	if (rpcErrors.length > 0) {
		const message = rpcErrors.map((e) => e.message).join(' | ');
		if (
			message.includes('Could not find the function') ||
			message.includes('admin_stats_overview')
		) {
			throw error(
				500,
				'Missing stats SQL functions in Supabase. Apply the migration supabase/migrations/20260128000000_add_admin_stats_functions.sql to your Supabase project.'
			);
		}
		throw error(500, message);
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
			'facet_type, facet_environment, facet_film_style, facet_theme, facet_mood, facet_movement, type, creators, starring, year'
		);
	if (facetsError) throw error(500, facetsError.message);

	const facetTypeCounts = new Map<string, number>();
	const environmentCounts = new Map<string, number>();
	const filmStyleCounts = new Map<string, number>();
	const themeCounts = new Map<string, number>();
	const moodCounts = new Map<string, number>();
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
		bump(filmStyleCounts, row.facet_film_style);
		bump(themeCounts, row.facet_theme);
		for (const mood of row.facet_mood ?? []) bump(moodCounts, mood);
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

	const facetStats = {
		contentCounts: movieCounts,
		facetType: topN(facetTypeCounts, 10),
		environment: topN(environmentCounts, 10),
		filmStyle: topN(filmStyleCounts, 10),
		theme: topN(themeCounts, 10),
		mood: topN(moodCounts, 10),
		movement: topN(movementCounts, 10)
	};

	const rawTop = ((topMediaRes.data as any[]) ?? []) as TopWatchedRpcRow[];
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
	const episodeVideoIds = Array.from(
		new Set(
			parsed
				.filter((entry) => entry.parsed.kind === 'episode')
				.map((entry) => (entry.parsed.kind === 'episode' ? entry.parsed.episodeVideoId : null))
				.filter((id): id is string => typeof id === 'string' && id.length > 0)
		)
	);

	const titleByMovieId = new Map<number, { title: string; slug: string }>();
	const titleBySeriesId = new Map<number, { title: string; slug: string }>();
	const episodeByVideoId = new Map<
		string,
		{ title: string | null; episode_number: number; season_id: number }
	>();
	const seasonById = new Map<number, { season_number: number; series_id: number }>();

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

	if (episodeVideoIds.length > 0) {
		const { data: episodeRows, error: episodeError } = await supabase
			.from('series_episodes')
			.select('video_id, title, episode_number, season_id')
			.in('video_id', episodeVideoIds);
		if (episodeError) throw error(500, episodeError.message);
		for (const row of episodeRows ?? []) {
			if (row.video_id) {
				episodeByVideoId.set(row.video_id, {
					title: row.title,
					episode_number: row.episode_number,
					season_id: row.season_id
				});
			}
		}

		const seasonIds = Array.from(new Set((episodeRows ?? []).map((row) => row.season_id)));
		if (seasonIds.length > 0) {
			const { data: seasons, error: seasonsError } = await supabase
				.from('series_seasons')
				.select('id, season_number, series_id')
				.in('id', seasonIds);
			if (seasonsError) throw error(500, seasonsError.message);
			for (const row of seasons ?? []) {
				seasonById.set(row.id, { season_number: row.season_number, series_id: row.series_id });
			}

			const episodeSeriesIds = Array.from(new Set((seasons ?? []).map((row) => row.series_id)));
			if (episodeSeriesIds.length > 0) {
				const { data: seriesRows, error: seriesError } = await supabase
					.from('media_items')
					.select('id, title, slug')
					.in('id', episodeSeriesIds);
				if (seriesError) throw error(500, seriesError.message);
				for (const row of seriesRows ?? []) {
					titleBySeriesId.set(row.id, { title: row.title, slug: row.slug });
				}
			}
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

		if (parsedKey.kind === 'episode') {
			const episode = episodeByVideoId.get(parsedKey.episodeVideoId);
			const season = episode ? seasonById.get(episode.season_id) : null;
			const series = season ? titleBySeriesId.get(season.series_id) : null;
			const seriesTitle = series?.title ?? `Series #${parsedKey.seriesId}`;
			const seasonLabel = season ? `S${season.season_number}` : 'S?';
			const episodeLabel = episode ? `E${episode.episode_number}` : 'E?';
			const episodeTitle = episode?.title ?? null;
			return {
				...row,
				title: episodeTitle
					? `${seriesTitle} — ${episodeTitle}`
					: `${seriesTitle} — ${seasonLabel}${episodeLabel}`,
				href: series?.slug ? `/series/${series.slug}` : null,
				subtitle: `${seasonLabel}${episodeLabel}`
			};
		}

		return {
			...row,
			title: row.media_id,
			href: null,
			subtitle: null
		};
	});

	return {
		overview: overviewRes.data as any,
		catalog,
		music,
		spots,
		peopleStats,
		yearsCovered,
		facetStats,
		watchActivity: (activityRes.data as any[]) ?? [],
		ratingsDistribution: (ratingsDistRes.data as any[]) ?? [],
		topWatchedMedia
	};
};
