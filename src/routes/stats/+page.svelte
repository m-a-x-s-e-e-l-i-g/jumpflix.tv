<script lang="ts">
	import { countUp } from '$lib/actions/countUp';
	import * as m from '$lib/paraglide/messages';
	import {
		IconCalendarStats,
		IconReceiptEuro,
		IconCredits,
		IconDeviceTv,
		IconListDetails,
		IconMapPin,
		IconMessage2,
		IconMovie,
		IconMusic,
		IconRun,
		IconStar,
		IconUsersGroup
	} from '@tabler/icons-svelte';
	import XPopMark from '$lib/components/XPopMark.svelte';

	type Overview = {
		total_users: number;
		users_signed_in_last_15m: number;
		users_signed_in_last_24h: number;
		ratings_count: number;
		reviews_count: number;
		average_rating: number;
		watch_history_rows: number;
		watch_users: number;
		watched_items: number;
		total_position_seconds: number;
		total_duration_seconds: number;
		avg_percent_watched: number;
	};

	type WatchActivityRow = {
		day: string;
		active_users: number;
		updates: number;
		watched_updates: number;
	};

	type RatingsDistRow = {
		rating: number;
		count: number;
	};

	type TopWatchedRow = {
		media_id: string;
		media_type: string;
		watchers: number;
		avg_percent: number;
		title: string;
		href: string | null;
		subtitle: string | null;
	};

	type TopContributorRow = {
		user_id: string;
		username: string;
		watched_count: number;
		ratings_count: number;
		reviews_count: number;
		suggestions_count: number;
		xp_total: number;
	};

	type CatalogCounts = {
		movies: number;
		series: number;
		episodes: number;
	};

	type MusicStats = {
		tracks: number;
		trackLinks: number;
	};

	type SpotsStats = {
		approvedSpotChapters: number;
	};

	type PeopleStats = {
		creators: number;
		athletes: number;
	};

	type YearsCovered = {
		min: number | null;
		max: number | null;
	};

	type FundingSummary = {
		totalCosts: Array<{ amount: number; currency: string }>;
		totalDonations: Array<{ amount: number; currency: string }>;
		totalCostsEur: number;
		totalDonationsEur: number;
		netBalanceEur: number;
		costsCount: number;
		donationsCount: number;
	};

	let { data } = $props<{
		data: {
			overview: Overview;
			catalog: CatalogCounts;
			music: MusicStats;
			spots: SpotsStats;
			peopleStats: PeopleStats;
			yearsCovered: YearsCovered;
			fundingSummary: FundingSummary;
			watchActivity: WatchActivityRow[];
			ratingsDistribution: RatingsDistRow[];
			topWatchedMedia: TopWatchedRow[];
			topContributors: TopContributorRow[];
		};
	}>();

	const yearsCoveredLabel: string = $derived(
		(() => {
			const min = data.yearsCovered?.min;
			const max = data.yearsCovered?.max;
			if (min == null || max == null) return '—';
			if (min === max) return String(min);
			return `${min} – ${max}`;
		})()
	);

	const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
	const formatMoney = (amount: number, currency: string): string =>
		new Intl.NumberFormat(undefined, {
			style: 'currency',
			currency,
			minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
			maximumFractionDigits: 2
		}).format(amount);
	const formatEuro = (amount: number): string => formatMoney(amount, 'EUR');
    const totalCostsLabel: string = $derived(
		data.fundingSummary?.costsCount
			? formatEuro(data.fundingSummary.totalCostsEur ?? 0)
			: '—'
	);

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

	type ActivityPoint = { x: string; y: number };

	const activityPoints: ActivityPoint[] = $derived(
		(data.watchActivity ?? []).map((row: WatchActivityRow) => ({
			x: row.day,
			y: row.active_users
		}))
	);

	const activityYMax: number = $derived(
		Math.max(1, ...activityPoints.map((point) => point.y ?? 0))
	);
	const activityTotal: number = $derived(activityPoints.reduce((acc, p) => acc + (p.y ?? 0), 0));
	const activityAvg: number = $derived(
		activityPoints.length ? activityTotal / activityPoints.length : 0
	);
	const activityPeak: number = $derived(
		Math.max(0, ...activityPoints.map((point) => point.y ?? 0))
	);
	const activityYTicks: { t: number; value: number; y: number }[] = $derived(
		[0, 0.25, 0.5, 0.75, 1].map((t) => {
			const value = Math.round(activityYMax * t);
			const y = 190 - t * 150;
			return { t, value, y };
		})
	);
	const activityStartLabel: string = $derived(activityPoints[0]?.x ?? '');
	const activityEndLabel: string = $derived(activityPoints[activityPoints.length - 1]?.x ?? '');
	const activityTickIndexes: number[] = $derived(
		(() => {
			const n = activityPoints.length;
			if (n <= 1) return [0];
			const indexes = new Set<number>();
			indexes.add(0);
			indexes.add(n - 1);
			indexes.add(Math.round((n - 1) * 0.33));
			indexes.add(Math.round((n - 1) * 0.66));
			return Array.from(indexes).sort((a, b) => a - b);
		})()
	);

	const activityPathD: string = $derived(
		'M ' +
			activityPoints
				.map((point, index) => {
					const x =
						activityPoints.length === 1 ? 300 : (index / (activityPoints.length - 1)) * 560 + 20;
					const y = 190 - ((point.y ?? 0) / activityYMax) * 150;
					return `${x} ${y}`;
				})
				.join(' L ')
	);

	const ratingMax: number = $derived(
		Math.max(1, ...(data.ratingsDistribution ?? []).map((row: RatingsDistRow) => row.count ?? 0))
	);
