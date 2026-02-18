<script lang="ts">
	import type { ContentItem } from './types';
	import { isImage } from './utils';
	import { Image } from '@unpic/svelte';
	import { blurhashToCssGradientString } from '@unpic/placeholder';
	import { dev } from '$app/environment';
	import { loadedThumbnails, markThumbnailLoaded } from '$lib/tv/store';
	import {
		getWatchProgress,
		getLatestWatchProgressByBaseId,
		getSeriesProgressSummary,
		PROGRESS_CHANGE_EVENT
	} from '$lib/tv/watchHistory';
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import * as m from '$lib/paraglide/messages';

	export let item: ContentItem;
	export let isSelected = false;
	export let isMobile = false;
	export let onSelect: (item: ContentItem) => void;
	// Prioritize above-the-fold images for fastest first paint
	export let priority = false;

	let error = false;
	$: blurhash = item.blurhash;
	$: background = blurhash ? blurhashToCssGradientString(blurhash) : undefined;

	$: altSuffix = item.type === 'movie' ? ' poster' : ' thumbnail';

	// Watch progress tracking
	let watchProgress: { percent: number; isWatched: boolean } | null = null;

	function buildBaseId(content: ContentItem | null): string | null {
		if (!content) return null;
		return `${content.type}:${content.id}`;
	}

	function updateWatchProgress() {
		if (!browser) return;
		const baseId = buildBaseId(item);
		if (!baseId) {
			watchProgress = null;
			return;
		}

		// For series, aggregate progress across episodes using total episode metadata when available
		if (item.type === 'series') {
			const series = item as any;
			const hintedTotalValue = Number(series?.episodeCount);
			const hintedTotal =
				Number.isFinite(hintedTotalValue) && hintedTotalValue > 0
					? Math.floor(hintedTotalValue)
					: null;
			const summary = getSeriesProgressSummary(baseId, { totalEpisodes: hintedTotal });

			if (!summary || (!summary.isWatched && summary.percent <= 0)) {
				watchProgress = null;
				return;
			}

			watchProgress = {
				percent: summary.percent,
				isWatched: summary.isWatched
			};
			return;
		}

		// For movies, use existing logic
		const candidateIds: string[] = [];
		if (item.type === 'movie') {
			const movie = item as any;
			if (movie.videoId) candidateIds.push(`${baseId}:yt:${movie.videoId}`);
			if (movie.vimeoId) candidateIds.push(`${baseId}:vimeo:${movie.vimeoId}`);
		}

		let progress: ReturnType<typeof getWatchProgress> | null = null;
		for (const id of candidateIds) {
			progress = getWatchProgress(id);
			if (progress) break;
		}

		if (!progress) {
			progress = getLatestWatchProgressByBaseId(baseId);
		}

		if (progress) {
			watchProgress = { percent: progress.percent, isWatched: progress.isWatched };
		} else {
			watchProgress = null;
		}
	}

	onMount(() => {
		updateWatchProgress();

		// Update when progress changes in the same tab
		const handleProgressChange: EventListener = () => {
			updateWatchProgress();
		};

		window.addEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);

		return () => {
			window.removeEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);
		};
	});

	// React to item changes
	$: if (browser && item) {
		updateWatchProgress();
	}

	const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
	function isWithinLastWeek(value?: string): boolean {
		if (!value || typeof value !== 'string') return false;
		const ts = Date.parse(value);
		if (!Number.isFinite(ts)) return false;
		return Date.now() - ts <= ONE_WEEK_MS;
	}

	$: isRecentlyAdded = item.type === 'movie' && isWithinLastWeek((item as any).createdAt);

	$: isWatched = watchProgress?.isWatched || false;
	$: progressPercent = watchProgress?.percent || 0;
	$: hasProgress = !isWatched && progressPercent > 0 && progressPercent < 85;
	$: progressDisplayPercent =
		progressPercent <= 0 ? 0 : Math.min(99, Math.max(1, Math.round(progressPercent)));
	$: progressBarWidth = Math.min(100, Math.max(progressPercent, 4));

	// no loading lifecycle needed

	function handleLoaded(e: Event) {
		const target = e.target as HTMLImageElement | null;
		const src = target?.currentSrc || target?.src;
		if (src) markThumbnailLoaded(src);
		loaded = true;
	}

	// Local loaded state for fade-in; also consider globally cached loaded thumbnails
	let loaded = false;
	$: alreadyLoaded = item.thumbnail ? $loadedThumbnails.has(item.thumbnail) : false;
	$: if (alreadyLoaded) loaded = true;
	$: imageOpacityClass = loaded ? 'opacity-100' : 'opacity-0';
	$: baseImageClass = `relative inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ease-out ${isWatched ? 'opacity-30' : ''}`;
