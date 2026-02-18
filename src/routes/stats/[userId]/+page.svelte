<script lang="ts">
	import * as m from '$lib/paraglide/messages';

	type RatingDistRow = { rating: number; count: number };
	type RatedItem = {
		id: number;
		rating: number;
		title: string;
		type: string;
		href: string;
		updated_at: string;
	};
	let { data } = $props<{
		data: {
			username: string;
			userId: string;
			stats: {
				averageRating: number;
				ratingCount: number;
				reviewsCount: number;
				suggestionsCount: number | null;
				watchedCount: number;
				watchedEpisodesCount: number;
				watchedMoviesCount: number;
				watchedSeriesCount: number;
				catalogTotals: { movies: number; episodes: number };
				totalPositionSeconds: number;
				totalDurationSeconds: number;
				avgPercentWatched: number;
				ratingDistribution: RatingDistRow[];
				ratedItems: RatedItem[];
				watchedButNotRated: { id: number; title: string; type: string; href: string }[];
			};
		};
	}>();

	let showAllRated = $state(false);
	const ratedSorted: RatedItem[] = $derived(
		(data.stats.ratedItems as RatedItem[])
			.slice()
			.sort(
				(a: RatedItem, b: RatedItem) =>
					b.rating - a.rating || b.updated_at.localeCompare(a.updated_at)
			)
	);
	const ratedVisible: RatedItem[] = $derived(showAllRated ? ratedSorted : ratedSorted.slice(0, 20));

	const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
	const formatMediaTypeLabel = (mediaType: string) => {
		switch (mediaType) {
			case 'movie':
				return m.tv_pillFilm();
			case 'series':
				return m.tv_pillSeries();
			case 'episode':
				return m.tv_episode();
			default:
				return mediaType;
		}
	};

	const formatDuration = (seconds: number) => {
		const mins = Math.max(0, Math.round((seconds ?? 0) / 60));
		if (mins < 60) return m.stats_durationMinutes({ minutes: String(mins) });
		const h = Math.floor(mins / 60);
		const minutesRemainder = mins % 60;
		return m.stats_durationHoursMinutes({ hours: String(h), minutes: String(minutesRemainder) });
	};

	const ratingMax: number = $derived(
		Math.max(1, ...data.stats.ratingDistribution.map((row: RatingDistRow) => row.count ?? 0))
	);

	const watchedEpisodesLabel: string = $derived(
		`${formatNumber(data.stats.watchedEpisodesCount)} / ${formatNumber(data.stats.catalogTotals.episodes)}`
	);
	const watchedMoviesLabel: string = $derived(
		`${formatNumber(data.stats.watchedMoviesCount)} / ${formatNumber(data.stats.catalogTotals.movies)}`
	);
	const hasRatings: boolean = $derived(
		data.stats.ratingDistribution.some((row: RatingDistRow) => (row.count ?? 0) > 0)
	);
</script>

<svelte:head>
	<title>{m.stats_userTitle({ username: data.username })}</title>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href={`https://www.jumpflix.tv/stats/${data.userId}`} />
</svelte:head>

