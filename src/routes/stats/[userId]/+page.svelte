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
			isOwner: boolean;
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
				recentReviews: {
					id: number;
					body: string;
					created_at: string;
					updated_at: string;
					media: { id: number; title: string; type: string; href: string } | null;
				}[];
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
	const clampPercent = (value: number) => Math.min(100, Math.max(0, Math.round(value || 0)));
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

	const formatDate = (value: string) => {
		try {
			return new Date(value).toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric'
			});
		} catch {
			return value;
		}
	};

	const ratingMax: number = $derived(
		Math.max(1, ...data.stats.ratingDistribution.map((row: RatingDistRow) => row.count ?? 0))
	);
	const isOwner: boolean = $derived(Boolean(data.isOwner));
	const ownerOrUsername: string = $derived(isOwner ? m.stats_you() : data.username);
	const profileInitials: string = $derived(
		data.username
			.split(/\s+/)
			.filter(Boolean)
			.slice(0, 2)
			.map((part: string) => part.charAt(0).toUpperCase())
			.join('') || '?'
	);
	const watchedMoviesPercent: number = $derived(
		data.stats.catalogTotals.movies > 0
			? (data.stats.watchedMoviesCount / data.stats.catalogTotals.movies) * 100
			: 0
	);
	const watchedEpisodesPercent: number = $derived(
		data.stats.catalogTotals.episodes > 0
			? (data.stats.watchedEpisodesCount / data.stats.catalogTotals.episodes) * 100
			: 0
	);
	const completionPercent: number = $derived(clampPercent(data.stats.avgPercentWatched));
	const totalContributionCount: number = $derived(
		data.stats.reviewsCount + (data.stats.suggestionsCount ?? 0)
	);
	const dominantRatingRow: RatingDistRow | null = $derived(
		data.stats.ratingDistribution.reduce(
			(best: RatingDistRow | null, row: RatingDistRow) => {
			if ((row.count ?? 0) <= 0) return best;
			if (!best) return row;
			if ((row.count ?? 0) > (best.count ?? 0)) return row;
			if ((row.count ?? 0) === (best.count ?? 0) && row.rating > best.rating) return row;
			return best;
			},
			null as RatingDistRow | null
		)
	);
	const highRatingsCount: number = $derived(
		data.stats.ratingDistribution
			.filter((row: RatingDistRow) => row.rating >= 8)
			.reduce((sum: number, row: RatingDistRow) => sum + (row.count ?? 0), 0)
	);
	const highRatingsPercent: number = $derived(
		data.stats.ratingCount > 0 ? clampPercent((highRatingsCount / data.stats.ratingCount) * 100) : 0
	);
	const hasContribution: boolean = $derived(totalContributionCount > 0);
	const hasWrittenReviews: boolean = $derived(data.stats.recentReviews.length > 0);
	const profileTitle: string = $derived(
		isOwner ? m.stats_profileTitleOwner() : m.stats_profileTitlePublic({ username: data.username })
	);
	const profileSummary: string = $derived(
		isOwner
			? m.stats_profileSummaryOwner({
				watched: formatNumber(data.stats.watchedCount),
				rated: formatNumber(data.stats.ratingCount),
				reviews: formatNumber(data.stats.reviewsCount)
			})
			: m.stats_profileSummaryPublic({
				username: data.username,
				watched: formatNumber(data.stats.watchedCount),
				rated: formatNumber(data.stats.ratingCount),
				reviews: formatNumber(data.stats.reviewsCount)
			})
	);
	const profileStandfirst: string = $derived(
		hasContribution
			? isOwner
				? m.stats_profileStandfirstOwnerContribution()
				: m.stats_profileStandfirstPublicContribution({ username: data.username })
			: isOwner
				? m.stats_profileStandfirstOwnerWatching()
				: m.stats_profileStandfirstPublicWatching({ username: data.username })
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
	<title>{profileTitle}</title>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href={`https://www.jumpflix.tv/stats/${data.userId}`} />
</svelte:head>

<div class="stats-profile mx-auto w-full max-w-7xl px-4 pb-16 md:px-8 md:pb-24">
	<section class="profile-hero relative mt-[50px] overflow-hidden rounded-[2rem] border border-white/12 p-6 md:p-10">
		<div class="profile-hero__glow profile-hero__glow--left"></div>
		<div class="profile-hero__glow profile-hero__glow--right"></div>
		<div class="relative z-10 grid gap-8 lg:grid-cols-[minmax(0,1.2fr)_22rem] lg:items-end">
			<div>
				<a
					href="/stats"
					class="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
				>
					<span aria-hidden="true">←</span>
					<span>{m.stats_backToPublicStats()}</span>
				</a>
				<div class="mt-6 flex flex-wrap items-center gap-3">
					<div class="profile-avatar">{profileInitials}</div>
					<div class="space-y-2">
						<div class="jf-label">{m.stats_profileEyebrow()}</div>
						<h1 class="jf-display max-w-3xl text-4xl leading-none font-semibold tracking-tight text-white md:text-6xl">
							{profileTitle}
						</h1>
					</div>
				</div>
				<p class="mt-5 max-w-3xl text-base leading-7 text-white/78 md:text-lg md:leading-8">
					{profileSummary}
				</p>
				<p class="mt-4 max-w-2xl text-sm leading-6 text-[color:var(--jf-ink-muted)] md:text-base">
					{profileStandfirst}
				</p>
				<div class="mt-6 flex flex-wrap gap-2 text-xs text-muted-foreground">
					<span class="rounded-full border border-white/14 bg-black/20 px-3 py-1.5">
						{m.stats_badge_notIndexed()}
					</span>
					<span class="rounded-full border border-white/14 bg-black/20 px-3 py-1.5">
						{m.stats_badge_basedOnWatchHistoryAndRatings()}
					</span>
					{#if data.stats.suggestionsCount !== null}
						<span class="rounded-full border border-white/14 bg-black/20 px-3 py-1.5">
							{m.stats_ownerBadge()}
						</span>
					{/if}
				</div>
			</div>

			<div class="profile-signature grid gap-3 rounded-[1.75rem] border border-white/12 bg-black/20 p-4 backdrop-blur-sm sm:grid-cols-2 lg:grid-cols-1">
				<div class="rounded-[1.35rem] border border-white/10 bg-white/[0.04] p-4">
					<div class="jf-label">{m.stats_signatureLabel()}</div>
					<div class="mt-3 text-4xl font-semibold tracking-tight text-white">
						{formatNumber(data.stats.watchedCount)}
					</div>
					<div class="mt-2 text-sm text-white/76">{m.stats_watchedItems()}</div>
					<div class="mt-4 text-xs leading-5 text-[color:var(--jf-ink-muted)]">
						{m.stats_watchedBreakdown({
							movies: formatNumber(data.stats.watchedMoviesCount),
							series: formatNumber(data.stats.watchedSeriesCount),
							episodes: formatNumber(data.stats.watchedEpisodesCount)
						})}
					</div>
				</div>
				<div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
					<div class="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
						<div class="text-[0.7rem] uppercase tracking-[0.22em] text-white/45">
							{m.stats_timeWatchedProgress()}
						</div>
						<div class="mt-2 text-2xl font-semibold text-white">
							{formatDuration(data.stats.totalPositionSeconds)}
						</div>
					</div>
					<div class="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
						<div class="text-[0.7rem] uppercase tracking-[0.22em] text-white/45">
							{m.stats_averageRating()}
						</div>
						<div class="mt-2 text-2xl font-semibold text-white">
							{data.stats.averageRating.toFixed(2)}
						</div>
					</div>
					<div class="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
						<div class="text-[0.7rem] uppercase tracking-[0.22em] text-white/45">
							{m.stats_reviewsPlaced()}
						</div>
						<div class="mt-2 text-2xl font-semibold text-white">
							{formatNumber(data.stats.reviewsCount)}
						</div>
					</div>
					<div class="rounded-[1.25rem] border border-white/10 bg-white/[0.03] p-4">
						<div class="text-[0.7rem] uppercase tracking-[0.22em] text-white/45">
							{m.stats_archiveParticipation()}
						</div>
						<div class="mt-2 text-2xl font-semibold text-white">
							{formatNumber(totalContributionCount)}
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<div class="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
		<section class="jf-surface relative overflow-hidden rounded-[1.9rem] p-6 md:p-8">
			<div class="section-orb"></div>
			<div class="relative z-10">
				<div class="flex flex-wrap items-end justify-between gap-4">
					<div>
						<div class="jf-label">01</div>
						<h2 class="jf-display mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
							{m.stats_sectionWatching()}
						</h2>
						<p class="mt-3 max-w-2xl text-sm leading-6 text-white/68 md:text-base">
							{m.stats_sectionWatchingIntro({ name: ownerOrUsername })}
						</p>
					</div>
					<div class="rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm text-white/72">
						{m.stats_avgCompletion({ percent: String(completionPercent) })}
					</div>
				</div>

				<div class="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
					<div class="rounded-[1.6rem] border border-white/10 bg-black/18 p-5 md:p-6">
						<div class="text-[0.72rem] uppercase tracking-[0.24em] text-white/46">
							{m.stats_watchFootprint()}
						</div>
						<div class="mt-4 flex flex-wrap items-end gap-6">
							<div>
								<div class="text-5xl font-semibold tracking-tight text-white md:text-6xl">
									{formatNumber(data.stats.watchedCount)}
								</div>
								<div class="mt-2 text-sm text-white/68">{m.stats_watchedItems()}</div>
							</div>
							<div class="min-w-[11rem] flex-1">
								<div class="text-sm text-white/72">{formatDuration(data.stats.totalPositionSeconds)}</div>
								<div class="mt-2 text-xs leading-5 text-[color:var(--jf-ink-muted)]">
									{m.stats_watchedBreakdown({
										movies: formatNumber(data.stats.watchedMoviesCount),
										series: formatNumber(data.stats.watchedSeriesCount),
										episodes: formatNumber(data.stats.watchedEpisodesCount)
									})}
								</div>
							</div>
						</div>

						<div class="mt-8 grid gap-4 sm:grid-cols-2">
							<div class="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
								<div class="text-[0.72rem] uppercase tracking-[0.22em] text-white/45">
									{m.stats_catalogProgress()}
								</div>
								<div class="mt-2 text-xl font-semibold text-white">{watchedMoviesLabel}</div>
								<div class="mt-1 text-sm text-white/64">{m.stats_films()}</div>
							</div>
							<div class="rounded-[1.25rem] border border-white/8 bg-white/[0.03] p-4">
								<div class="text-[0.72rem] uppercase tracking-[0.22em] text-white/45">
									{m.stats_timeWatchedProgress()}
								</div>
								<div class="mt-2 text-xl font-semibold text-white">{completionPercent}%</div>
								<div class="mt-1 text-sm text-white/64">{m.stats_completionRhythm()}</div>
							</div>
						</div>
					</div>

					<div class="space-y-4">
						<div class="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
							<div class="flex items-center justify-between gap-4">
								<div>
									<div class="text-sm font-medium text-white">{m.stats_films()}</div>
									<div class="mt-1 text-xs text-white/54">{watchedMoviesLabel}</div>
								</div>
								<div class="text-sm font-medium text-white/80">{clampPercent(watchedMoviesPercent)}%</div>
							</div>
							<div class="progress-track mt-4">
								<div class="progress-fill" style={`width: ${clampPercent(watchedMoviesPercent)}%`}></div>
							</div>
						</div>
						<div class="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
							<div class="flex items-center justify-between gap-4">
								<div>
									<div class="text-sm font-medium text-white">{m.stats_episodes()}</div>
									<div class="mt-1 text-xs text-white/54">{watchedEpisodesLabel}</div>
								</div>
								<div class="text-sm font-medium text-white/80">{clampPercent(watchedEpisodesPercent)}%</div>
							</div>
							<div class="progress-track mt-4">
								<div class="progress-fill" style={`width: ${clampPercent(watchedEpisodesPercent)}%`}></div>
							</div>
						</div>
						<div class="rounded-[1.5rem] border border-white/10 bg-white/[0.03] p-5">
							<div class="text-[0.72rem] uppercase tracking-[0.22em] text-white/45">
								{m.stats_collectionCoverage()}
							</div>
							<p class="mt-3 text-sm leading-6 text-white/68">
								{m.stats_collectionCoverageIntro({ name: ownerOrUsername })}
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>

		<aside class="space-y-8">
			<section class="jf-surface-soft rounded-[1.9rem] p-6">
				<div class="jf-label">02</div>
				<h2 class="jf-display mt-2 text-3xl font-semibold tracking-tight text-white">
					{m.stats_sectionRatings()}
				</h2>
				<p class="mt-3 text-sm leading-6 text-white/68">
					{m.stats_sectionRatingsIntro({ name: ownerOrUsername })}
				</p>

				<div class="mt-6 grid gap-3">
					<div class="rounded-[1.3rem] border border-white/10 bg-black/18 p-4">
						<div class="text-[0.72rem] uppercase tracking-[0.22em] text-white/45">
							{m.stats_averageRating()}
						</div>
						<div class="mt-2 text-3xl font-semibold text-white">
							{data.stats.averageRating.toFixed(2)}
						</div>
						<div class="mt-1 text-xs text-white/58">
							{m.stats_ratingsCount({ count: formatNumber(data.stats.ratingCount) })}
						</div>
					</div>
					<div class="grid gap-3 sm:grid-cols-2">
						<div class="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
							<div class="text-[0.72rem] uppercase tracking-[0.22em] text-white/45">
								{m.stats_dominantRating()}
							</div>
							<div class="mt-2 text-2xl font-semibold text-white">
								{#if dominantRatingRow}
									{dominantRatingRow.rating}/10
								{:else}
									—
								{/if}
							</div>
						</div>
						<div class="rounded-[1.2rem] border border-white/10 bg-white/[0.03] p-4">
							<div class="text-[0.72rem] uppercase tracking-[0.22em] text-white/45">
								{m.stats_highRatingsShare()}
							</div>
							<div class="mt-2 text-2xl font-semibold text-white">{highRatingsPercent}%</div>
						</div>
					</div>

					<div class="rounded-[1.5rem] border border-white/10 bg-black/18 p-4">
						<div class="flex items-baseline justify-between gap-3">
							<h3 class="text-base font-semibold text-white">{m.stats_ratingsDistribution()}</h3>
							<div class="text-xs text-white/45">1-10</div>
						</div>
						{#if !hasRatings}
							<p class="mt-4 text-sm text-white/58">{m.stats_noRatingsYet()}</p>
						{:else}
							<div class="mt-4 grid gap-2.5">
								{#each data.stats.ratingDistribution as row (row.rating)}
									<div class="grid grid-cols-[2rem_1fr_4rem] items-center gap-3">
										<div class="text-sm text-white/74 tabular-nums">{row.rating}</div>
										<div class="progress-track h-2.5">
											<div
												class="progress-fill"
												style={`width: ${Math.round(((row.count ?? 0) / ratingMax) * 100)}%`}
											></div>
										</div>
										<div class="text-right text-sm text-white/54 tabular-nums">
											{formatNumber(row.count ?? 0)}
										</div>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			</section>

			<section class="jf-surface-soft rounded-[1.9rem] p-6">
				<div class="jf-label">03</div>
				<h2 class="jf-display mt-2 text-3xl font-semibold tracking-tight text-white">
					{m.stats_sectionContribution()}
				</h2>
				<p class="mt-3 text-sm leading-6 text-white/68">
					{m.stats_sectionContributionIntro({ name: ownerOrUsername })}
				</p>

				<div class="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
					<div class="rounded-[1.3rem] border border-white/10 bg-black/18 p-4">
						<div class="text-[0.72rem] uppercase tracking-[0.22em] text-white/45">
							{m.stats_reviewsPlaced()}
						</div>
						<div class="mt-2 text-3xl font-semibold text-white">
							{formatNumber(data.stats.reviewsCount)}
						</div>
						<div class="mt-2 text-xs text-white/58">{m.stats_shortWrittenReviews()}</div>
					</div>
					<div class="rounded-[1.3rem] border border-white/10 bg-black/18 p-4">
						<div class="text-[0.72rem] uppercase tracking-[0.22em] text-white/45">
							{m.stats_suggestionsSubmitted()}
						</div>
						<div class="mt-2 text-3xl font-semibold text-white">
							{#if data.stats.suggestionsCount === null}
								—
							{:else}
								{formatNumber(data.stats.suggestionsCount)}
							{/if}
						</div>
						<div class="mt-2 text-xs text-white/58">{m.stats_contentChangeReports()}</div>
					</div>
				</div>
			</section>
		</aside>
	</div>

	<div class="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(20rem,0.9fr)]">
		<section class="jf-surface rounded-[1.9rem] p-6 md:p-8">
			<div class="flex flex-wrap items-baseline justify-between gap-3">
				<div>
					<div class="jf-label">04</div>
					<h2 class="jf-display mt-2 text-3xl font-semibold tracking-tight text-white md:text-4xl">
						{m.stats_rankedRatings()}
					</h2>
					<p class="mt-3 text-sm leading-6 text-white/68">
						{m.stats_rankedRatingsIntro({ name: ownerOrUsername })}
					</p>
				</div>
				<div class="text-xs text-white/48">{m.stats_itemsCount({ count: formatNumber(ratedSorted.length) })}</div>
			</div>

			{#if ratedSorted.length === 0}
				<p class="mt-6 text-sm text-white/58">{m.stats_nothingRatedYet()}</p>
			{:else}
				<div class="mt-6 grid gap-2">
					{#each ratedVisible as item (item.id)}
						<a
							href={item.href}
							class="group flex items-center justify-between gap-4 rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:border-white/14 hover:bg-white/[0.05]"
						>
							<div class="min-w-0">
								<div class="truncate text-sm font-medium text-white transition group-hover:text-white/90">
									{item.title}
								</div>
								<div class="mt-1 text-xs text-white/52">{formatMediaTypeLabel(item.type)}</div>
							</div>
							<div class="rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-xs font-medium text-white/88">
								{item.rating}/10
							</div>
						</a>
					{/each}
				</div>

				{#if ratedSorted.length > 20}
					<button
						onclick={() => (showAllRated = !showAllRated)}
						class="mt-4 inline-flex items-center justify-center rounded-full border border-white/12 bg-white/[0.04] px-4 py-2 text-sm font-medium text-white/82 transition hover:bg-white/[0.08]"
					>
						{showAllRated ? m.tv_showFewer() : m.tv_showAll()}
					</button>
				{/if}
			{/if}
		</section>

		<section class="space-y-8">
			<div class="jf-surface rounded-[1.9rem] p-6">
				<div class="flex items-baseline justify-between gap-3">
					<div>
						<div class="jf-label">05</div>
						<h2 class="jf-display mt-2 text-3xl font-semibold tracking-tight text-white">
							{m.stats_reviewsPlaced()}
						</h2>
					</div>
					<div class="text-xs text-white/48">
						{m.stats_itemsCount({ count: formatNumber(data.stats.reviewsCount) })}
					</div>
				</div>

				{#if !hasWrittenReviews}
					<p class="mt-5 text-sm leading-6 text-white/58">
						{isOwner ? m.stats_reviewsEmptyOwner() : m.stats_reviewsEmptyPublic({ username: data.username })}
					</p>
				{:else}
					<div class="mt-5 grid gap-3">
						{#each data.stats.recentReviews as review (review.id)}
							<article class="rounded-[1.45rem] border border-white/10 bg-white/[0.03] p-4">
								<div class="flex flex-wrap items-baseline justify-between gap-2">
									{#if review.media}
										<a href={review.media.href} class="text-sm font-medium text-white hover:underline">
											{review.media.title}
											<span class="text-xs text-white/52">· {formatMediaTypeLabel(review.media.type)}</span>
										</a>
									{:else}
										<div class="text-sm font-medium text-white/60">Media</div>
									{/if}
									<div class="text-xs text-white/46 tabular-nums">{formatDate(review.created_at)}</div>
								</div>
								<div class="mt-3 whitespace-pre-wrap text-sm leading-6 text-white/84">{review.body}</div>
							</article>
						{/each}
					</div>
				{/if}
			</div>

			<div class="jf-surface-soft rounded-[1.9rem] p-6">
				<div class="flex items-baseline justify-between gap-3">
					<div>
						<div class="jf-label">06</div>
						<h2 class="jf-display mt-2 text-3xl font-semibold tracking-tight text-white">
							{m.stats_watchedButNotRated()}
						</h2>
						<p class="mt-3 text-sm leading-6 text-white/68">
							{isOwner
								? m.stats_watchedButNotRatedIntroOwner()
								: m.stats_watchedButNotRatedIntroPublic({ username: data.username })}
						</p>
					</div>
					<div class="text-xs text-white/48">{m.stats_upTo50()}</div>
				</div>

				{#if (data.stats.watchedButNotRated ?? []).length === 0}
					<p class="mt-5 text-sm text-white/58">{m.stats_allWatchedItemsAreRatedNice()}</p>
				{:else}
					<div class="mt-5 grid grid-cols-1 gap-2 md:grid-cols-2">
						{#each data.stats.watchedButNotRated as item (item.id)}
							<a
								href={item.href}
								class="rounded-[1.2rem] border border-white/8 bg-white/[0.03] px-4 py-3 transition hover:border-white/14 hover:bg-white/[0.05]"
							>
								<div class="truncate text-sm font-medium text-white">{item.title}</div>
								<div class="mt-1 text-xs text-white/52">{formatMediaTypeLabel(item.type)}</div>
							</a>
						{/each}
					</div>
				{/if}
			</div>
		</section>
	</div>
</div>

<style>
	.stats-profile {
		position: relative;
		z-index: 0;
	}

	.profile-hero {
		background:
			radial-gradient(140% 140% at 0% 0%, rgba(229, 9, 20, 0.22), transparent 52%),
			radial-gradient(120% 140% at 100% 10%, rgba(222, 82, 48, 0.18), transparent 45%),
			linear-gradient(160deg, rgba(9, 14, 28, 0.95), rgba(8, 12, 22, 0.86) 55%, rgba(12, 18, 33, 0.94));
		box-shadow: 0 34px 120px -56px rgba(0, 0, 0, 0.85);
	}

	.profile-hero::after {
		content: '';
		position: absolute;
		inset: 0;
		background-image: linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
			linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
		background-position: center;
		background-size: 72px 72px;
		opacity: 0.08;
		pointer-events: none;
	}

	.profile-hero__glow {
		position: absolute;
		width: 24rem;
		height: 24rem;
		border-radius: 9999px;
		filter: blur(72px);
		opacity: 0.45;
		pointer-events: none;
	}

	.profile-hero__glow--left {
		left: -8rem;
		top: -6rem;
		background: rgba(229, 9, 20, 0.24);
	}

	.profile-hero__glow--right {
		right: -6rem;
		bottom: -8rem;
		background: rgba(255, 157, 90, 0.16);
	}

	.profile-avatar {
		display: inline-flex;
		height: 4.75rem;
		width: 4.75rem;
		align-items: center;
		justify-content: center;
		border-radius: 1.5rem;
		border: 1px solid rgba(255, 255, 255, 0.14);
		background: linear-gradient(160deg, rgba(255, 255, 255, 0.12), rgba(255, 255, 255, 0.04));
		font-size: 1.25rem;
		font-weight: 600;
		letter-spacing: 0.18em;
		color: white;
		backdrop-filter: blur(12px);
	}

	.profile-signature {
		background: linear-gradient(180deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02));
	}

	.section-orb {
		position: absolute;
		right: -5rem;
		top: 2rem;
		height: 16rem;
		width: 16rem;
		border-radius: 9999px;
		background: radial-gradient(circle, rgba(229, 9, 20, 0.2) 0%, rgba(229, 9, 20, 0) 68%);
		filter: blur(18px);
		pointer-events: none;
	}

	.progress-track {
		height: 0.7rem;
		overflow: hidden;
		border-radius: 9999px;
		background: rgba(255, 255, 255, 0.08);
	}

	.progress-fill {
		height: 100%;
		border-radius: 9999px;
		background: linear-gradient(90deg, rgba(229, 9, 20, 0.95), rgba(255, 142, 84, 0.92));
		box-shadow: 0 0 24px rgba(229, 9, 20, 0.35);
	}

	@media (max-width: 640px) {
		.profile-avatar {
			height: 3.85rem;
			width: 3.85rem;
			border-radius: 1.2rem;
			font-size: 1rem;
		}

		.profile-hero::after {
			background-size: 52px 52px;
		}
	}
</style>
