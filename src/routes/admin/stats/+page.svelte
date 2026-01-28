<script lang="ts">
	type Overview = {
		total_users: number;
		users_signed_in_last_15m: number;
		users_signed_in_last_24h: number;
		ratings_count: number;
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
	};

	let { data } = $props<{
		data: {
			overview: Overview;
			watchActivity: WatchActivityRow[];
			ratingsDistribution: RatingsDistRow[];
			topWatchedMedia: TopWatchedRow[];
		};
	}>();

	const formatNumber = (value: number) => new Intl.NumberFormat().format(value);
	const formatHours = (seconds: number) => {
		const hours = seconds / 3600;
		return `${hours.toFixed(hours >= 100 ? 0 : 1)}h`;
	};

	type ActivityPoint = { x: string; y: number };

	const activityPoints: ActivityPoint[] = $derived(
		(data.watchActivity ?? []).map((row: WatchActivityRow) => ({
			x: row.day,
			y: row.active_users
		}))
	);

	const activityYMax: number = $derived(Math.max(1, ...activityPoints.map((point) => point.y ?? 0)));

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
	<title>Admin · Stats</title>
</svelte:head>

<div class="mx-auto w-full max-w-6xl p-4 md:p-8">
	<div class="mb-6">
		<h1 class="text-2xl font-semibold">Stats</h1>
		<p class="text-sm text-muted-foreground">Admin-only analytics overview.</p>
	</div>

	<div class="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Total users</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.overview.total_users ?? 0)}</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Active (15m)</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.overview.users_signed_in_last_15m ?? 0)}</div>
			<div class="mt-1 text-xs text-muted-foreground">Based on Supabase last sign-in.</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Active (24h)</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.overview.users_signed_in_last_24h ?? 0)}</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Avg rating</div>
			<div class="mt-1 text-2xl font-semibold">{(data.overview.average_rating ?? 0).toFixed(2)}</div>
			<div class="mt-1 text-xs text-muted-foreground">{formatNumber(data.overview.ratings_count ?? 0)} ratings</div>
		</div>

		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Watchers</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.overview.watch_users ?? 0)}</div>
			<div class="mt-1 text-xs text-muted-foreground">Users with active watch history rows</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Watch rows</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.overview.watch_history_rows ?? 0)}</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Watched items</div>
			<div class="mt-1 text-2xl font-semibold">{formatNumber(data.overview.watched_items ?? 0)}</div>
		</div>
		<div class="rounded-xl border p-4">
			<div class="text-xs text-muted-foreground">Total progress</div>
			<div class="mt-1 text-2xl font-semibold">{formatHours(data.overview.total_position_seconds ?? 0)}</div>
			<div class="mt-1 text-xs text-muted-foreground">Sum of latest known positions</div>
		</div>
	</div>

	<div class="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div class="rounded-xl border p-4">
			<div class="flex items-baseline justify-between gap-3">
				<h2 class="text-base font-semibold">Watch activity (30d)</h2>
				<div class="text-xs text-muted-foreground">Daily active watchers</div>
			</div>

			{#if activityPoints.length === 0}
				<p class="mt-4 text-sm text-muted-foreground">No activity yet.</p>
			{:else}
				<svg viewBox="0 0 600 220" class="mt-4 h-56 w-full">
					<rect x="0" y="0" width="600" height="220" rx="16" class="fill-muted/20" />
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

	<div class="mt-8 rounded-xl border p-4">
		<div class="flex items-baseline justify-between gap-3">
			<h2 class="text-base font-semibold">Top watched</h2>
			<div class="text-xs text-muted-foreground">By distinct watchers</div>
		</div>

		<div class="mt-4 overflow-x-auto">
			<table class="w-full text-sm">
				<thead class="text-left text-xs text-muted-foreground">
					<tr>
						<th class="py-2 pr-4">Media</th>
						<th class="py-2 pr-4">Type</th>
						<th class="py-2 pr-4">Watchers</th>
						<th class="py-2 pr-4">Avg %</th>
					</tr>
				</thead>
				<tbody>
					{#each data.topWatchedMedia as row (row.media_id)}
						<tr class="border-t">
							<td class="py-2 pr-4 font-mono text-xs">{row.media_id}</td>
							<td class="py-2 pr-4">{row.media_type}</td>
							<td class="py-2 pr-4 tabular-nums">{formatNumber(row.watchers ?? 0)}</td>
							<td class="py-2 pr-4 tabular-nums">{(row.avg_percent ?? 0).toFixed(1)}%</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>
	</div>
</div>
