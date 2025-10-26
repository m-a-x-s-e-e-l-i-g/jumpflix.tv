<script lang="ts">
  import type { ContentItem } from './types';
  import { isImage } from './utils';
  import { Image } from '@unpic/svelte';
  import { blurhashToCssGradientString } from '@unpic/placeholder';
  import { posterBlurhash } from '$lib/assets/blurhash';
  import { dev } from '$app/environment';
  import { loadedThumbnails, markThumbnailLoaded } from '$lib/tv/store';
  import { getWatchProgress } from '$lib/tv/watchHistory';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  export let item: ContentItem;
  export let isSelected = false;
  export let isMobile = false;
  export let onSelect: (item: ContentItem) => void;
  // Prioritize above-the-fold images for fastest first paint
  export let priority = false;

  let error = false;
  $: blurhash = item.blurhash || (item.thumbnail ? posterBlurhash[item.thumbnail] : undefined);
  $: background = blurhash ? blurhashToCssGradientString(blurhash) : undefined;

  $: altSuffix = item.type === 'movie' ? ' poster' : ' thumbnail';

  // Watch progress tracking
  let watchProgress: { percent: number; isWatched: boolean } | null = null;
  
  function updateWatchProgress() {
    if (!browser) return;
    const mediaId = `${item.type}:${item.id}`;
    const progress = getWatchProgress(mediaId);
    if (progress) {
      watchProgress = { percent: progress.percent, isWatched: progress.isWatched };
    } else {
      watchProgress = null;
    }
  }

  onMount(() => {
    updateWatchProgress();
    // Update when localStorage changes (from other tabs or components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'jumpflix-watch-history' || e.key === null) {
        updateWatchProgress();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  });

  // Poll for updates every 2 seconds when visible (for same-tab updates)
  $: if (browser) {
    const interval = setInterval(updateWatchProgress, 2000);
    return () => clearInterval(interval);
  }

  $: isWatched = watchProgress?.isWatched || false;
  $: progressPercent = watchProgress?.percent || 0;
  $: hasProgress = !isWatched && progressPercent > 0 && progressPercent < 85;

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
  $: baseImageClass = 'relative inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ease-out';
</script>

<div 
  class="group cursor-pointer"
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
  <div class="relative aspect-[2/3] bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-3 shadow-md"
      class:transition-all={!isMobile}
      class:duration-300={!isMobile}
      class:group-hover:ring-4={!isMobile}
      class:group-hover:ring-red-400={!isMobile}
      class:ring-4={!isMobile && isSelected}
    class:ring-red-500={!isMobile && isSelected}
    class:group-hover:border-none={!isMobile}
    class:border-none={!isMobile && isSelected}
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
        class={`${baseImageClass} ${imageOpacityClass} ${isWatched ? 'opacity-40' : ''}`}
        cdn={dev ? undefined : 'netlify'}
        layout="constrained"
        onload={handleLoaded}
        onerror={() => { error = true; }}
      />
    {/if}

    <!-- Watched dimming overlay -->
    {#if isWatched}
      <div class="absolute inset-0 bg-black/50 z-10 pointer-events-none"></div>
    {/if}

    <div class="absolute top-2 left-2 flex gap-2 z-20">
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
        {(item as any).videoCount || '?'} eps
      {/if}
    </div>

    <!-- Progress bar at bottom -->
    {#if hasProgress}
      <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/80 z-20">
        <div class="h-full bg-red-500 transition-all duration-300" style:width="{progressPercent}%"></div>
      </div>
    {/if}
  </div>
</div>