</script>

<div
	class="card-shell group"
	class:transform={!isMobile}
	class:hover:scale-105={!isMobile}
	class:transition-all={!isMobile}
	class:duration-300={!isMobile}
	class:scale-105={!isMobile && isSelected}
	on:click={() => onSelect(item)}
	on:keydown={(e) => e.key === 'Enter' && onSelect(item)}
	tabindex="0"
	role="button"
>
	<div
		class="card-frame"
		class:transition-all={!isMobile}
		class:duration-300={!isMobile}
		class:card-frame--active={!isMobile && isSelected}
		title={item.title}
	>
		<!-- Placeholder layer (always present, sits under the poster) -->
		<div
			class="absolute inset-0"
			style:background-image={background}
			style:background-size="cover"
			style:background-position="center"
		></div>
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<div class="max-w-[90%] text-center">
				<span
					class="overflow-hidden align-middle text-[12px] font-semibold text-ellipsis whitespace-nowrap text-white drop-shadow-md"
					>{item.title}</span
				>
				{#if item.type === 'movie' && item.year}
					<span class="align-middle text-[12px] text-white/80 drop-shadow-md"> ({item.year})</span>
				{/if}
			</div>
		</div>

		{#if isImage(item.thumbnail) && !error}
			<!-- Poster image overlays the placeholder; no special loading handling -->
			<Image
				src={item.thumbnail}
				alt={item.title + altSuffix}
				loading={priority ? 'eager' : 'lazy'}
				fetchpriority={priority ? 'high' : undefined}
				decoding="async"
				width={230}
				height={345}
				class={`${baseImageClass} ${imageOpacityClass}`}
				cdn={dev ? undefined : 'netlify'}
				layout="constrained"
				onload={handleLoaded}
				onerror={() => {
					error = true;
				}}
			/>
		{/if}

		<!-- Watched dimming overlay -->
		{#if isWatched}
			<div
				class="pointer-events-none absolute inset-0 z-10 bg-black/50 transition-opacity duration-300 group-hover:opacity-0"
			></div>
		{/if}

		<div class="card-badges">
			{#if isRecentlyAdded && !isWatched}
				<span class="card-badge card-badge--hot">{m.tv_new()}</span>
			{/if}
			{#if item.paid && !isWatched}
				<span class="card-badge card-badge--paid">{m.tv_paid()}</span>
			{/if}
			{#if isWatched}
				<span class="card-badge card-badge--watched">{m.tv_showWatched()}</span>
			{/if}
		</div>

		{#if !hasProgress && !isWatched}
			<!-- Bottom-right info: duration for movies, episode count for series -->
			<div class="card-meta">
				{#if item.type === 'movie'}
					{item.duration}
				{:else}
					{(item as any).episodeCount || '?'} eps
				{/if}
			</div>
		{/if}

		<!-- Progress bar at bottom -->
		{#if hasProgress}
			<div class="card-progress" aria-label={`${m.tv_continueWatchingAt()} ${progressDisplayPercent}%`}>
				<div class="card-progress-inner">
					<div class="card-progress-label">
						<span>{m.tv_continue()}</span>
						<span>{progressDisplayPercent}%</span>
					</div>
					<div class="card-progress-track">
						<div class="card-progress-fill" style:width={`${progressBarWidth}%`}></div>
					</div>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	.card-shell {
		cursor: pointer;
	}

	.card-frame {
		position: relative;
		aspect-ratio: var(--card-ratio, 2 / 3);
		border-radius: 20px;
		overflow: hidden;
		background: rgba(8, 12, 24, 0.6);
		border: 1px solid rgba(248, 250, 252, 0.15);
		box-shadow: 0 18px 40px -25px rgba(2, 6, 23, 0.85);
	}

	.card-frame--active {
		border-color: rgba(229, 9, 20, 0.55);
		box-shadow: 0 25px 55px -30px rgba(229, 9, 20, 0.55);
	}

	.card-badges {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.4rem;
		z-index: 20;
	}

	.card-badge {
		font-size: 0.55rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		padding: 0.2rem 0.45rem;
		border-radius: 999px;
		border: 1px solid rgba(248, 250, 252, 0.2);
		background: rgba(8, 12, 24, 0.7);
		color: rgba(248, 250, 252, 0.9);
		box-shadow: 0 8px 16px -12px rgba(15, 23, 42, 0.8);
	}

	.card-badge--hot {
		background: linear-gradient(135deg, rgba(190, 10, 24, 0.98), rgba(156, 8, 20, 0.92));
		border-color: rgba(239, 68, 68, 0.7);
		color: #ffffff;
		box-shadow: 0 12px 20px -12px rgba(190, 10, 24, 0.65);
	}

	.card-badge--paid {
		background: linear-gradient(135deg, rgba(250, 204, 21, 0.98), rgba(245, 158, 11, 0.92));
		border-color: rgba(252, 211, 77, 0.9);
		color: rgba(24, 24, 24, 0.95);
		box-shadow: 0 12px 18px -12px rgba(250, 204, 21, 0.75);
	}

	.card-badge--watched {
		background: rgba(10, 16, 28, 0.85);
		border-color: rgba(148, 163, 184, 0.55);
		color: rgba(226, 232, 240, 0.9);
		box-shadow: 0 10px 18px -14px rgba(15, 23, 42, 0.7);
	}

	.card-meta {
		position: absolute;
		bottom: 0.8rem;
		right: 0.8rem;
		z-index: 20;
		font-size: 0.6rem;
		letter-spacing: 0.16em;
		text-transform: uppercase;
		padding: 0.35rem 0.55rem;
		border-radius: 999px;
		background: rgba(6, 10, 20, 0.7);
		border: 1px solid rgba(248, 250, 252, 0.12);
		color: rgba(226, 232, 240, 0.85);
	}

	.card-progress {
		position: absolute;
		left: 0.75rem;
		right: 0.75rem;
		bottom: 0.75rem;
		z-index: 20;
	}

	.card-progress-inner {
		border-radius: 16px;
		border: 1px solid rgba(248, 250, 252, 0.12);
		background: rgba(7, 10, 20, 0.7);
		padding: 0.55rem 0.75rem;
	}

	.card-progress-label {
		display: flex;
		justify-content: space-between;
		font-size: 0.55rem;
		letter-spacing: 0.2em;
		text-transform: uppercase;
		color: rgba(248, 250, 252, 0.85);
	}

	.card-progress-track {
		margin-top: 0.4rem;
		height: 0.25rem;
		width: 100%;
		border-radius: 999px;
		background: rgba(248, 250, 252, 0.15);
		overflow: hidden;
	}

	.card-progress-fill {
		height: 100%;
		border-radius: inherit;
		background: linear-gradient(90deg, rgba(229, 9, 20, 0.9), rgba(229, 9, 20, 0.6));
		transition: width 0.3s ease;
	}
</style>
