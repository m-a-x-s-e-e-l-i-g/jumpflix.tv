<script lang="ts">
	import { browser } from '$app/environment';
	import { dev } from '$app/environment';
	import { Image } from '@unpic/svelte';
	import * as m from '$lib/paraglide/messages';
	import { familySafeOnly } from '$lib/tv/store';
	import type { ContentItem, Movie, Series } from '$lib/tv/types';
	import { isFamilySafeContent, isImage, keyFor } from '$lib/tv/utils';
	import ShieldOffIcon from 'lucide-svelte/icons/shield-off';
	import {
		getLatestWatchProgressByBaseId,
		getSeriesProgressSummary,
		watchHistoryVersion
	} from '$lib/tv/watchHistory';

	let {
		listElement = $bindable<HTMLElement | null>(null),
		visibleContent = [],
		selectedContent = null,
		onSelect
	}: {
		listElement?: HTMLElement | null;
		visibleContent?: ContentItem[];
		selectedContent?: ContentItem | null;
		onSelect: (item: ContentItem) => void;
	} = $props();

	const UNRATED = '__unrated__';

	function getCreators(item: ContentItem): string[] {
		return Array.isArray(item.creators) ? item.creators : [];
	}

	function getStarring(item: ContentItem): string[] {
		return Array.isArray(item.starring) ? item.starring : [];
	}

	function getEpisodeCount(item: Series): number | null {
		const count = Number(item.episodeCount);
		return Number.isFinite(count) && count > 0 ? Math.floor(count) : null;
	}

	type RowWatchState = {
		isWatched: boolean;
		hasProgress: boolean;
		progressPercent: number;
	};

	function metaParts(item: ContentItem): string[] {
		const parts: string[] = [item.type === 'movie' ? m.tv_pillFilm() : m.tv_pillSeries()];
		if (item.type === 'movie' && item.year) parts.push(item.year);
		if (item.type === 'movie' && item.duration) parts.push(item.duration);
		if (item.type === 'series') {
			const count = getEpisodeCount(item);
			if (count) parts.push(m.tv_episodeCount({ count: String(count) }));
		}
		return parts;
	}

	function peopleLine(item: ContentItem): string | null {
		const creators = getCreators(item);
		const starring = getStarring(item);
		const parts: string[] = [];
		if (creators.length) parts.push(`${m.tv_creators()}: ${creators.join(', ')}`);
		if (starring.length) parts.push(`${m.tv_starring()}: ${starring.join(', ')}`);
		return parts.length ? parts.join('  •  ') : null;
	}

	function ratingLabel(item: ContentItem): string {
		const ratingValue = typeof item.averageRating === 'number' ? item.averageRating : null;
		const ratingCount = typeof item.ratingCount === 'number' ? item.ratingCount : 0;
		return ratingValue !== null && ratingCount > 0
			? `${ratingValue.toFixed(1)} (${ratingCount})`
			: UNRATED;
	}

	function ratingText(label: string): string {
		return label === UNRATED ? m.tv_noRatings() : label;
	}

	function rowAriaLabel(item: ContentItem, watchState: RowWatchState, rating: string): string {
		const parts = [item.title, ...metaParts(item)];
		if (watchState.isWatched) parts.push(m.tv_showWatched());
		if (watchState.hasProgress) parts.push(`${m.tv_continue()} ${watchState.progressPercent}%`);
		if (familySafeOnlyEnabled && !isFamilySafeContent(item)) parts.push('Family safe only blocked');
		parts.push(ratingText(rating));
		return parts.join(' • ');
	}

	const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

	function isWithinLastWeek(value?: string): boolean {
		if (!value || typeof value !== 'string') return false;
		const ts = Date.parse(value);
		if (!Number.isFinite(ts)) return false;
		return Date.now() - ts <= ONE_WEEK_MS;
	}

	function buildBaseId(item: ContentItem): string {
		return `${item.type}:${item.id}`;
	}

	function getWatchState(item: ContentItem, _watchVersion: number): RowWatchState {
		if (!browser) {
			return { isWatched: false, hasProgress: false, progressPercent: 0 };
		}

		const baseId = buildBaseId(item);
		if (item.type === 'series') {
			const totalEpisodesRaw = Number((item as any)?.episodeCount);
			const totalEpisodes =
				Number.isFinite(totalEpisodesRaw) && totalEpisodesRaw > 0
					? Math.floor(totalEpisodesRaw)
					: null;
			const summary = getSeriesProgressSummary(baseId, { totalEpisodes });
			if (!summary) {
				return { isWatched: false, hasProgress: false, progressPercent: 0 };
			}

			const progressPercent = Math.min(99, Math.max(1, Math.round(summary.percent || 0)));
			return {
				isWatched: summary.isWatched,
				hasProgress: !summary.isWatched && summary.percent > 0 && summary.percent < 85,
				progressPercent: summary.percent > 0 ? progressPercent : 0
			};
		}

		const progress = getLatestWatchProgressByBaseId(baseId);
		if (!progress) {
			return { isWatched: false, hasProgress: false, progressPercent: 0 };
		}

		const progressPercent = Math.min(99, Math.max(1, Math.round(progress.percent || 0)));
		return {
			isWatched: progress.isWatched,
			hasProgress: !progress.isWatched && progress.percent > 0 && progress.percent < 85,
			progressPercent: progress.percent > 0 ? progressPercent : 0
		};
	}

	const watchStates = $derived(
		new Map(visibleContent.map((item) => [keyFor(item), getWatchState(item, $watchHistoryVersion)]))
	);
	const familySafeOnlyEnabled = $derived($familySafeOnly);
