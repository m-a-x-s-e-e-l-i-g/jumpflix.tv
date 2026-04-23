<script lang="ts">
	import { countUp } from '$lib/actions/countUp';
	import XPopMark from '$lib/components/XPopMark.svelte';
	import * as m from '$lib/paraglide/messages';
	import {
		IconCalendarStats,
		IconDeviceTv,
		IconListDetails,
		IconMessage2,
		IconMovie,
		IconStar
	} from '@tabler/icons-svelte';

	type RatingDistRow = { rating: number; count: number };
	type ReviewItem = {
		id: number;
		body: string;
		created_at: string;
		updated_at: string;
		media: { id: number; title: string; type: string; href: string } | null;
	};
	type RatedItem = {
		id: number;
		rating: number;
		title: string;
		type: string;
		href: string;
		updated_at: string;
	};
	type StatsMessagesWithOwnProfile = typeof m & {
		stats_yourTitle: () => string;
		stats_yourDescription: () => string;
	};
	const statsMessages = m as StatsMessagesWithOwnProfile;

	let { data } = $props<{
		data: {
			username: string;
			userId: string;
			isOwnProfile: boolean;
			stats: {
				xp: {
					total: number;
					watching: number;
					rating: number;
					reviewing: number;
					contributions: number;
				};
				averageRating: number;
				ratingCount: number;
				reviewsCount: number;
				approvedSuggestionsCount: number | null;
				suggestionStatusCounts: {
					approved: number;
					pending: number;
					rejected: number;
				} | null;
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
				recentReviews: ReviewItem[];
			};
		};
	}>();

	const REVIEW_PAGE_SIZE = 3;
	const RATED_PREVIEW_COUNT = 5;

	let showAllRated = $state(false);
	let reviewsPage = $state(1);
	const ratedSorted: RatedItem[] = $derived(
		(data.stats.ratedItems as RatedItem[])
			.slice()
			.sort(
				(a: RatedItem, b: RatedItem) =>
					b.rating - a.rating || b.updated_at.localeCompare(a.updated_at)
			)
	);
	const ratedVisible: RatedItem[] = $derived(
		showAllRated ? ratedSorted : ratedSorted.slice(0, RATED_PREVIEW_COUNT)
	);
	const reviewsSorted: ReviewItem[] = $derived(
		(data.stats.recentReviews as ReviewItem[])
			.slice()
			.sort((a: ReviewItem, b: ReviewItem) => b.created_at.localeCompare(a.created_at))
	);
	const reviewsPageCount: number = $derived(
		Math.max(1, Math.ceil(reviewsSorted.length / REVIEW_PAGE_SIZE))
	);
	const reviewPageStart = $derived((reviewsPage - 1) * REVIEW_PAGE_SIZE);
	const reviewPageItems: ReviewItem[] = $derived(
		reviewsSorted.slice(reviewPageStart, reviewPageStart + REVIEW_PAGE_SIZE)
	);

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

	const watchedEpisodesLabel: string = $derived(
		`${formatNumber(data.stats.watchedEpisodesCount)} / ${formatNumber(data.stats.catalogTotals.episodes)}`
	);
	const watchedMoviesLabel: string = $derived(
		`${formatNumber(data.stats.watchedMoviesCount)} / ${formatNumber(data.stats.catalogTotals.movies)}`
	);
	const watchedEpisodesPercent: number = $derived(
		data.stats.catalogTotals.episodes > 0
			? Math.round((data.stats.watchedEpisodesCount / data.stats.catalogTotals.episodes) * 100)
			: 0
	);
	const watchedMoviesPercent: number = $derived(
		data.stats.catalogTotals.movies > 0
			? Math.round((data.stats.watchedMoviesCount / data.stats.catalogTotals.movies) * 100)
			: 0
	);
	const recentReviewsVisibleCount: number = $derived(reviewsSorted.length);
	const todoCount: number = $derived((data.stats.watchedButNotRated ?? []).length);
	const hasRatings: boolean = $derived(
		data.stats.ratingDistribution.some((row: RatingDistRow) => (row.count ?? 0) > 0)
	);

	const progressSectionTitle: string = $derived(
		data.isOwnProfile ? m.stats_userSectionProgress() : m.stats_catalogProgress()
	);
	const progressSectionDescription: string = $derived(
		data.isOwnProfile
			? m.stats_userSectionProgressDescription()
			: `${m.stats_watchedItems()} · ${m.stats_timeWatchedProgress()} · ${m.stats_catalogProgress()}`
	);
	const contributionsSectionTitle: string = $derived(
		data.isOwnProfile
			? m.stats_userSectionContributions()
			: `${m.stats_reviewsPlaced()} · ${m.stats_suggestionsSubmitted()}`
	);
	const contributionsSectionDescription: string = $derived(
		data.isOwnProfile
			? m.stats_userSectionContributionsDescription()
			: `${m.stats_reviewsPlaced()} · ${m.stats_suggestionsSubmitted()} · ${m.stats_recentEntriesShownBelow()}`
	);
	const ratingsSectionTitle: string = $derived(
		data.isOwnProfile ? m.stats_userSectionHowYouRate() : m.stats_ratingsDistribution()
	);
	const ratingsSectionDescription: string = $derived(
		data.isOwnProfile
			? m.stats_userSectionHowYouRateDescription()
			: `${m.stats_averageRating()} · ${m.stats_rankedRatings()} · ${m.stats_ratingsDistribution()}`
	);
	const todoSectionTitle: string = $derived(
		data.isOwnProfile ? m.stats_userSectionTodo() : m.stats_watchedButNotRated()
	);
	const todoSectionDescription: string = $derived(
		data.isOwnProfile
			? m.stats_userSectionTodoDescription()
			: `${m.stats_watchedButNotRated()} · ${m.stats_upTo50()}`
	);
	const profileTitle: string = $derived(
		data.isOwnProfile
			? statsMessages.stats_yourTitle()
			: m.stats_userTitle({ username: data.username })
	);
	const profileDescription: string = $derived(
		data.isOwnProfile
			? statsMessages.stats_yourDescription()
			: m.stats_userDescription({ username: data.username })
	);
