<script lang="ts">
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

	type CatalogCounts = {
		movies: number;
		series: number;
		episodes: number;
	};

	type MusicStats = {
		tracks: number;
		trackLinks: number;
	};

	type PeopleStats = {
		creators: number;
		athletes: number;
	};

	type YearsCovered = {
		min: number | null;
		max: number | null;
	};

	type FacetCountRow = { key: string; count: number };
	type FacetStats = {
		contentCounts: { movies: number; series: number };
		facetType: FacetCountRow[];
		environment: FacetCountRow[];
		filmStyle: FacetCountRow[];
		theme: FacetCountRow[];
		mood: FacetCountRow[];
		movement: FacetCountRow[];
	};

	let { data } = $props<{
		data: {
			overview: Overview;
			catalog: CatalogCounts;
			music: MusicStats;
			peopleStats: PeopleStats;
			yearsCovered: YearsCovered;
			facetStats: FacetStats;
			watchActivity: WatchActivityRow[];
			ratingsDistribution: RatingsDistRow[];
			topWatchedMedia: TopWatchedRow[];
		};
	}>();

	const yearsCoveredLabel: string = $derived((() => {
		const min = data.yearsCovered?.min;
		const max = data.yearsCovered?.max;
		if (min == null || max == null) return '—';
		if (min === max) return String(min);
		return `${min} – ${max}`;
	})());

	const formatNumber = (value: number) => new Intl.NumberFormat().format(value);

	type ActivityPoint = { x: string; y: number };

	const activityPoints: ActivityPoint[] = $derived(
		(data.watchActivity ?? []).map((row: WatchActivityRow) => ({
			x: row.day,
			y: row.active_users
		}))
	);

	const activityYMax: number = $derived(Math.max(1, ...activityPoints.map((point) => point.y ?? 0)));
	const activityTotal: number = $derived(activityPoints.reduce((acc, p) => acc + (p.y ?? 0), 0));
	const activityAvg: number = $derived(activityPoints.length ? activityTotal / activityPoints.length : 0);
	const activityPeak: number = $derived(Math.max(0, ...activityPoints.map((point) => point.y ?? 0)));
	const activityYTicks: { t: number; value: number; y: number }[] = $derived(
		[0, 0.25, 0.5, 0.75, 1].map((t) => {
			const value = Math.round(activityYMax * t);
			const y = 190 - t * 150;
			return { t, value, y };
		})
	);
	const activityStartLabel: string = $derived(activityPoints[0]?.x ?? '');
	const activityEndLabel: string = $derived(activityPoints[activityPoints.length - 1]?.x ?? '');
	const activityTickIndexes: number[] = $derived((() => {
		const n = activityPoints.length;
		if (n <= 1) return [0];
		const indexes = new Set<number>();
		indexes.add(0);
		indexes.add(n - 1);
		indexes.add(Math.round((n - 1) * 0.33));
		indexes.add(Math.round((n - 1) * 0.66));
		return Array.from(indexes).sort((a, b) => a - b);
	})());

	const activityPathD: string = $derived(
		'M ' +
			activityPoints
				.map((point, index) => {
					const x =
						activityPoints.length === 1
							? 300
							: (index / (activityPoints.length - 1)) * 560 + 20;
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
	<title>Stats</title>
</svelte:head>

<div class="mx-auto w-full max-w-6xl p-4 md:p-8">
	<div class="mt-[50px] mb-6 rounded-3xl jf-surface p-6 md:p-8">
		<a
			href="/"
			class="inline-flex items-center gap-2 text-sm text-muted-foreground transition hover:text-foreground"
		>
			<span aria-hidden="true">←</span>
			<span>Back to catalog</span>
		</a>
		<h1 class="mt-4 text-3xl font-semibold tracking-tight md:text-5xl">Stats</h1>
		<p class="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
			A public, aggregated overview of Jumpflix activity and catalog data.
		</p>
		<div class="mt-4 flex flex-wrap gap-2 text-xs text-muted-foreground">
			<span class="rounded-full border bg-background/60 px-3 py-1">No personal data</span>
			<span class="rounded-full border bg-background/60 px-3 py-1">Aggregated metrics only</span>
			<span class="rounded-full border bg-background/60 px-3 py-1">Updated continuously</span>
		</div>
	</div>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-2xl jf-surface-soft p-4">
			<div class="text-xs text-muted-foreground">Movies</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.catalog.movies ?? 0)}</div>
		</div>
		<div class="rounded-2xl jf-surface-soft p-4">
			<div class="text-xs text-muted-foreground">Series</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.catalog.series ?? 0)}</div>
		</div>
		<div class="rounded-2xl jf-surface-soft p-4">
			<div class="text-xs text-muted-foreground">Episodes</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.catalog.episodes ?? 0)}</div>
		</div>
		<div class="rounded-2xl jf-surface-soft p-4">
			<div class="text-xs text-muted-foreground">Tracks</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.music.tracks ?? 0)}</div>
			<div class="mt-1 text-xs text-muted-foreground">
				{formatNumber(data.music.trackLinks ?? 0)} video track links
			</div>
		</div>
		<div class="rounded-2xl jf-surface-soft p-4">
			<div class="text-xs text-muted-foreground">Total registered users</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.overview.total_users ?? 0)}</div>
		</div>
		<div class="rounded-2xl jf-surface-soft p-4">
			<div class="text-xs text-muted-foreground">Average rating</div>
			<div class="mt-1 text-2xl font-semibold">{(data.overview.average_rating ?? 0).toFixed(2)}</div>
			<div class="mt-1 text-xs text-muted-foreground">{formatNumber(data.overview.ratings_count ?? 0)} ratings</div>
		</div>
		<div class="rounded-2xl jf-surface-soft p-4">
			<div class="text-xs text-muted-foreground">Reviews posted</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.overview.reviews_count ?? 0)}</div>
			<div class="mt-1 text-xs text-muted-foreground">Across films + series</div>
		</div>
		<div class="rounded-2xl jf-surface-soft p-4">
			<div class="text-xs text-muted-foreground">Creators</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.peopleStats.creators ?? 0)}</div>
			<div class="mt-1 text-xs text-muted-foreground">Unique names in credits</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Athletes</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.peopleStats.athletes ?? 0)}</div>
			<div class="mt-1 text-xs text-muted-foreground">Unique names in starring</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Years covered</div>
			<div class="mt-1 text-2xl font-semibold">{yearsCoveredLabel}</div>
			<div class="mt-1 text-xs text-muted-foreground">Based on catalog year metadata</div>
		</div>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="rounded-xl border p-4">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold">Watch activity (30d)</h2>
				<div class="text-xs text-muted-foreground">
					{#if activityStartLabel && activityEndLabel}
						{activityStartLabel} → {activityEndLabel}
					{:else}
						Daily active watchers
					{/if}
				</div>
			</div>
			<div class="mt-1 text-xs text-muted-foreground">
				Peak {formatNumber(activityPeak)} · Avg/day {formatNumber(Math.round(activityAvg))}
			</div>

			{#if activityPoints.length === 0}
				<p class="mt-4 text-sm text-muted-foreground">No activity yet.</p>
			{:else}
				<svg viewBox="0 0 600 220" class="mt-4 h-56 w-full">
					<rect x="0" y="0" width="600" height="220" rx="16" class="fill-muted/20" />
					{#each activityYTicks as tick (tick.t)}
						<line x1="20" x2="580" y1={tick.y} y2={tick.y} class="stroke-muted/40" stroke-width="1" />
						<text x="22" y={tick.y - 4} class="fill-muted-foreground" font-size="10">{tick.value}</text>
					{/each}
					{#each activityTickIndexes as idx (idx)}
						{@const label = activityPoints[idx]?.x ?? ''}
						{@const x = activityPoints.length === 1 ? 300 : (idx / (activityPoints.length - 1)) * 560 + 20}
						{#if label}
							<text x={x} y="212" text-anchor="middle" class="fill-muted-foreground" font-size="10">
								{label}
							</text>
						{/if}
					{/each}
					{#each activityPoints as p, i (p.x)}
						{@const x = activityPoints.length === 1 ? 300 : (i / (activityPoints.length - 1)) * 560 + 20}
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
		</div>

		<div class="rounded-xl border p-4">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold">Ratings distribution</h2>
				<div class="text-xs text-muted-foreground">1–10</div>
			</div>

			<div class="mt-4 grid gap-2">
				{#each data.ratingsDistribution as row (row.rating)}
					<div class="grid grid-cols-[2rem_1fr_4rem] items-center gap-3">
						<div class="text-sm tabular-nums">{row.rating}</div>
						<div class="h-2 rounded bg-muted/40">
							<div
								class="h-2 rounded bg-primary"
								style={`width: ${Math.round(((row.count ?? 0) / ratingMax) * 100)}%`}
							></div>
						</div>
						<div class="text-right text-sm tabular-nums text-muted-foreground">{formatNumber(row.count ?? 0)}</div>
					</div>
				{/each}
			</div>
		</div>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="rounded-xl border p-4">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold">Facets</h2>
				<div class="text-xs text-muted-foreground">Top tags across the catalog</div>
			</div>
			<div class="mt-4 grid gap-4">
				<div>
					<div class="mb-2 text-xs text-muted-foreground">Type</div>
					{#if (data.facetStats.facetType ?? []).length === 0}
						<div class="text-sm text-muted-foreground">No facet data.</div>
					{:else}
						<div class="grid gap-2">
							{#each data.facetStats.facetType as row (row.key)}
								<div class="grid grid-cols-[1fr_4rem] items-center gap-3">
									<div class="text-sm capitalize">{row.key}</div>
									<div class="text-right text-sm tabular-nums text-muted-foreground">{formatNumber(row.count)}</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<div>
					<div class="mb-2 text-xs text-muted-foreground">Environment</div>
					<div class="grid gap-2">
						{#each data.facetStats.environment as row (row.key)}
							<div class="grid grid-cols-[1fr_4rem] items-center gap-3">
								<div class="text-sm capitalize">{row.key}</div>
								<div class="text-right text-sm tabular-nums text-muted-foreground">{formatNumber(row.count)}</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>

		<div class="rounded-xl border p-4">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold">More facets</h2>
				<div class="text-xs text-muted-foreground">Style · Theme · Mood</div>
			</div>
			<div class="mt-4 grid gap-4">
				<div>
					<div class="mb-2 text-xs text-muted-foreground">Film style</div>
					<div class="grid gap-2">
						{#each data.facetStats.filmStyle as row (row.key)}
							<div class="grid grid-cols-[1fr_4rem] items-center gap-3">
								<div class="text-sm capitalize">{row.key}</div>
								<div class="text-right text-sm tabular-nums text-muted-foreground">{formatNumber(row.count)}</div>
							</div>
						{/each}
					</div>
				</div>
				<div>
					<div class="mb-2 text-xs text-muted-foreground">Theme</div>
					<div class="grid gap-2">
						{#each data.facetStats.theme as row (row.key)}
							<div class="grid grid-cols-[1fr_4rem] items-center gap-3">
								<div class="text-sm capitalize">{row.key}</div>
								<div class="text-right text-sm tabular-nums text-muted-foreground">{formatNumber(row.count)}</div>
							</div>
						{/each}
					</div>
				</div>
				<div>
					<div class="mb-2 text-xs text-muted-foreground">Mood</div>
					<div class="grid gap-2">
						{#each data.facetStats.mood as row (row.key)}
							<div class="grid grid-cols-[1fr_4rem] items-center gap-3">
								<div class="text-sm capitalize">{row.key}</div>
								<div class="text-right text-sm tabular-nums text-muted-foreground">{formatNumber(row.count)}</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</div>
	</div>

	<div class="mt-8 rounded-xl border p-4">
		<div class="flex items-baseline justify-between gap-3">
			<h2 class="text-base font-semibold">Top watched</h2>
			<div class="text-xs text-muted-foreground">By unique watchers</div>
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="text-left text-xs text-muted-foreground">
					<tr>
						<th class="py-2 pr-4">Title</th>
						<th class="py-2 pr-4">Type</th>
						<th class="py-2 pr-4">Watchers</th>
						<th class="py-2 pr-4">Avg %</th>
					</tr>
				</thead>
				<tbody>
					{#each data.topWatchedMedia as row (row.media_id)}
						<tr class="border-t">
							<td class="py-2 pr-4">
								{#if row.href}
									<a href={row.href} class="font-medium hover:underline">{row.title}</a>
								{:else}
									<span class="font-medium">{row.title}</span>
								{/if}
								{#if row.subtitle}
									<div class="text-xs text-muted-foreground">{row.subtitle}</div>
								{/if}
							</td>
							<td class="py-2 pr-4 capitalize">{row.media_type}</td>
							<td class="py-2 pr-4 tabular-nums">{formatNumber(row.watchers ?? 0)}</td>
							<td class="py-2 pr-4 tabular-nums">{(row.avg_percent ?? 0).toFixed(1)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
