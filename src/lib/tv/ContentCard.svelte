<script lang="ts">
  import type { ContentItem } from './types';
  import { isImage } from './utils';
  import { Image } from '@unpic/svelte';
  import { blurhashToCssGradientString } from '@unpic/placeholder';
  import { posterBlurhash } from '$lib/assets/blurhash';
  import { dev } from '$app/environment';
  import { markThumbnailLoaded } from '$lib/tv/store';

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

  // no loading lifecycle needed

  function handleLoaded(e: Event) {
    const target = e.target as HTMLImageElement | null;
    const src = target?.currentSrc || target?.src;
    if (src) markThumbnailLoaded(src);
  }
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
    class:group-hover:ring-red-400={!isMobile}
    class:ring-4={!isMobile && isSelected}
    class:ring-red-500={!isMobile && isSelected}
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
        class="relative inset-0 w-full h-full object-cover z-10"
        cdn={dev ? undefined : 'netlify'}
        layout="constrained"
        on:load={handleLoaded}
        on:error={() => { error = true; }}
      />
    {/if}

    <div class="absolute top-2 left-2 flex gap-2 z-20">
      {#if item.paid}
        <span class="bg-yellow-500 text-black px-2 py-1 rounded text-[10px] font-bold">PAID</span>
      {/if}
    </div>

    <!-- Bottom-right info: duration for movies, video count for playlists -->
    <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-md text-[10px] text-white/90 z-20">
      {#if item.type === 'movie'}
        {item.duration}
      {:else}
        {(item as any).videoCount || '?'} videos
      {/if}
    </div>
  </div>
</div>