</script>

<svelte:head>
	<title>{profileTitle}</title>
	<meta name="robots" content="noindex, nofollow" />
	<link rel="canonical" href={`https://www.jumpflix.tv/stats/${data.userId}`} />
</svelte:head>

<div class="stats-page mx-auto w-full max-w-6xl p-4 md:p-8">
	<div class="stats-hero motion-hero jf-surface mt-[50px] mb-6 rounded-3xl p-6 md:p-8">
		<a
			href="/stats"
			class="stats-link inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>{m.stats_backToPublicStats()}</span>
		</a>
		<h1 class="jf-display mt-4 max-w-4xl text-[clamp(2.5rem,6vw,4.75rem)] leading-none text-balance">
			{profileTitle}
		</h1>
		<p class="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
			{profileDescription}
		</p>
		<div class="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
			<span class="stats-pill">{m.stats_badge_notIndexed()}</span>
			<span class="stats-pill">
				{m.stats_badge_basedOnWatchHistoryAndRatings()}
			</span>
			<span class="stats-pill">
				<XPopMark
					text={m.stats_xpEarned({ xp: formatNumber(data.stats.xp.total) })}
					iconClass="size-3.5"
					textClass="normal-case"
				/>
			</span>
			<span class="stats-pill">{m.stats_itemsCount({ count: formatNumber(data.stats.watchedCount) })}</span>
		</div>
	</div>

	<section class="mb-6">
		<div class="jf-surface-soft rounded-3xl p-5 md:p-6">
			<div class="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
				<div>
					<div class="text-xs tracking-[0.24em] text-muted-foreground">{m.stats_totalXp()}</div>
					<div class="mt-2 flex items-center gap-3">
						<div class="stats-kpi__icon-shell" aria-hidden="true">
							<XPopMark text="" iconClass="size-10 md:size-12" overlayClass="text-[10px] md:text-xs" />
						</div>
						<p class="text-3xl font-semibold tracking-tight tabular-nums md:text-4xl">
							<span use:countUp={{ value: data.stats.xp.total }}>{formatNumber(data.stats.xp.total)}</span>
							<span class="ml-2 text-base font-medium text-muted-foreground">XPop</span>
						</p>
					</div>
				</div>
				<div class="max-w-2xl text-sm text-muted-foreground md:text-right md:text-base">
					{m.stats_xpDescription()}
				</div>
			</div>
			<div class="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
				<span class="stats-pill">{m.stats_watchedItems()} · {m.stats_xpEarned({ xp: formatNumber(data.stats.xp.watching) })}</span>
				<span class="stats-pill">{m.stats_ratingsGiven()} · {m.stats_xpEarned({ xp: formatNumber(data.stats.xp.rating) })}</span>
				<span class="stats-pill">{m.stats_reviewsPlaced()} · {m.stats_xpEarned({ xp: formatNumber(data.stats.xp.reviewing) })}</span>
				<span class="stats-pill">{m.stats_suggestionsSubmitted()} · {m.stats_xpEarned({ xp: formatNumber(data.stats.xp.contributions) })}</span>
			</div>
		</div>
	</section>

	<section class="user-section" style="--section-index: 0">
		<div class="user-section__header">
			<p class="user-section__eyebrow">{progressSectionTitle}</p>
			<h2 class="text-2xl font-semibold tracking-tight md:text-3xl">{progressSectionTitle}</h2>
			<p class="max-w-3xl text-sm text-muted-foreground md:text-base">
				{progressSectionDescription}
			</p>
		</div>
		<div class="motion-kpi-grid grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
			<div class="stats-kpi stats-kpi--catalog jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_watchedItems()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconDeviceTv class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
					<span use:countUp={{ value: data.stats.watchedCount }}>{formatNumber(data.stats.watchedCount)}</span>
				</div>
				<div class="mt-1 text-xs text-muted-foreground">
					{m.stats_watchedBreakdown({
						movies: formatNumber(data.stats.watchedMoviesCount),
						series: formatNumber(data.stats.watchedSeriesCount),
						episodes: formatNumber(data.stats.watchedEpisodesCount)
					})}
				</div>
			</div>
			<div class="stats-kpi stats-kpi--archive jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_timeWatchedProgress()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconCalendarStats class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
					{formatDuration(data.stats.totalPositionSeconds)}
				</div>
				<div class="mt-1 text-xs text-muted-foreground">
					{m.stats_acrossYourWatchedHistory()}
				</div>
			</div>
			<div class="stats-kpi stats-kpi--catalog jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_episodes()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconListDetails class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{watchedEpisodesLabel}</div>
				
				<div class="mt-1 text-xs text-muted-foreground">{m.stats_catalogProgress()} · {watchedEpisodesPercent}%</div>
			</div>
			<div class="stats-kpi stats-kpi--catalog jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_films()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconMovie class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{watchedMoviesLabel}</div>
				<div class="mt-1 text-xs text-muted-foreground">{m.stats_catalogProgress()} · {watchedMoviesPercent}%</div>
			</div>
		</div>
	</section>

	<section class="user-section" style="--section-index: 1">
		<div class="user-section__header">
			<p class="user-section__eyebrow">{contributionsSectionTitle}</p>
			<h2 class="text-2xl font-semibold tracking-tight md:text-3xl">{contributionsSectionTitle}</h2>
			<p class="max-w-3xl text-sm text-muted-foreground md:text-base">
				{contributionsSectionDescription}
			</p>
		</div>
		<div class="motion-kpi-grid grid grid-cols-1 gap-3 md:grid-cols-3">
			<div class="stats-kpi stats-kpi--community jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_reviewsPlaced()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconMessage2 class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
					<span use:countUp={{ value: data.stats.reviewsCount }}>{formatNumber(data.stats.reviewsCount)}</span>
				</div>
				<div class="mt-1 text-xs text-muted-foreground">{m.stats_shortWrittenReviews()}</div>
			</div>
			<div class="stats-kpi stats-kpi--community jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_approvedSuggestions()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconListDetails class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
					{#if data.stats.approvedSuggestionsCount === null}
						—
					{:else}
						<span use:countUp={{ value: data.stats.approvedSuggestionsCount }}>{formatNumber(data.stats.approvedSuggestionsCount)}</span>
					{/if}
				</div>
				<div class="mt-1 text-xs text-muted-foreground">
					{#if data.stats.suggestionStatusCounts}
						{m.stats_suggestionsApproved()} {formatNumber(data.stats.suggestionStatusCounts.approved)} · {m.stats_suggestionsPending()} {formatNumber(data.stats.suggestionStatusCounts.pending)} · {m.stats_suggestionsRejected()} {formatNumber(data.stats.suggestionStatusCounts.rejected)}
					{:else}
						{m.stats_contentChangeReports()}
					{/if}
				</div>
			</div>
			<div class="stats-kpi stats-kpi--community jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_reviewsPlaced()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconCalendarStats class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
					<span use:countUp={{ value: recentReviewsVisibleCount }}>{formatNumber(recentReviewsVisibleCount)}</span>
				</div>
				<div class="mt-1 text-xs text-muted-foreground">{m.stats_recentEntriesShownBelow()}</div>
			</div>
		</div>

		<section class="stats-panel mt-6 rounded-3xl p-5 md:p-6">
			<div class="stats-panel__header flex items-baseline justify-between gap-3">
				<h3 class="text-base font-semibold tracking-tight md:text-lg">{m.stats_reviewsPlaced()}</h3>
				<div class="text-xs text-muted-foreground">
					{m.stats_itemsCount({ count: formatNumber(data.stats.reviewsCount) })}
				</div>
			</div>
			{#if reviewsSorted.length === 0}
				<p class="stats-empty mt-4 text-sm text-muted-foreground">{m.tv_noReviews()}</p>
			{:else}
				{#key reviewsPage}
					<div class="motion-review-stack mt-4 grid gap-3">
						{#each reviewPageItems as review (review.id)}
							<div class="user-review rounded-2xl p-4 md:p-5">
								<div class="flex flex-wrap items-baseline justify-between gap-2">
									{#if review.media}
										<a href={review.media.href} class="stats-link text-sm font-medium">
											{review.media.title}
											<span class="text-xs text-muted-foreground">
												· {formatMediaTypeLabel(review.media.type)}
											</span>
										</a>
									{:else}
										<div class="text-sm font-medium text-muted-foreground">Media</div>
									{/if}
									<div class="text-xs text-muted-foreground tabular-nums">
										{formatDate(review.created_at)}
									</div>
								</div>
								<div class="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/90">
									{review.body}
								</div>
							</div>
						{/each}
					</div>
				{/key}

				{#if reviewsPageCount > 1}
					<div class="user-pagination mt-4">
						<button
							type="button"
							onclick={() => (reviewsPage = Math.max(1, reviewsPage - 1))}
							class="user-button inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium"
							disabled={reviewsPage === 1}
						>
							{m.stats_previousPage()}
						</button>
						<div class="text-sm text-muted-foreground tabular-nums">
							{m.stats_pageOf({ current: String(reviewsPage), total: String(reviewsPageCount) })}
						</div>
						<button
							type="button"
							onclick={() => (reviewsPage = Math.min(reviewsPageCount, reviewsPage + 1))}
							class="user-button inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium"
							disabled={reviewsPage === reviewsPageCount}
						>
							{m.stats_nextPage()}
						</button>
					</div>
				{/if}
			{/if}
		</section>
	</section>

	<section class="user-section" style="--section-index: 2">
		<div class="user-section__header">
			<p class="user-section__eyebrow">{ratingsSectionTitle}</p>
			<h2 class="text-2xl font-semibold tracking-tight md:text-3xl">{ratingsSectionTitle}</h2>
			<p class="max-w-3xl text-sm text-muted-foreground md:text-base">
				{ratingsSectionDescription}
			</p>
		</div>
		<div class="motion-kpi-grid grid grid-cols-1 gap-3">
			<div class="stats-kpi stats-kpi--community jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_averageRating()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconStar class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-3xl font-semibold tracking-tight tabular-nums md:text-4xl">
					<span use:countUp={{ value: data.stats.averageRating, options: { decimalPlaces: 2 } }}>{data.stats.averageRating.toFixed(2)}</span>
				</div>
				<div class="mt-1 text-xs text-muted-foreground">
					{m.stats_ratingsCount({ count: formatNumber(data.stats.ratingCount) })}
				</div>
			</div>
		</div>

		<div class="motion-panel-grid mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
			<section class="stats-panel rounded-3xl p-5 md:p-6">
				<div class="stats-panel__header flex items-baseline justify-between gap-3">
					<h3 class="text-base font-semibold tracking-tight md:text-lg">{m.stats_ratingsDistribution()}</h3>
					<div class="text-xs text-muted-foreground">1–10</div>
				</div>
				{#if !hasRatings}
					<p class="stats-empty mt-4 text-sm text-muted-foreground">{m.stats_noRatingsYet()}</p>
				{:else}
					<div class="mt-4 grid gap-2.5">
						{#each data.stats.ratingDistribution as row (row.rating)}
							<div class="stats-meter grid grid-cols-[2rem_1fr_4rem] items-center gap-3">
								<div class="text-sm tabular-nums">{row.rating}</div>
								<div class="stats-meter__track h-2 rounded bg-muted/40">
									<div
										class="stats-meter__fill h-2 rounded bg-primary"
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
			</section>

			<section class="stats-panel rounded-3xl p-5 md:p-6">
				<div class="stats-panel__header flex items-baseline justify-between gap-3">
					<h3 class="text-base font-semibold tracking-tight md:text-lg">{m.stats_rankedRatings()}</h3>
					<div class="text-xs text-muted-foreground">
						{m.stats_itemsCount({ count: formatNumber(ratedSorted.length) })}
					</div>
				</div>
				{#if ratedSorted.length === 0}
					<p class="stats-empty mt-4 text-sm text-muted-foreground">{m.stats_nothingRatedYet()}</p>
				{:else}
					{#key showAllRated}
						<div class="motion-rated-stack mt-4 grid gap-2">
							{#each ratedVisible as item (item.id)}
								<a href={item.href} class="user-list-item stats-link">
									<div class="min-w-0">
										<div class="truncate text-sm font-medium">{item.title}</div>
										<div class="text-xs text-muted-foreground">{formatMediaTypeLabel(item.type)}</div>
									</div>
									<div class="user-rating-pill">{item.rating}/10</div>
								</a>
							{/each}
						</div>
					{/key}

					{#if ratedSorted.length > RATED_PREVIEW_COUNT}
						<button
							onclick={() => (showAllRated = !showAllRated)}
							class="user-button mt-4 inline-flex items-center justify-center rounded-full px-4 py-2 text-sm font-medium"
						>
							{showAllRated ? m.tv_showFewer() : m.tv_showAll()}
						</button>
					{/if}
				{/if}
			</section>
		</div>
	</section>

	<section class="user-section" style="--section-index: 3">
		<div class="user-section__header">
			<p class="user-section__eyebrow">{todoSectionTitle}</p>
			<h2 class="text-2xl font-semibold tracking-tight md:text-3xl">{todoSectionTitle}</h2>
			<p class="max-w-3xl text-sm text-muted-foreground md:text-base">
				{todoSectionDescription}
			</p>
		</div>
		<div class="grid grid-cols-1 gap-6 lg:grid-cols-[18rem_minmax(0,1fr)]">
			<div class="stats-kpi stats-kpi--archive jf-surface-soft rounded-2xl p-4 md:p-5">
				<div class="stats-kpi__head">
					<div class="text-xs text-muted-foreground">{m.stats_watchedButNotRated()}</div>
					<div class="stats-kpi__icon-shell" aria-hidden="true">
						<IconStar class="stats-kpi__icon" />
					</div>
				</div>
				<div class="mt-1 text-3xl font-semibold tracking-tight tabular-nums"><span use:countUp={{ value: todoCount }}>{formatNumber(todoCount)}</span></div>
				<div class="mt-1 text-xs text-muted-foreground">
					{#if todoCount === 0}
						{m.stats_allWatchedItemsAreRatedNice()}
					{:else}
						{m.stats_upTo50()}
					{/if}
				</div>
			</div>

			<section class="stats-panel rounded-3xl p-5 md:p-6">
				<div class="stats-panel__header flex items-baseline justify-between gap-3">
					<h3 class="text-base font-semibold tracking-tight md:text-lg">{m.stats_watchedButNotRated()}</h3>
					<div class="text-xs text-muted-foreground">{m.stats_upTo50()}</div>
				</div>
				{#if (data.stats.watchedButNotRated ?? []).length === 0}
					<p class="stats-empty mt-4 text-sm text-muted-foreground">
						{m.stats_allWatchedItemsAreRatedNice()}
					</p>
				{:else}
					<div class="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
						{#each data.stats.watchedButNotRated as item (item.id)}
							<a href={item.href} class="user-todo-item stats-link">
								<div class="truncate text-sm font-medium">{item.title}</div>
								<div class="text-xs text-muted-foreground">{formatMediaTypeLabel(item.type)}</div>
							</a>
						{/each}
					</div>
				{/if}
			</section>
		</div>
	</section>
</div>

<style>
	.stats-page {
		--stats-border: color-mix(in oklch, var(--foreground) 11%, transparent);
		--stats-border-strong: color-mix(in oklch, var(--foreground) 18%, transparent);
		--stats-border-accent: color-mix(in oklch, var(--primary) 42%, transparent);
		--stats-ease-out-quart: cubic-bezier(0.25, 1, 0.5, 1);
		--stats-ease-out-quint: cubic-bezier(0.22, 1, 0.36, 1);
		--stats-ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
		--stats-surface: linear-gradient(
			160deg,
			color-mix(in oklch, var(--card) 86%, var(--background) 14%),
			color-mix(in oklch, var(--background) 78%, var(--card) 22%)
		);
		--stats-surface-soft: linear-gradient(
			180deg,
			color-mix(in oklch, var(--foreground) 4%, transparent),
			color-mix(in oklch, var(--foreground) 1.5%, transparent)
		);
		--stats-shadow: 0 26px 70px -42px rgba(2, 6, 23, 0.9);
	}

	.stats-hero {
		position: relative;
		overflow: hidden;
		transform-origin: 50% 0%;
	}

	.stats-hero::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(110% 100% at 12% 8%, color-mix(in oklch, var(--primary) 18%, transparent), transparent 66%),
			radial-gradient(80% 90% at 100% 0%, color-mix(in oklch, var(--foreground) 8%, transparent), transparent 70%),
			linear-gradient(180deg, color-mix(in oklch, var(--foreground) 5%, transparent), transparent 28%);
		pointer-events: none;
	}

	.stats-hero::after {
		content: '';
		position: absolute;
		inset: -14% auto auto 58%;
		width: 18rem;
		height: 18rem;
		border-radius: 999px;
		background: radial-gradient(circle, color-mix(in oklch, var(--primary) 24%, transparent), transparent 68%);
		filter: blur(22px);
		opacity: 0.45;
		pointer-events: none;
	}

	.user-section {
		margin-top: clamp(2.25rem, 4vw, 4rem);
	}

	.user-section__header {
		display: grid;
		gap: 0.35rem;
		margin-bottom: 1.25rem;
	}

	.user-section__eyebrow {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--primary) 58%, var(--muted-foreground) 42%);
	}

	.stats-kpi {
		position: relative;
		overflow: hidden;
		min-height: 7.75rem;
		display: grid;
		align-content: start;
		gap: 0.18rem;
		contain: paint;
		transition:
			transform 280ms var(--stats-ease-out-quint),
			box-shadow 280ms var(--stats-ease-out-quint),
			border-color 280ms var(--stats-ease-out-quint),
			background-color 280ms var(--stats-ease-out-quint);
	}

	.stats-kpi::before {
		content: '';
		position: absolute;
		inset: 0;
		background: radial-gradient(
			100% 100% at 0% 0%,
			color-mix(in oklch, var(--primary) 10%, transparent),
			transparent 70%
		);
		opacity: 0.9;
		pointer-events: none;
	}

	.stats-kpi__head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.8rem;
	}

	.stats-kpi__icon-shell {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		flex: 0 0 auto;
		height: auto;
		width: auto;
		padding: 0.1rem;
		border: 0;
		background: none;
		box-shadow: none;
		opacity: 0.96;
	}

	.stats-kpi__icon-shell :global(svg) {
		width: 1.55rem;
		height: 1.55rem;
		stroke-width: 1.65;
		color: color-mix(in oklch, var(--stats-kpi-accent, var(--primary)) 82%, white 18%);
		transition:
			transform 260ms var(--stats-ease-out-quint),
			filter 260ms var(--stats-ease-out-quint),
			color 260ms var(--stats-ease-out-quint);
		filter: drop-shadow(
			0 6px 16px color-mix(in srgb, var(--stats-kpi-accent, var(--primary)) 18%, transparent)
		);
	}

	.stats-kpi:hover {
		transform: translateY(-4px);
		box-shadow:
			var(--stats-shadow),
			0 0 0 1px color-mix(in oklch, var(--stats-kpi-accent, var(--primary)) 22%, transparent);
	}

	.stats-kpi:hover .stats-kpi__icon-shell :global(svg) {
		transform: translateY(-1px) rotate(-5deg) scale(1.05);
		filter: drop-shadow(
			0 10px 24px color-mix(in srgb, var(--stats-kpi-accent, var(--primary)) 24%, transparent)
		);
	}

	.stats-kpi--catalog {
		--stats-kpi-accent: var(--primary);
	}

	.stats-kpi--community {
		--stats-kpi-accent: var(--primary);
	}

	.stats-kpi--archive {
		--stats-kpi-accent: var(--chart-4);
	}

	.stats-panel {
		position: relative;
		overflow: hidden;
		border: 1px solid var(--stats-border);
		background: var(--stats-surface);
		box-shadow: var(--stats-shadow);
		backdrop-filter: blur(18px) saturate(112%);
		-webkit-backdrop-filter: blur(18px) saturate(112%);
		contain: paint;
		transition:
			transform 320ms var(--stats-ease-out-quint),
			border-color 320ms var(--stats-ease-out-quint),
			box-shadow 320ms var(--stats-ease-out-quint);
	}

	.stats-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(120% 110% at 0% 0%, color-mix(in oklch, var(--primary) 11%, transparent), transparent 68%),
			linear-gradient(180deg, color-mix(in oklch, var(--foreground) 3%, transparent), transparent 22%);
		opacity: 0.9;
		transition: opacity 320ms var(--stats-ease-out-quint);
		pointer-events: none;
	}

	.stats-panel:hover {
		transform: translateY(-3px);
		border-color: var(--stats-border-accent);
	}

	.stats-panel:hover::before {
		opacity: 1;
	}

	.stats-panel__header,
	.stats-empty {
		position: relative;
		z-index: 1;
	}

	.stats-pill {
		display: inline-flex;
		align-items: center;
		border-radius: 999px;
		border: 1px solid var(--stats-border-strong);
		background: color-mix(in oklch, var(--background) 55%, transparent);
		padding: 0.4rem 0.78rem;
		backdrop-filter: blur(10px);
		-webkit-backdrop-filter: blur(10px);
		transition:
			transform 220ms var(--stats-ease-out-quint),
			border-color 220ms var(--stats-ease-out-quint),
			background-color 220ms var(--stats-ease-out-quint);
	}

	.stats-pill:hover {
		transform: translateY(-1px);
		border-color: var(--stats-border-accent);
	}

	.stats-link {
		text-decoration-color: color-mix(in oklch, var(--primary) 45%, transparent);
		text-underline-offset: 0.16em;
		transition:
			color 220ms var(--stats-ease-out-expo),
			text-decoration-color 220ms var(--stats-ease-out-expo),
			background-color 220ms var(--stats-ease-out-expo),
			border-color 220ms var(--stats-ease-out-expo),
			transform 220ms var(--stats-ease-out-expo);
	}

	.stats-link:hover {
		text-decoration: underline;
		text-decoration-color: color-mix(in oklch, var(--primary) 78%, transparent);
	}

	.stats-link:focus-visible {
		outline: none;
		border-radius: 0.75rem;
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 24%, transparent);
	}

	.stats-empty {
		max-width: 42ch;
		line-height: 1.55;
	}

	.stats-meter {
		border-radius: 1rem;
		padding: 0.5rem 0.75rem;
		background: color-mix(in oklch, var(--foreground) 2.5%, transparent);
		transition:
			transform 240ms var(--stats-ease-out-quint),
			background-color 240ms var(--stats-ease-out-quint);
	}

	.stats-meter__track {
		overflow: hidden;
		background: color-mix(in oklch, var(--muted) 62%, transparent);
	}

	.stats-meter__fill {
		transform-origin: 0 50%;
		transition:
			transform 280ms var(--stats-ease-out-quint),
			box-shadow 280ms var(--stats-ease-out-quint);
		box-shadow: 0 0 18px -8px color-mix(in oklch, var(--primary) 70%, transparent);
	}

	.stats-panel:hover .stats-meter {
		transform: translateX(2px);
	}

	.stats-panel:hover .stats-meter__fill {
		transform: scaleX(1.015);
	}

	.user-review,
	.user-list-item,
	.user-todo-item {
		position: relative;
		z-index: 1;
		border: 1px solid var(--stats-border);
		background:
			var(--stats-surface-soft),
			color-mix(in oklch, var(--card) 72%, transparent);
		box-shadow: inset 0 1px 0 color-mix(in oklch, white 5%, transparent);
		transition:
			transform 260ms var(--stats-ease-out-quint),
			border-color 260ms var(--stats-ease-out-quint),
			box-shadow 260ms var(--stats-ease-out-quint),
			background-color 260ms var(--stats-ease-out-quint);
	}

	.user-review:hover {
		transform: translateY(-2px);
		border-color: var(--stats-border-accent);
		box-shadow:
			inset 0 1px 0 color-mix(in oklch, white 5%, transparent),
			0 18px 40px -34px rgba(2, 6, 23, 0.92);
	}

	.user-list-item,
	.user-todo-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		border-radius: 1rem;
		padding: 0.85rem 0.95rem;
		text-decoration: none;
		color: inherit;
	}

	.user-list-item:hover,
	.user-todo-item:hover {
		transform: translateY(-2px) scale(1.005);
		border-color: var(--stats-border-accent);
		text-decoration: none;
	}

	.user-rating-pill {
		flex: 0 0 auto;
		border-radius: 999px;
		border: 1px solid var(--stats-border-strong);
		background: color-mix(in oklch, var(--background) 62%, transparent);
		padding: 0.35rem 0.7rem;
		font-size: 0.8rem;
		font-weight: 600;
		transition:
			transform 240ms var(--stats-ease-out-quint),
			background-color 240ms var(--stats-ease-out-quint),
			border-color 240ms var(--stats-ease-out-quint);
	}

	.user-list-item:hover .user-rating-pill {
		transform: translateX(-2px) scale(1.03);
		border-color: var(--stats-border-accent);
		background: color-mix(in oklch, var(--primary) 10%, var(--background) 90%);
	}

	.user-button {
		border: 1px solid var(--stats-border-strong);
		background: color-mix(in oklch, var(--background) 65%, transparent);
		transition:
			background-color 220ms var(--stats-ease-out-expo),
			border-color 220ms var(--stats-ease-out-expo),
			transform 220ms var(--stats-ease-out-expo),
			box-shadow 220ms var(--stats-ease-out-expo);
	}

	.user-button:hover {
		transform: translateY(-1px);
		background: color-mix(in oklch, var(--primary) 10%, var(--background) 90%);
		border-color: var(--stats-border-accent);
	}

	.user-button:active {
		transform: scale(0.97);
	}

	.user-button:focus-visible {
		outline: none;
		box-shadow: 0 0 0 3px color-mix(in oklch, var(--primary) 24%, transparent);
	}

	.user-button:disabled {
		opacity: 0.45;
		cursor: not-allowed;
		transform: none;
	}

	.user-pagination {
		position: relative;
		z-index: 1;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		flex-wrap: wrap;
	}

	.motion-review-stack,
	.motion-rated-stack {
		position: relative;
		z-index: 1;
	}

	@keyframes stats-hero-in {
		0% {
			opacity: 0;
			transform: translateY(24px) scale(0.985);
		}

		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes stats-section-in {
		0% {
			opacity: 0;
			transform: translateY(26px);
		}

		100% {
			opacity: 1;
			transform: translateY(0);
		}
	}

	@keyframes stats-card-in {
		0% {
			opacity: 0;
			transform: translateY(18px) scale(0.985);
		}

		100% {
			opacity: 1;
			transform: translateY(0) scale(1);
		}
	}

	@keyframes stats-glow-drift {
		0%,
		100% {
			transform: translate3d(0, 0, 0) scale(1);
			opacity: 0.38;
		}

		50% {
			transform: translate3d(-10px, 10px, 0) scale(1.06);
			opacity: 0.5;
		}
	}

	@media (prefers-reduced-motion: no-preference) {
		.motion-hero {
			animation: stats-hero-in 720ms var(--stats-ease-out-expo) both;
		}

		.stats-hero::after {
			animation: stats-glow-drift 8s var(--stats-ease-out-quart) infinite;
		}

		.user-section {
			opacity: 0;
			animation: stats-section-in 620ms var(--stats-ease-out-expo) both;
			animation-delay: calc(140ms + (var(--section-index, 0) * 110ms));
		}

		.motion-kpi-grid > *,
		.motion-panel-grid > *,
		.motion-review-stack > *,
		.motion-rated-stack > * {
			opacity: 0;
			animation: stats-card-in 520ms var(--stats-ease-out-expo) both;
			will-change: transform, opacity;
		}

		.motion-kpi-grid > :nth-child(1),
		.motion-panel-grid > :nth-child(1),
		.motion-review-stack > :nth-child(1),
		.motion-rated-stack > :nth-child(1) {
			animation-delay: 220ms;
		}

		.motion-kpi-grid > :nth-child(2),
		.motion-panel-grid > :nth-child(2),
		.motion-review-stack > :nth-child(2),
		.motion-rated-stack > :nth-child(2) {
			animation-delay: 300ms;
		}

		.motion-kpi-grid > :nth-child(3),
		.motion-panel-grid > :nth-child(3),
		.motion-review-stack > :nth-child(3),
		.motion-rated-stack > :nth-child(3) {
			animation-delay: 380ms;
		}

		.motion-kpi-grid > :nth-child(4),
		.motion-panel-grid > :nth-child(4),
		.motion-review-stack > :nth-child(4),
		.motion-rated-stack > :nth-child(4) {
			animation-delay: 460ms;
		}

		.motion-kpi-grid > :nth-child(5),
		.motion-panel-grid > :nth-child(5),
		.motion-rated-stack > :nth-child(5) {
			animation-delay: 540ms;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.stats-hero,
		.user-section,
		.motion-kpi-grid > *,
		.motion-panel-grid > *,
		.motion-review-stack > *,
		.motion-rated-stack > * {
			animation: none !important;
		}

		.stats-hero::after {
			animation: none !important;
		}

		.stats-link,
		.user-button,
		.stats-kpi,
		.stats-panel,
		.stats-pill,
		.stats-meter,
		.stats-meter__fill,
		.user-review,
		.user-list-item,
		.user-todo-item,
		.user-rating-pill,
		.stats-kpi__icon-shell :global(svg) {
			transition: none;
		}

		.stats-kpi:hover,
		.stats-panel:hover,
		.stats-pill:hover,
		.user-review:hover,
		.user-list-item:hover,
		.user-todo-item:hover,
		.user-button:hover {
			transform: none;
		}

		.stats-panel:hover .stats-meter,
		.stats-panel:hover .stats-meter__fill,
		.stats-kpi:hover .stats-kpi__icon-shell :global(svg),
		.user-list-item:hover .user-rating-pill {
			transform: none;
		}
	}

	@media (max-width: 640px) {
		.stats-kpi {
			min-height: auto;
		}

		.user-section__header {
			margin-bottom: 1rem;
		}
	}
</style>
