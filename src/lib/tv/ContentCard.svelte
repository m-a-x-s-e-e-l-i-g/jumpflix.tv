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
      const hintedTotal = Number.isFinite(hintedTotalValue) && hintedTotalValue > 0
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
  class="group cursor-pointer netflix-card"
    class:transform={!isMobile}
    class:hover:scale-110={!isMobile}
    class:transition-all={!isMobile}
    class:duration-300={!isMobile}
    class:ease-in-out={!isMobile}
    class:scale-110={!isMobile && isSelected}
    class:z-10={!isMobile && isSelected}
  on:click={() => onSelect(item)}
  on:keydown={(e) => e.key === 'Enter' && onSelect(item)}
  tabindex="0"
  role="button"
>
  <div class="relative aspect-[2/3] bg-gray-900 rounded-md overflow-hidden netflix-card-shadow"
      class:transition-all={!isMobile}
      class:duration-300={!isMobile}
      class:netflix-card-hover={!isMobile}
      class:netflix-card-selected={!isMobile && isSelected}
    title={item.title}
  >
  <!-- Placeholder layer (always present, sits under the poster) -->
  <div class="absolute inset-0" style:background-image={background} style:background-size="cover" style:background-position="center"></div>
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div class="max-w-[90%] text-center">
        <span class="text-white drop-shadow-md text-[12px] font-semibold whitespace-nowrap overflow-hidden text-ellipsis align-middle">{item.title}</span>
        {#if item.type === 'movie' && item.year}
          <span class="text-white/80 drop-shadow-md text-[12px] align-middle"> ({item.year})</span>
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
        onerror={() => { error = true; }}
      />
    {/if}

    <!-- Watched dimming overlay -->
    {#if isWatched}
      <div class="absolute inset-0 bg-black/50 z-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-0"></div>
    {/if}

    <div class="absolute top-2 left-2 flex gap-2 z-20">
      {#if isRecentlyAdded}
        <span class="bg-red-500 text-white px-2 py-1 rounded text-[10px] font-bold">NEW</span>
      {/if}
      {#if item.paid}
        <span class="bg-yellow-500 text-black px-2 py-1 rounded text-[10px] font-bold">PAID</span>
      {/if}
      {#if isWatched}
        <span class="bg-green-600 text-white px-2 py-1 rounded text-[10px] font-bold">WATCHED</span>
      {/if}
    </div>

    <!-- Bottom-right info: duration for movies, episode count for series -->
  <div class="absolute bottom-2 right-2 bg-black/70 px-2 py-1 rounded-md text-[10px] text-white/90 z-20 border border-white/10 shadow-[0_6px_18px_-12px_rgba(0,0,0,0.8)]">
      {#if item.type === 'movie'}
        {item.duration}
      {:else}
        {(item as any).episodeCount || '?'} eps
      {/if}
    </div>

    <!-- Progress bar at bottom -->
    {#if hasProgress}
      <div class="absolute inset-x-2 bottom-2 z-20" aria-label={`Continue watching at ${progressDisplayPercent}%`}>
        <div class="rounded-lg border border-white/10 bg-black/70 px-3 py-2 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.85)] backdrop-blur-md">
          <div class="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.15em] text-white/90">
            <span>CONTINUE</span>
            <span>{progressDisplayPercent}%</span>
          </div>
          <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div class="h-full rounded-full bg-red-500 transition-[width] duration-300 ease-out" style:width={`${progressBarWidth}%`}></div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .netflix-card {
    position: relative;
  }
  
  .netflix-card:hover {
    z-index: 10;
  }
  
  .netflix-card-shadow {
    box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
  }
  
  .group:hover .netflix-card-hover {
    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25), 0 0 30px rgba(127, 29, 29, 0.5);
  }
  
  .netflix-card-selected {
    box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25), 0 0 30px rgba(127, 29, 29, 0.5);
  }
</style>
