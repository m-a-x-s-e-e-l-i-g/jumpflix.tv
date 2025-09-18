<script lang="ts">
  import type { Playlist } from './types';
  import { isImage } from './utils';
  import { markThumbnailLoaded } from './store';
  import { Image } from '@unpic/svelte';
  import { dev } from '$app/environment';
  export let item: Playlist;
  export let isSelected = false;
  export let isMobile = false;
  export let onSelect: (item: Playlist) => void;
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
    {#if isImage(item.thumbnail)}
      <Image
        src={item.thumbnail}
        alt={item.title + ' thumbnail'}
        class="w-full h-full object-cover"
        loading="lazy"
        layout="fullWidth"
        aspectRatio={2/3}
        sizes="(max-width: 767px) 165px, 220px"
        cdn={dev ? undefined : 'netlify'}
        on:load={() => markThumbnailLoaded(item.thumbnail)}
      />
    {:else}
      <div class="absolute inset-0 bg-gradient-to-br from-red-600 to-pink-700 flex items-center justify-center">
        <div class="text-center p-3">
          <svg class="w-8 h-8 mx-auto mb-2 opacity-60" fill="currentColor" viewBox="0 0 20 20"><path d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"/></svg>
          <p class="text-xs opacity-80 font-medium text-center leading-tight">{item.title}</p>
        </div>
      </div>
    {/if}
    <div class="absolute bottom-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded-md text-[10px] text-white/90">{item.videoCount || '?'} videos</div>
  </div>
</div>
