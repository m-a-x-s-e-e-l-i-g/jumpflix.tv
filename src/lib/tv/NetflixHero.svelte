<script lang="ts">
  import { Image } from '@unpic/svelte';
  import { dev } from '$app/environment';
  import type { ContentItem } from '$lib/tv/types';
  import PlayIcon from '@lucide/svelte/icons/play';
  import InfoIcon from '@lucide/svelte/icons/info';
  
  let { featuredItem = null, onPlay, onInfo } = $props<{
    featuredItem: ContentItem | null;
    onPlay: (item: ContentItem) => void;
    onInfo: (item: ContentItem) => void;
  }>();
  
  const hasItem = $derived(!!featuredItem);
  const description = $derived(featuredItem?.description || '');
  const truncatedDescription = $derived(description.length > 150 ? description.substring(0, 150) + '...' : description);
</script>

<div class="netflix-hero relative w-full overflow-hidden">
  {#if hasItem && featuredItem}
    <!-- Background image with gradient overlay -->
    <div class="absolute inset-0">
      {#if featuredItem.thumbnail}
        <Image
          src={featuredItem.thumbnail}
          alt={featuredItem.title}
          class="w-full h-full object-cover"
          cdn={dev ? undefined : 'netlify'}
          loading="eager"
          fetchpriority="high"
          width={1920}
          height={1080}
        />
      {/if}
      
      <!-- Multiple gradient overlays for smooth fade -->
      <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent"></div>
      <div class="absolute inset-0 bg-gradient-to-r from-black via-black/40 to-transparent"></div>
      <div class="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-black to-transparent"></div>
    </div>
    
    <!-- Content -->
    <div class="relative z-10 flex items-end min-h-[70vh] md:min-h-[85vh] px-6 md:px-12 pb-24 md:pb-32">
      <div class="max-w-2xl">
        <!-- Title -->
        <h1 class="text-4xl md:text-6xl lg:text-7xl font-black text-white mb-4 md:mb-6 drop-shadow-2xl leading-tight">
          {featuredItem.title}
        </h1>
        
        <!-- Meta info -->
        <div class="flex items-center gap-3 mb-4 text-white/90">
          {#if featuredItem.type === 'movie' && featuredItem.year}
            <span class="text-lg font-semibold">{featuredItem.year}</span>
            <span class="text-white/60">•</span>
          {/if}
          
          {#if featuredItem.type === 'movie' && featuredItem.duration}
            <span class="text-lg">{featuredItem.duration}</span>
          {:else if featuredItem.type === 'series'}
            {@const series = featuredItem}
            <span class="text-lg">{series.episodeCount || '?'} Episodes</span>
          {/if}
          
          {#if featuredItem.averageRating}
            <span class="text-white/60">•</span>
            <span class="flex items-center gap-1 text-lg">
              <span class="text-yellow-400">★</span>
              <span>{featuredItem.averageRating.toFixed(1)}</span>
            </span>
          {/if}
        </div>
        
        <!-- Description -->
        {#if truncatedDescription}
          <p class="text-base md:text-lg text-white/80 mb-6 md:mb-8 leading-relaxed drop-shadow-lg max-w-xl">
            {truncatedDescription}
          </p>
        {/if}
        
        <!-- Action buttons -->
        <div class="flex flex-col sm:flex-row gap-3">
          <button
            class="flex items-center justify-center gap-3 px-8 py-3 bg-white hover:bg-white/90 text-black text-lg font-bold rounded-md transition-all shadow-lg hover:shadow-xl"
            onclick={() => onPlay(featuredItem)}
          >
            <PlayIcon class="w-6 h-6" />
            <span>Play</span>
          </button>
          
          <button
            class="flex items-center justify-center gap-3 px-8 py-3 bg-white/20 hover:bg-white/30 text-white text-lg font-bold rounded-md transition-all backdrop-blur-sm"
            onclick={() => onInfo(featuredItem)}
          >
            <InfoIcon class="w-6 h-6" />
            <span>More Info</span>
          </button>
        </div>
      </div>
    </div>
  {:else}
    <!-- Fallback when no featured item -->
    <div class="flex flex-col items-center justify-center min-h-[70vh] text-center px-6">
      <h1 class="text-4xl md:text-6xl font-black text-white mb-4 drop-shadow-2xl">
        Parkour cinema, curated for the culture.
      </h1>
      <p class="text-lg text-white/70 max-w-2xl">
        Watch documentaries, movies, and raw movement stories shaped by freerunning crews worldwide.
      </p>
    </div>
  {/if}
</div>

<style>
  .netflix-hero {
    position: relative;
  }
</style>