<div class="mx-auto w-full max-w-6xl p-4 md:p-8">
	<div
		class="mt-[50px] mb-6 rounded-2xl border bg-gradient-to-br from-primary/10 via-background to-background p-6 md:p-8"
	>
		<a
			href="/stats"
			class="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>{m.stats_backToPublicStats()}</span>
		</a>
		<h1 class="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">
			{m.stats_userTitle({ username: data.username })}
		</h1>
		<p class="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
			{m.stats_userDescription({ username: data.username })}
		</p>
		<div class="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
			<span class="rounded-full border bg-background/60 px-3 py-1">{m.stats_badge_notIndexed()}</span>
			<span class="rounded-full border bg-background/60 px-3 py-1">
				{m.stats_badge_basedOnWatchHistoryAndRatings()}
			</span>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-6">
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">{m.stats_averageRating()}</div>
			<div class="mt-1 text-2xl font-semibold">{data.stats.averageRating.toFixed(2)}</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{m.stats_ratingsCount({ count: formatNumber(data.stats.ratingCount) })}
			</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">{m.stats_reviewsPlaced()}</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.stats.reviewsCount)}</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.stats_shortWrittenReviews()}</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">{m.stats_suggestionsSubmitted()}</div>
			<div class="mt-1 text-2xl font-semibold">
				{#if data.stats.suggestionsCount === null}
					—
				{:else}
					{formatNumber(data.stats.suggestionsCount)}
				{/if}
			</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.stats_contentChangeReports()}</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">{m.stats_watchedItems()}</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.stats.watchedCount)}</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{m.stats_watchedBreakdown({
					movies: formatNumber(data.stats.watchedMoviesCount),
					series: formatNumber(data.stats.watchedSeriesCount),
					episodes: formatNumber(data.stats.watchedEpisodesCount)
				})}
			</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">{m.stats_timeWatchedProgress()}</div>
			<div class="mt-1 text-2xl font-semibold">{formatDuration(data.stats.totalPositionSeconds)}</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{m.stats_avgCompletion({ percent: String(Math.round(data.stats.avgPercentWatched)) })}
			</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">{m.stats_catalogProgress()}</div>
			<div class="mt-1 text-sm font-medium">{m.stats_episodes()}: {watchedEpisodesLabel}</div>
			<div class="mt-1 text-sm font-medium">{m.stats_films()}: {watchedMoviesLabel}</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.stats_acrossYourWatchedHistory()}</div>
		</div>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="rounded-xl border p-4">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold">{m.stats_ratingsDistribution()}</h2>
				<div class="text-xs text-muted-foreground">1–10</div>
			</div>
			{#if !hasRatings}
				<p class="mt-4 text-sm text-muted-foreground">{m.stats_noRatingsYet()}</p>
			{:else}
				<div class="mt-4 grid gap-2">
					{#each data.stats.ratingDistribution as row (row.rating)}
						<div class="grid grid-cols-[2rem_1fr_4rem] items-center gap-3">
							<div class="text-sm tabular-nums">{row.rating}</div>
							<div class="h-2 rounded bg-muted/40">
								<div
									class="h-2 rounded bg-primary"
									style={`width: ${Math.round(((row.count ?? 0) / ratingMax) * 100)}%`}
								></div>
							</div>
							<div class="text-right text-sm text-muted-foreground tabular-nums">
								{formatNumber(row.count ?? 0)}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</div>

		<div class="rounded-xl border p-4">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold">{m.stats_rankedRatings()}</h2>
				<div class="text-xs text-muted-foreground">
					{m.stats_itemsCount({ count: formatNumber(ratedSorted.length) })}
				</div>
			</div>
			{#if ratedSorted.length === 0}
				<p class="mt-3 text-sm text-muted-foreground">{m.stats_nothingRatedYet()}</p>
			{:else}
				<div class="mt-3 divide-y">
					{#each ratedVisible as item (item.id)}
						<a
							href={item.href}
							class="-mx-2 flex items-center justify-between gap-4 rounded-md px-2 py-2 transition hover:bg-muted/30"
						>
							<div class="min-w-0">
								<div class="truncate text-sm font-medium">{item.title}</div>
									<div class="text-xs text-muted-foreground">{formatMediaTypeLabel(item.type)}</div>
							</div>
							<div class="rounded-full border bg-background px-3 py-1 text-xs font-medium">
								{item.rating}/10
							</div>
						</a>
					{/each}
				</div>

				{#if ratedSorted.length > 20}
					<button
						onclick={() => (showAllRated = !showAllRated)}
						class="mt-3 inline-flex items-center justify-center rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium transition hover:bg-muted/35"
					>
						{showAllRated ? m.tv_showFewer() : m.tv_showAll()}
					</button>
				{/if}
			{/if}
		</div>
	</div>

	<div class="mt-8 rounded-xl border p-4">
		<div class="flex items-baseline justify-between gap-3">
			<h2 class="text-base font-semibold">{m.stats_watchedButNotRated()}</h2>
			<div class="text-xs text-muted-foreground">{m.stats_upTo50()}</div>
		</div>
		{#if (data.stats.watchedButNotRated ?? []).length === 0}
			<p class="mt-3 text-sm text-muted-foreground">{m.stats_allWatchedItemsAreRatedNice()}</p>
		{:else}
			<div class="mt-3 grid grid-cols-1 gap-2 md:grid-cols-2">
				{#each data.stats.watchedButNotRated as item (item.id)}
					<a
						href={item.href}
						class="rounded-lg border bg-muted/20 px-3 py-2 transition hover:bg-muted/40"
					>
						<div class="truncate text-sm font-medium">{item.title}</div>
						<div class="text-xs text-muted-foreground">{formatMediaTypeLabel(item.type)}</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>
</div>