</script>

<div id="catalog" class="catalog-shell">
	{#if visibleContent.length === 0}
		<div class="catalog-empty">
			<img
				src="/images/searching-jumpflix-logo.webp"
				alt="Searching Jumpflix"
				width="220"
				height="160"
				class="catalog-empty-image"
				loading="lazy"
				decoding="async"
			/>
			<div>{m.tv_noResults()}</div>
		</div>
	{:else}
		<div bind:this={listElement} class="catalog-list">
			{#each visibleContent as item (keyFor(item))}
				{@const itemKey = keyFor(item)}
				{@const watchState = watchStates.get(keyFor(item)) ?? {
					isWatched: false,
					hasProgress: false,
					progressPercent: 0
				}}
				{@const itemRating = ratingLabel(item)}
				{@const hasRating = itemRating !== UNRATED}
				{@const peopleSummary = peopleLine(item)}
				{@const rowSelected = !!(selectedContent && selectedContent.id === item.id && selectedContent.type === item.type)}
				{@const familySafeBlocked = familySafeOnlyEnabled && !isFamilySafeContent(item)}
				<button
					type="button"
					class:selected={rowSelected}
					class="catalog-row"
					aria-pressed={rowSelected}
					aria-disabled={familySafeBlocked}
					data-family-safe-blocked={familySafeBlocked ? '' : undefined}
					aria-label={rowAriaLabel(item, watchState, itemRating)}
					data-item-key={itemKey}
					onclick={() => onSelect(item)}
				>
					<div class="catalog-thumb">
						{#if isImage(item.thumbnail)}
							<Image
								src={item.thumbnail}
								alt={item.title}
								loading="lazy"
								decoding="async"
								width={120}
								height={180}
								cdn={dev ? undefined : 'netlify'}
								layout="constrained"
							/>
						{:else}
							<div class="catalog-thumb-fallback">{item.title}</div>
						{/if}
					</div>

					<div class="catalog-body">
						<div class="catalog-header-row">
							<h3 class="catalog-title">{item.title}</h3>
							<div class="catalog-meta jf-label">{metaParts(item).join(' • ')}</div>
						</div>

						<div class="catalog-badges">
							{#if isWithinLastWeek(item.createdAt) && !watchState.isWatched}
								<span class="catalog-badge catalog-badge--new">{m.tv_new()}</span>
							{/if}
							{#if item.paid && !watchState.isWatched}
								<span class="catalog-badge catalog-badge--paid">{m.tv_paid()}</span>
							{/if}
							{#if watchState.isWatched}
								<span class="catalog-badge catalog-badge--watched">{m.tv_showWatched()}</span>
							{:else if watchState.hasProgress}
								<span class="catalog-badge catalog-badge--progress">
									{m.tv_continue()} {watchState.progressPercent}%
								</span>
							{/if}
							{#if familySafeBlocked}
								<span class="catalog-badge catalog-badge--family-safe" aria-label="Not family-safe"><ShieldOffIcon size={12} /></span>
							{/if}
						</div>

						{#if item.description}
							<p class="catalog-description">{item.description}</p>
						{/if}

						{#if peopleSummary}
							<p class="catalog-people">{peopleSummary}</p>
						{/if}

						{#if watchState.hasProgress}
							<div class="catalog-progress" aria-label={`${m.tv_continueWatchingAt()} ${watchState.progressPercent}%`}>
								<div class="catalog-progress-track">
									<div class="catalog-progress-fill" style:width={`${watchState.progressPercent}%`}></div>
								</div>
							</div>
						{/if}
					</div>

					<div class="catalog-side">
						<span class:catalog-rating--empty={!hasRating} class="catalog-rating">
							★ {ratingText(itemRating)}
						</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.catalog-shell {
		--catalog-border: color-mix(in oklch, var(--foreground) 12%, transparent);
		--catalog-border-strong: color-mix(in oklch, var(--foreground) 20%, transparent);
		--catalog-row-bg: linear-gradient(
			145deg,
			color-mix(in oklch, var(--card) 68%, var(--background) 32%),
			color-mix(in oklch, var(--background) 88%, var(--card) 12%)
		);
		--catalog-row-bg-hover: linear-gradient(
			145deg,
			color-mix(in oklch, var(--card) 82%, var(--background) 18%),
			color-mix(in oklch, var(--background) 72%, var(--card) 28%)
		);
		--catalog-row-bg-selected: linear-gradient(
			145deg,
			color-mix(in oklch, var(--card) 78%, var(--primary) 22%),
			color-mix(in oklch, var(--background) 70%, var(--card) 30%)
		);
		--catalog-row-shadow: 0 18px 42px -30px rgba(2, 6, 23, 0.92);
		--catalog-row-shadow-hover: 0 24px 52px -34px rgba(2, 6, 23, 0.96);
		--catalog-primary-soft: color-mix(in oklch, var(--primary) 18%, transparent);
		--catalog-primary-border: color-mix(in oklch, var(--primary) 48%, transparent);
		--catalog-muted-soft: color-mix(in oklch, var(--muted-foreground) 14%, transparent);
		--catalog-gold-soft: color-mix(in oklch, var(--chart-3) 18%, transparent);
		--catalog-gold-border: color-mix(in oklch, var(--chart-3) 34%, transparent);
		position: relative;
		z-index: 20;
		margin: 0;
		padding: 2.5rem clamp(1.5rem, 3vw, 3.75rem) 6rem;
	}

	.catalog-row[data-family-safe-blocked] {
		opacity: 0.88;
	}

	.catalog-badge--family-safe {
		background: rgba(8, 12, 24, 0.82);
		border-color: rgba(248, 250, 252, 0.18);
		color: rgba(248, 250, 252, 0.72);
		padding: 0.2rem 0.35rem;
		line-height: 1;
	}

	.catalog-list {
		display: flex;
		flex-direction: column;
		gap: 0.9rem;
	}

	.catalog-row {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr) 9.5rem;
		gap: 1rem 1.25rem;
		align-items: stretch;
		width: 100%;
		border-radius: calc(var(--radius) + 0.45rem);
		border: 1px solid var(--catalog-border);
		background: var(--catalog-row-bg);
		box-shadow: var(--catalog-row-shadow);
		padding: 1rem;
		text-align: left;
		color: inherit;
		transition:
			transform 220ms cubic-bezier(0.16, 1, 0.3, 1),
			border-color 220ms cubic-bezier(0.16, 1, 0.3, 1),
			background 220ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 220ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.catalog-row:hover,
	.catalog-row:focus-visible {
		transform: translateY(-1px);
		border-color: var(--catalog-primary-border);
		background: var(--catalog-row-bg-hover);
		box-shadow:
			0 0 0 1px color-mix(in oklch, var(--primary) 18%, transparent),
			var(--catalog-row-shadow-hover);
		outline: none;
	}

	.catalog-row.selected {
		border-color: color-mix(in oklch, var(--primary) 68%, transparent);
		background: var(--catalog-row-bg-selected);
		box-shadow:
			0 0 0 1px color-mix(in oklch, var(--primary) 24%, transparent),
			0 28px 58px -36px rgba(65, 9, 16, 0.82);
	}

	.catalog-thumb {
		aspect-ratio: 2 / 3;
		width: 7rem;
		overflow: hidden;
		border-radius: calc(var(--radius) + 0.1rem);
		background:
			linear-gradient(
				180deg,
				color-mix(in oklch, var(--primary) 12%, transparent),
				color-mix(in oklch, var(--background) 82%, var(--card) 18%)
			);
		border: 1px solid color-mix(in oklch, var(--foreground) 10%, transparent);
		box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--background) 25%, transparent);
	}

	.catalog-thumb :global(img) {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.catalog-thumb-fallback {
		display: grid;
		place-items: center;
		height: 100%;
		padding: 0.75rem;
		font-size: 0.8rem;
		font-weight: 600;
		line-height: 1.35;
		text-align: center;
		color: color-mix(in oklch, var(--foreground) 84%, transparent);
	}

	.catalog-body {
		min-width: 0;
		display: flex;
		flex-direction: column;
		justify-content: center;
	}

	.catalog-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.7rem;
	}

	.catalog-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.32rem 0.68rem;
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border: 1px solid var(--catalog-border-strong);
		background: color-mix(in oklch, var(--background) 84%, var(--card) 16%);
		color: color-mix(in oklch, var(--foreground) 94%, transparent);
	}

	.catalog-badge--new {
		background: color-mix(in oklch, var(--primary) 80%, var(--background) 20%);
		border-color: color-mix(in oklch, var(--primary) 52%, transparent);
		color: color-mix(in oklch, var(--primary-foreground) 96%, transparent);
	}

	.catalog-badge--paid {
		background: color-mix(in oklch, var(--chart-3) 20%, var(--background) 80%);
		border-color: color-mix(in oklch, var(--chart-3) 42%, transparent);
		color: color-mix(in oklch, var(--chart-3) 82%, white 18%);
	}

	.catalog-badge--watched {
		background: color-mix(in oklch, var(--muted) 76%, var(--background) 24%);
		border-color: color-mix(in oklch, var(--muted-foreground) 30%, transparent);
		color: color-mix(in oklch, var(--foreground) 90%, transparent);
	}

	.catalog-badge--progress {
		background: var(--catalog-primary-soft);
		border-color: color-mix(in oklch, var(--primary) 34%, transparent);
		color: color-mix(in oklch, var(--primary) 58%, white 42%);
	}

	.catalog-header-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem 0.9rem;
		align-items: baseline;
	}

	.catalog-title {
		margin: 0;
		display: -webkit-box;
		overflow: hidden;
		font-size: 1.02rem;
		font-weight: 700;
		line-height: 1.28;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
		color: color-mix(in oklch, var(--foreground) 96%, transparent);
	}

	.catalog-meta {
		font-size: 0.68rem;
		line-height: 1.2;
		color: color-mix(in oklch, var(--muted-foreground) 90%, transparent);
	}

	.catalog-description,
		.catalog-people {
		margin: 0.55rem 0 0;
		overflow: hidden;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.catalog-description {
		font-size: 0.92rem;
		line-height: 1.58;
		max-width: 68ch;
		color: color-mix(in oklch, var(--foreground) 80%, transparent);
	}

	.catalog-people {
		font-size: 0.78rem;
		line-height: 1.55;
		max-width: 72ch;
		color: color-mix(in oklch, var(--muted-foreground) 96%, transparent);
	}

	.catalog-progress {
		margin-top: 0.85rem;
	}

	.catalog-progress-track {
		height: 0.4rem;
		width: 100%;
		overflow: hidden;
		border-radius: 999px;
		background: color-mix(in oklch, var(--muted) 82%, transparent);
	}

	.catalog-progress-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(
			90deg,
			color-mix(in oklch, var(--primary) 85%, white 15%),
			color-mix(in oklch, var(--primary) 58%, white 42%)
		);
	}

	.catalog-side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		justify-content: center;
		gap: 0.45rem;
		width: 9.5rem;
	}

	.catalog-rating {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		border-radius: 999px;
		padding: 0.44rem 0.8rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		font-variant-numeric: tabular-nums;
	}

	.catalog-rating {
		border: 1px solid var(--catalog-gold-border);
		background: var(--catalog-gold-soft);
		color: color-mix(in oklch, var(--chart-3) 82%, white 18%);
	}

	.catalog-rating--empty {
		border-color: var(--catalog-border);
		background: var(--catalog-muted-soft);
		color: color-mix(in oklch, var(--muted-foreground) 88%, transparent);
	}

	.catalog-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1rem;
		padding: 3rem 0;
		text-align: center;
		color: color-mix(in oklch, var(--muted-foreground) 90%, transparent);
	}

	.catalog-empty-image {
		height: auto;
		width: 12rem;
		max-width: 100%;
		opacity: 0.88;
	}

	@media (prefers-reduced-motion: reduce) {
		.catalog-row {
			transition: none;
		}

		.catalog-row:hover,
		.catalog-row:focus-visible {
			transform: none;
		}
	}

	@media (max-width: 767px) {
		.catalog-shell {
			padding: 2rem 1.25rem 4rem;
		}

		.catalog-row {
			grid-template-columns: 5rem minmax(0, 1fr);
			gap: 0.85rem 1rem;
			padding: 0.85rem;
		}

		.catalog-thumb {
			width: 5rem;
		}

		.catalog-title {
			font-size: 0.96rem;
		}

		.catalog-description {
			font-size: 0.88rem;
		}

		.catalog-side {
			grid-column: 2;
			flex-direction: row;
			align-items: center;
			justify-content: flex-start;
			width: auto;
		}
	}
</style>