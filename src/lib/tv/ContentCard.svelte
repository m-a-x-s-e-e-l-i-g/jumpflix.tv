<script lang="ts">
  import type { ContentItem } from './types';
  import { isImage } from './utils';
  import { loadedThumbnails, markThumbnailLoaded } from './store';
  import { onMount } from 'svelte';

  export let item: ContentItem;
  export let isSelected = false;
  export let isMobile = false;
  export let onSelect: (item: ContentItem) => void;
  // Prioritize above-the-fold images for fastest first paint
  export let priority = false;

  let error = false;
  let loaded = false;
  let imgEl: HTMLImageElement | null = null;

  // Tiny blurhash-style color pair derived from URL
  function hashString(str: string) {
    let h = 0;
    for (let i = 0; i < str.length; i++) {
      h = (h << 5) - h + str.charCodeAt(i);
      h |= 0;
    }
    return h >>> 0;
  }
  function colorPairFromSrc(src: string) {
    const h = hashString(src);
    const hue1 = h % 360;
    const hue2 = (h * 7) % 360;
    const sat = 55 + (h % 20); // 55–75%
    const l1 = 18 + (h % 8);   // 18–26%
    const l2 = 26 + (h % 8);   // 26–34%
    return [`hsl(${hue1} ${sat}% ${l1}%)`, `hsl(${hue2} ${sat}% ${l2}%)`];
  }
  $: [c1, c2] = colorPairFromSrc(item.thumbnail || item.title || '');
  $: bgStyle = `background: linear-gradient(135deg, ${c1}, ${c2})`;

  $: altSuffix = item.type === 'movie' ? ' poster' : ' thumbnail';

  onMount(() => {
    // If the image is already cached, mark as loaded immediately
    if (imgEl && imgEl.complete) {
      loaded = true;
      markThumbnailLoaded(item.thumbnail);
    }
  });
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
  <div class="relative aspect-[2/3] bg-[#0f172a] dark:bg-gray-800 border border-gray-700/60 dark:border-gray-700 rounded-xl overflow-hidden mb-3 shadow-md transition-all duration-300"
    class:group-hover:ring-4={!isMobile}
    class:group-hover:ring-blue-400={!isMobile && item.type === 'movie'}
    class:group-hover:ring-red-400={!isMobile && item.type === 'playlist'}
    class:ring-4={!isMobile && isSelected}
    class:ring-red-500={!isMobile && isSelected}
    title={item.title}
  >
    {#if isImage(item.thumbnail) && !error}
      <!-- Placeholder gradient derived from URL + skeleton shimmer -->
      {#if !($loadedThumbnails.has(item.thumbnail!) || loaded)}
        <div class="absolute inset-0" style={bgStyle}></div>
        <div class="absolute inset-0 z-10 bg-black/10 dark:bg-black/10 animate-pulse"></div>
      {/if}
      <!-- Native image to ensure load events fire reliably -->
      <img
        bind:this={imgEl}
        src={item.thumbnail}
        alt={item.title + altSuffix}
        loading={priority ? 'eager' : 'lazy'}
        fetchpriority={priority ? 'high' : undefined}
        decoding="async"
        sizes="(max-width: 767px) 165px, 220px"
        class="w-full h-full object-cover transition-opacity duration-500"
        class:opacity-0={!($loadedThumbnails.has(item.thumbnail!) || loaded)}
        class:opacity-100={$loadedThumbnails.has(item.thumbnail!) || loaded}
        on:load={() => { loaded = true; markThumbnailLoaded(item.thumbnail); }}
        on:error={() => { error = true; loaded = true; markThumbnailLoaded(item.thumbnail); }}
      />
    {:else}
      <div class="absolute inset-0 flex items-center justify-center"
        class:bg-gradient-to-br={true}
        class:from-blue-600={item.type === 'movie'}
        class:to-purple-700={item.type === 'movie'}
        class:from-red-600={item.type === 'playlist'}
        class:to-pink-700={item.type === 'playlist'}
      >
        <div class="text-center p-3">
          {#if item.type === 'movie'}
            <svg class="w-8 h-8 mx-auto mb-2 opacity-60" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>
          {:else}
            <svg class="w-8 h-8 mx-auto mb-2 opacity-60" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/></svg>
          {/if}
          <p class="text-xs opacity-80 font-medium text-center leading-tight">{item.title}</p>
        </div>
      </div>
    {/if}

    <div class="absolute top-2 left-2 flex gap-2">
      {#if item.paid}
        <span class="bg-yellow-500 text-black px-2 py-1 rounded text-[10px] font-bold">PAID</span>
      {/if}
    </div>

    <!-- Bottom-right info: duration for movies, video count for playlists -->
    <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-md text-[10px] text-white/90">
      {#if item.type === 'movie'}
        {item.duration}
      {:else}
        {(item as any).videoCount || '?'} videos
      {/if}
    </div>
  </div>
</div>
