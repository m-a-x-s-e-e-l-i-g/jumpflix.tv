<script lang="ts">
  import type { Movie } from './types';
  import { isImage } from './utils';
  import { loadedThumbnails, markThumbnailLoaded } from './store';
  import { Image } from '@unpic/svelte';
  import { dev } from '$app/environment';
  export let item: Movie;
  export let isSelected = false;
  export let isMobile = false;
  export let onSelect: (item: Movie) => void;
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
    class:group-hover:ring-blue-400={!isMobile}
    class:ring-4={!isMobile && isSelected}
    class:ring-red-500={!isMobile && isSelected}
    title={item.title}
  >
    {#if isImage(item.thumbnail)}
      <Image
        src={item.thumbnail}
        alt={item.title + ' poster'}
        class="w-full h-full object-cover"
        loading="lazy"
        style="height:100%;"
        layout="fullWidth"
        aspectRatio={2/3}
        sizes="(max-width: 767px) 165px, 220px"
        cdn={dev ? undefined : 'netlify'}
        on:load={() => markThumbnailLoaded(item.thumbnail)}
      />
    {:else}
      <div class="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-700 flex items-center justify-center">
        <div class="text-center p-3">
          <svg class="w-8 h-8 mx-auto mb-2 opacity-60" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>
          <p class="text-xs opacity-80 font-medium text-center leading-tight">{item.title}</p>
        </div>
      </div>
    {/if}
    <div class="absolute top-2 left-2 flex gap-2">
      {#if item.paid}
        <span class="bg-yellow-500 text-black px-2 py-1 rounded text-[10px] font-bold">PAID</span>
      {/if}
    </div>
    <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-md text-[10px] text-white/90">{item.duration}</div>
  </div>
</div>
