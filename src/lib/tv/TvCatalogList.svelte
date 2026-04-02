<script lang="ts">
	import { browser } from '$app/environment';
	import { dev } from '$app/environment';
	import { Image } from '@unpic/svelte';
	import * as m from '$lib/paraglide/messages';
	import type { ContentItem } from '$lib/tv/types';
	import { isImage, keyFor } from '$lib/tv/utils';
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

	type RowWatchState = {
		isWatched: boolean;
		hasProgress: boolean;
		progressPercent: number;
	};

	function metaParts(item: ContentItem): string[] {
		const parts: string[] = [item.type === 'movie' ? 'Movie' : 'Series'];
		if (item.type === 'movie' && item.year) parts.push(item.year);
		if (item.type === 'movie' && item.duration) parts.push(item.duration);
		if (item.type === 'series') {
			const count = Number((item as any)?.episodeCount);
			if (Number.isFinite(count) && count > 0) {
				parts.push(`${Math.floor(count)} eps`);
			}
		}
		return parts;
	}

	function peopleLine(item: ContentItem): string | null {
		const creators = Array.isArray((item as any)?.creators) ? ((item as any).creators as string[]) : [];
		const starring = Array.isArray((item as any)?.starring) ? ((item as any).starring as string[]) : [];
		const parts: string[] = [];
		if (creators.length) parts.push(`Creators: ${creators.join(', ')}`);
		if (starring.length) parts.push(`Athletes: ${starring.join(', ')}`);
		return parts.length ? parts.join('  •  ') : null;
	}

	function ratingLabel(item: ContentItem): string {
		const ratingValue = typeof item.averageRating === 'number' ? item.averageRating : null;
		const ratingCount = typeof item.ratingCount === 'number' ? item.ratingCount : 0;
		return ratingValue !== null && ratingCount > 0 ? `${ratingValue.toFixed(1)} (${ratingCount})` : 'No ratings';
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
				{@const watchState = watchStates.get(keyFor(item)) ?? {
					isWatched: false,
					hasProgress: false,
					progressPercent: 0
				}}
				{@const itemRating = ratingLabel(item)}
				{@const hasRating = itemRating !== 'No ratings'}
				<button
					type="button"
					class:selected={!!(selectedContent && selectedContent.id === item.id && selectedContent.type === item.type)}
					class="catalog-row"
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
							<div class="catalog-meta">{metaParts(item).join(' • ')}</div>
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
						</div>

						{#if item.description}
							<p class="catalog-description">{item.description}</p>
						{/if}

						{#if peopleLine(item)}
							<p class="catalog-people">{peopleLine(item)}</p>
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
							★ {itemRating}
						</span>
					</div>
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.catalog-shell {
		position: relative;
		z-index: 20;
		margin: 0;
		padding: 2.5rem clamp(1.5rem, 3vw, 3.75rem) 6rem;
	}

	.catalog-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.catalog-row {
		display: grid;
		grid-template-columns: 7rem minmax(0, 1fr) 9.5rem;
		gap: 1rem;
		align-items: center;
		width: 100%;
		border-radius: 1.25rem;
		border: 1px solid rgba(148, 163, 184, 0.18);
		background: rgba(8, 12, 24, 0.6);
		padding: 0.9rem;
		text-align: left;
		color: inherit;
		transition:
			transform 180ms ease,
			border-color 180ms ease,
			background 180ms ease,
			box-shadow 180ms ease;
	}

	.catalog-row:hover,
	.catalog-row:focus-visible {
		transform: translateY(-1px);
		border-color: rgba(229, 9, 20, 0.38);
		background: rgba(10, 16, 30, 0.82);
		box-shadow: 0 18px 40px -28px rgba(2, 6, 23, 0.95);
		outline: none;
	}

	.catalog-row.selected {
		border-color: rgba(229, 9, 20, 0.68);
		background: rgba(15, 22, 40, 0.92);
		box-shadow: 0 0 0 1px rgba(229, 9, 20, 0.2) inset;
	}

	.catalog-thumb {
		aspect-ratio: 2 / 3;
		width: 7rem;
		overflow: hidden;
		border-radius: 0.95rem;
		background:
			linear-gradient(180deg, rgba(37, 99, 235, 0.18), rgba(15, 23, 42, 0.18)),
			rgba(15, 23, 42, 0.9);
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
		color: rgba(226, 232, 240, 0.82);
	}

	.catalog-body {
		min-width: 0;
	}

	.catalog-badges {
		display: flex;
		flex-wrap: wrap;
		gap: 0.45rem;
		margin-top: 0.6rem;
	}

	.catalog-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		border-radius: 999px;
		padding: 0.28rem 0.62rem;
		font-size: 0.64rem;
		font-weight: 700;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		border: 1px solid rgba(248, 250, 252, 0.18);
		background: rgba(8, 12, 24, 0.72);
		color: rgba(248, 250, 252, 0.92);
	}

	.catalog-badge--new {
		background: linear-gradient(135deg, rgba(190, 10, 24, 0.98), rgba(156, 8, 20, 0.92));
		border-color: rgba(239, 68, 68, 0.7);
		color: #fff;
	}

	.catalog-badge--paid {
		background: linear-gradient(135deg, rgba(250, 204, 21, 0.98), rgba(245, 158, 11, 0.92));
		border-color: rgba(252, 211, 77, 0.9);
		color: rgba(24, 24, 24, 0.95);
	}

	.catalog-badge--watched {
		background: rgba(10, 16, 28, 0.85);
		border-color: rgba(148, 163, 184, 0.55);
		color: rgba(226, 232, 240, 0.9);
	}

	.catalog-badge--progress {
		background: rgba(229, 9, 20, 0.14);
		border-color: rgba(229, 9, 20, 0.3);
		color: rgba(254, 226, 226, 0.96);
	}

	.catalog-header-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.6rem 0.9rem;
		align-items: baseline;
	}

	.catalog-title {
		margin: 0;
		font-size: 1rem;
		font-weight: 700;
		color: rgba(248, 250, 252, 0.96);
	}

	.catalog-meta {
		font-size: 0.72rem;
		letter-spacing: 0.14em;
		text-transform: uppercase;
		color: rgba(148, 163, 184, 0.86);
	}

	.catalog-description,
		.catalog-people {
		margin: 0.45rem 0 0;
		overflow: hidden;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 2;
	}

	.catalog-description {
		font-size: 0.92rem;
		line-height: 1.5;
		color: rgba(226, 232, 240, 0.8);
	}

	.catalog-people {
		font-size: 0.78rem;
		line-height: 1.45;
		color: rgba(148, 163, 184, 0.9);
	}

	.catalog-progress {
		margin-top: 0.75rem;
	}

	.catalog-progress-track {
		height: 0.4rem;
		width: 100%;
		overflow: hidden;
		border-radius: 999px;
		background: rgba(51, 65, 85, 0.6);
	}

	.catalog-progress-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, rgba(229, 9, 20, 0.98), rgba(248, 113, 113, 0.88));
	}

	.catalog-side {
		display: flex;
		flex-direction: column;
		align-items: flex-end;
		gap: 0.45rem;
		width: 9.5rem;
	}

	.catalog-rating {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		border-radius: 999px;
		padding: 0.35rem 0.7rem;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}

	.catalog-rating {
		border: 1px solid rgba(250, 204, 21, 0.22);
		background: rgba(250, 204, 21, 0.12);
		color: rgba(254, 249, 195, 0.96);
	}

	.catalog-rating--empty {
		border-color: rgba(148, 163, 184, 0.22);
		background: rgba(51, 65, 85, 0.22);
		color: rgba(203, 213, 225, 0.82);
	}

	.catalog-empty {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1.5rem;
		padding: 2.5rem 0;
		text-align: center;
		color: rgb(156, 163, 175);
	}

	.catalog-empty-image {
		height: auto;
		width: 12rem;
		max-width: 100%;
		opacity: 0.9;
	}

	@media (max-width: 767px) {
		.catalog-shell {
			padding: 2rem 1.25rem 4rem;
		}

		.catalog-row {
			grid-template-columns: 5rem minmax(0, 1fr);
		}

		.catalog-thumb {
			width: 5rem;
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