</script>

<svelte:head>
	<title>{m.stats_title()}</title>
</svelte:head>

<div class="stats-page mx-auto w-full max-w-6xl p-4 md:p-8">
	<div class="stats-hero jf-surface mt-[50px] mb-6 rounded-3xl p-6 md:p-8">
		<a
			href="/"
			class="stats-link inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>{m.stats_backToCatalog()}</span>
		</a>
		<h1 class="jf-display mt-4 max-w-4xl text-[clamp(2.5rem,6vw,4.75rem)] leading-none text-balance">
			{m.stats_title()}
		</h1>
		<p class="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
			{m.stats_publicDescription()}
		</p>
		<div class="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
			<span class="stats-pill">{m.stats_badge_noPersonalData()}</span>
			<span class="stats-pill">{m.stats_badge_aggregatedMetricsOnly()}</span>
			<span class="stats-pill">{m.stats_badge_updatedContinuously()}</span>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
		<div class="stats-kpi stats-kpi--catalog jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_films()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconMovie class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.catalog.movies ?? 0 }}>{formatNumber(data.catalog.movies ?? 0)}</span>
			</div>
		</div>
		<div class="stats-kpi stats-kpi--catalog jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_series()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconDeviceTv class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.catalog.series ?? 0 }}>{formatNumber(data.catalog.series ?? 0)}</span>
			</div>
		</div>
		<div class="stats-kpi stats-kpi--catalog jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_episodes()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconListDetails class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.catalog.episodes ?? 0 }}>{formatNumber(data.catalog.episodes ?? 0)}</span>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.stats_acrossFilmsAndSeries()}</div>
		</div>
		<div class="stats-kpi stats-kpi--music jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_tracks()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconMusic class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.music.tracks ?? 0 }}>{formatNumber(data.music.tracks ?? 0)}</span>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{m.stats_videoTrackLinksCount({ count: formatNumber(data.music.trackLinks ?? 0) })}
			</div>
		</div>
		<div class="stats-kpi stats-kpi--maps jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.tv_spots()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconMapPin class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.spots.approvedSpotChapters ?? 0 }}>{formatNumber(data.spots.approvedSpotChapters ?? 0)}</span>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.tv_approvedSpotChapters()}</div>
		</div>
		<div class="stats-kpi stats-kpi--community jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_totalRegisteredUsers()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconUsersGroup class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.overview.total_users ?? 0 }}>{formatNumber(data.overview.total_users ?? 0)}</span>
			</div>
		</div>
		<div class="stats-kpi stats-kpi--community jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_averageRating()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconStar class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.overview.average_rating ?? 0, options: { decimalPlaces: 2 } }}>{(data.overview.average_rating ?? 0).toFixed(2)}</span>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{m.stats_ratingsCount({ count: formatNumber(data.overview.ratings_count ?? 0) })}
			</div>
		</div>
		<div class="stats-kpi stats-kpi--community jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_reviewsPosted()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconMessage2 class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.overview.reviews_count ?? 0 }}>{formatNumber(data.overview.reviews_count ?? 0)}</span>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.stats_acrossFilmsAndSeries()}</div>
		</div>
		<div class="stats-kpi stats-kpi--people jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_creators()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconCredits class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.peopleStats.creators ?? 0 }}>{formatNumber(data.peopleStats.creators ?? 0)}</span>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.stats_uniqueNamesInCredits()}</div>
		</div>
		<div class="stats-kpi stats-kpi--people jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_athletes()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconRun class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">
				<span use:countUp={{ value: data.peopleStats.athletes ?? 0 }}>{formatNumber(data.peopleStats.athletes ?? 0)}</span>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.stats_uniqueNamesInStarring()}</div>
		</div>
		<div class="stats-kpi stats-kpi--archive jf-surface-soft rounded-2xl p-4 md:p-5">
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_yearsCovered()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconCalendarStats class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{yearsCoveredLabel}</div>
			<div class="mt-1 text-xs text-muted-foreground">{m.stats_basedOnCatalogYearMetadata()}</div>
		</div>
		<a
			href="/costs"
			class="stats-kpi stats-kpi--archive stats-kpi--link jf-surface-soft rounded-2xl p-4 md:p-5"
		>
			<div class="stats-kpi__head">
				<div class="text-xs text-muted-foreground">{m.stats_approxCosts()}</div>
				<div class="stats-kpi__icon-shell" aria-hidden="true">
					<IconReceiptEuro class="stats-kpi__icon" />
				</div>
			</div>
			<div class="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{totalCostsLabel}</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{m.stats_publicCostEntries({ count: formatNumber(data.fundingSummary.costsCount ?? 0) })}
			</div>
		</a>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<section class="stats-panel rounded-3xl p-5 md:p-6">
			<div class="stats-panel__header flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold tracking-tight md:text-lg">{m.stats_watchActivity30d()}</h2>
				<div class="text-xs text-muted-foreground">
					{#if activityStartLabel && activityEndLabel}
						{activityStartLabel} → {activityEndLabel}
					{:else}
						{m.stats_dailyActiveWatchers()}
					{/if}
				</div>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{m.stats_watchActivitySummary({
					peak: formatNumber(activityPeak),
					avgPerDay: formatNumber(Math.round(activityAvg))
				})}
			</div>

			{#if activityPoints.length === 0}
				<p class="stats-empty mt-4 text-sm text-muted-foreground">{m.stats_noActivityYet()}</p>
			{:else}
				<svg viewBox="0 0 600 220" class="stats-chart mt-4 h-56 w-full" aria-label={m.stats_watchActivity30d()}>
					<rect x="0" y="0" width="600" height="220" rx="16" class="fill-muted/20" />
					{#each activityYTicks as tick (tick.t)}
						<line
							x1="20"
							x2="580"
							y1={tick.y}
							y2={tick.y}
							class="stroke-muted/40"
							stroke-width="1"
						/>
						<text x="22" y={tick.y - 4} class="fill-muted-foreground" font-size="10"
							>{tick.value}</text
						>
					{/each}
					{#each activityTickIndexes as idx (idx)}
						{@const label = activityPoints[idx]?.x ?? ''}
						{@const x =
							activityPoints.length === 1 ? 300 : (idx / (activityPoints.length - 1)) * 560 + 20}
						{#if label}
							<text {x} y="212" text-anchor="middle" class="fill-muted-foreground" font-size="10">
								{label}
							</text>
						{/if}
					{/each}
					{#each activityPoints as p, i (p.x)}
						{@const x =
							activityPoints.length === 1 ? 300 : (i / (activityPoints.length - 1)) * 560 + 20}
						{@const y = 190 - ((p.y ?? 0) / activityYMax) * 150}
						<circle cx={x} cy={y} r="3" class="fill-primary" />
					{/each}
					<path
						d={activityPathD}
						class="fill-none stroke-primary"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				</svg>
			{/if}
		</section>

		<section class="stats-panel rounded-3xl p-5 md:p-6">
			<div class="stats-panel__header flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold tracking-tight md:text-lg">{m.stats_ratingsDistribution()}</h2>
				<div class="text-xs text-muted-foreground">1–10</div>
			</div>

			<div class="mt-4 grid gap-2.5">
				{#each data.ratingsDistribution as row (row.rating)}
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
		</section>
	</div>

	<section class="stats-panel mt-8 rounded-3xl p-5 md:p-6">
		<div class="stats-panel__header flex items-baseline justify-between gap-3">
			<h2 class="text-base font-semibold tracking-tight md:text-lg">{m.stats_topWatched()}</h2>
			<div class="text-xs text-muted-foreground">{m.stats_byUniqueWatchers()}</div>
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="stats-table w-full min-w-[42rem] text-sm">
				<thead class="text-left text-xs text-muted-foreground">
					<tr>
						<th class="py-2 pr-4">{m.stats_tableTitle()}</th>
						<th class="py-2 pr-4">{m.stats_tableType()}</th>
						<th class="py-2 pr-4">{m.stats_tableWatchers()}</th>
						<th class="py-2 pr-4">{m.stats_tableAvgPercent()}</th>
					</tr>
				</thead>
				<tbody>
					{#each data.topWatchedMedia as row (row.media_id)}
						<tr>
							<td class="py-2 pr-4">
								{#if row.href}
									<a href={row.href} class="stats-link font-medium">{row.title}</a>
								{:else}
									<span class="font-medium">{row.title}</span>
								{/if}
								{#if row.subtitle}
									<div class="text-xs text-muted-foreground">{row.subtitle}</div>
								{/if}
							</td>
							<td class="py-2 pr-4">{formatMediaTypeLabel(row.media_type)}</td>
							<td class="py-2 pr-4 tabular-nums">{formatNumber(row.watchers ?? 0)}</td>
							<td class="py-2 pr-4 tabular-nums">{(row.avg_percent ?? 0).toFixed(1)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</section>

	<section class="stats-panel mt-8 rounded-3xl p-5 md:p-6">
		<div class="stats-panel__header flex items-baseline justify-between gap-3">
			<h2 class="text-base font-semibold tracking-tight md:text-lg">{m.stats_topContributors()}</h2>
			<div class="text-xs text-muted-foreground">
				<XPopMark text={m.stats_byXpSystem()} iconClass="size-3.5" textClass="normal-case" />
			</div>
		</div>

		{#if (data.topContributors ?? []).length === 0}
			<p class="stats-empty mt-4 text-sm text-muted-foreground">{m.stats_noContributorsYet()}</p>
		{:else}
			<div class="mt-4 overflow-x-auto">
				<table class="stats-table w-full min-w-[52rem] text-sm">
					<thead class="text-left text-xs text-muted-foreground">
						<tr>
							<th class="py-2 pr-4">{m.stats_tableUser()}</th>
							<th class="py-2 pr-4">{m.stats_watchedItems()}</th>
							<th class="py-2 pr-4">{m.stats_tableRatings()}</th>
							<th class="py-2 pr-4">{m.stats_tableReviews()}</th>
							<th class="py-2 pr-4">{m.stats_suggestionsSubmitted()}</th>
							<th class="py-2 pr-4">
								<XPopMark text={m.stats_totalXp()} iconClass="size-3.5" textClass="normal-case" />
							</th>
						</tr>
					</thead>
					<tbody>
						{#each data.topContributors as row (row.user_id)}
							<tr>
								<td class="py-2 pr-4">
									<a href={`/stats/${row.user_id}`} class="stats-link font-medium">
										{row.username}
									</a>
								</td>
								<td class="py-2 pr-4 tabular-nums">{formatNumber(row.watched_count ?? 0)}</td>
								<td class="py-2 pr-4 tabular-nums">{formatNumber(row.ratings_count ?? 0)}</td>
								<td class="py-2 pr-4 tabular-nums">{formatNumber(row.reviews_count ?? 0)}</td>
								<td class="py-2 pr-4 tabular-nums">
									{formatNumber(row.suggestions_count ?? 0)}
								</td>
								<td class="py-2 pr-4 tabular-nums">{formatNumber(row.xp_total ?? 0)}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</section>
</div>

<style>
	.stats-page {
		--stats-border: color-mix(in oklch, var(--foreground) 11%, transparent);
		--stats-border-strong: color-mix(in oklch, var(--foreground) 18%, transparent);
		--stats-border-accent: color-mix(in oklch, var(--primary) 42%, transparent);
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

	.stats-kpi {
		position: relative;
		overflow: hidden;
		min-height: 7.75rem;
		display: grid;
		align-content: start;
		gap: 0.18rem;
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

	.stats-kpi--link {
		text-decoration: none;
		color: inherit;
		transition:
			transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1),
			background-color 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.stats-kpi--link:hover {
		transform: translateY(-2px);
		box-shadow:
			var(--stats-shadow),
			0 0 0 1px color-mix(in oklch, var(--stats-kpi-accent, var(--primary)) 26%, transparent);
	}

	.stats-kpi--link:focus-visible {
		outline: none;
		transform: translateY(-1px);
		box-shadow:
			var(--stats-shadow),
			0 0 0 3px color-mix(in oklch, var(--stats-kpi-accent, var(--primary)) 24%, transparent);
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
		filter: drop-shadow(
			0 6px 16px color-mix(in srgb, var(--stats-kpi-accent, var(--primary)) 18%, transparent)
		);
	}

	.stats-kpi--catalog {
		--stats-kpi-accent: var(--primary);
	}

	.stats-kpi--music {
		--stats-kpi-accent: var(--chart-3);
	}

	.stats-kpi--maps {
		--stats-kpi-accent: var(--chart-1);
	}

	.stats-kpi--community {
		--stats-kpi-accent: var(--primary);
	}

	.stats-kpi--people {
		--stats-kpi-accent: var(--chart-2);
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
	}

	.stats-panel::before {
		content: '';
		position: absolute;
		inset: 0;
		background:
			radial-gradient(120% 110% at 0% 0%, color-mix(in oklch, var(--primary) 11%, transparent), transparent 68%),
			linear-gradient(180deg, color-mix(in oklch, var(--foreground) 3%, transparent), transparent 22%);
		pointer-events: none;
	}

	.stats-panel__header,
	.stats-chart,
	.stats-table,
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
	}

	.stats-link {
		text-decoration-color: color-mix(in oklch, var(--primary) 45%, transparent);
		text-underline-offset: 0.16em;
		transition:
			color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			text-decoration-color 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.stats-link:hover {
		text-decoration: underline;
		text-decoration-color: color-mix(in oklch, var(--primary) 78%, transparent);
	}

	.stats-link:focus-visible {
		outline: none;
		border-radius: 0.35rem;
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
	}

	.stats-meter__track {
		overflow: hidden;
		background: color-mix(in oklch, var(--muted) 62%, transparent);
	}

	.stats-meter__fill {
		box-shadow: 0 0 18px -8px color-mix(in oklch, var(--primary) 70%, transparent);
	}

	.stats-chart {
		overflow: visible;
	}

	.stats-table {
		border-collapse: separate;
		border-spacing: 0 0.6rem;
	}

	.stats-table thead th {
		padding-top: 0;
		padding-bottom: 0.15rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: color-mix(in oklch, var(--muted-foreground) 92%, transparent);
	}

	.stats-table tbody td {
		border-top: 1px solid var(--stats-border);
		border-bottom: 1px solid var(--stats-border);
		background:
			var(--stats-surface-soft),
			color-mix(in oklch, var(--card) 72%, transparent);
		padding-top: 0.9rem;
		padding-bottom: 0.9rem;
		transition:
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			background 220ms cubic-bezier(0.16, 1, 0.3, 1),
			transform 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.stats-table tbody td:first-child {
		border-left: 1px solid var(--stats-border);
		border-radius: 1rem 0 0 1rem;
		padding-left: 1rem;
	}

	.stats-table tbody td:last-child {
		border-right: 1px solid var(--stats-border);
		border-radius: 0 1rem 1rem 0;
	}

	.stats-table tbody tr:hover td,
	.stats-table tbody tr:focus-within td {
		border-color: var(--stats-border-accent);
		background:
			linear-gradient(
				180deg,
				color-mix(in oklch, var(--primary) 10%, transparent),
				color-mix(in oklch, var(--foreground) 2%, transparent)
			),
			color-mix(in oklch, var(--card) 78%, transparent);
	}

	@media (prefers-reduced-motion: reduce) {
		.stats-link,
		.stats-table tbody td {
			transition: none;
		}
	}

	@media (max-width: 640px) {
		.stats-kpi {
			min-height: auto;
		}

		.stats-table {
			border-spacing: 0 0.5rem;
		}
	}
</style>
