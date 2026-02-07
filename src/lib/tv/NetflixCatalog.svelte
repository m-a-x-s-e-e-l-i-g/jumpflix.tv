<script lang="ts">
  import NetflixCarousel from '$lib/tv/NetflixCarousel.svelte';
  import type { ContentItem } from '$lib/tv/types';
  
  let { sortedAllContent = [], visibleContent = [], selectedContent = null, isMobile = false, onSelect } = $props<{
    sortedAllContent?: ContentItem[];
    visibleContent: ContentItem[];
    selectedContent: ContentItem | null;
    isMobile: boolean;
    onSelect: (item: ContentItem) => void;
  }>();
  
  // Group content by different categories for Netflix-style rows
  const movies = $derived(visibleContent.filter((item: ContentItem) => item.type === 'movie'));
  const series = $derived(visibleContent.filter((item: ContentItem) => item.type === 'series'));
  
  // Group by different facets
  const documentary = $derived(visibleContent.filter((item: ContentItem) => item.facets?.type === 'documentary'));
  const fiction = $derived(visibleContent.filter((item: ContentItem) => item.facets?.type === 'fiction'));
  const energetic = $derived(visibleContent.filter((item: ContentItem) => item.facets?.mood?.includes('energetic')));
  const chill = $derived(visibleContent.filter((item: ContentItem) => item.facets?.mood?.includes('chill')));
  const cinematic = $derived(visibleContent.filter((item: ContentItem) => item.facets?.filmStyle === 'cinematic'));
  const rooftops = $derived(visibleContent.filter((item: ContentItem) => item.facets?.environment === 'rooftops'));
  const street = $derived(visibleContent.filter((item: ContentItem) => item.facets?.environment === 'street'));
  
  // Recently added (last 30 days)
  const recentlyAdded = $derived(visibleContent.filter((item: ContentItem) => {
    if (item.type !== 'movie' || !item.createdAt) return false;
    try {
      const created = new Date(item.createdAt);
      if (isNaN(created.getTime())) return false;
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return created > thirtyDaysAgo;
    } catch {
      return false;
    }
  }).slice(0, 20));
  
  // Popular (by rating)
  const popular = $derived([...visibleContent]
    .filter((item: ContentItem) => item.averageRating && item.ratingCount && item.ratingCount > 0)
    .sort((a, b) => {
      const ratingA = (a.averageRating || 0) * Math.log(1 + (a.ratingCount || 0));
      const ratingB = (b.averageRating || 0) * Math.log(1 + (b.ratingCount || 0));
      return ratingB - ratingA;
    })
    .slice(0, 20));
</script>

<div id="catalog" class="netflix-catalog pb-20">
  {#if visibleContent.length === 0}
    <div class="flex flex-col items-center gap-6 py-20 text-center text-gray-400 px-6">
      <img
        src="/images/searching-jumpflix-logo.webp"
        alt="Searching Jumpflix"
        width="220"
        height="160"
        class="h-auto w-48 max-w-full opacity-90"
        loading="lazy"
        decoding="async"
      />
      <div class="text-xl">No results. Try adjusting filters.</div>
    </div>
  {:else}
    <!-- Recently Added -->
    {#if recentlyAdded.length > 0}
      <NetflixCarousel
        title="Recently Added"
        items={recentlyAdded}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Popular -->
    {#if popular.length > 0}
      <NetflixCarousel
        title="Popular on Jumpflix"
        items={popular}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Movies -->
    {#if movies.length > 0}
      <NetflixCarousel
        title="Parkour Films"
        items={movies}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Series -->
    {#if series.length > 0}
      <NetflixCarousel
        title="Series & Collections"
        items={series}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Documentary -->
    {#if documentary.length > 0}
      <NetflixCarousel
        title="Documentaries"
        items={documentary}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Fiction -->
    {#if fiction.length > 0}
      <NetflixCarousel
        title="Fiction & Narrative"
        items={fiction}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Cinematic -->
    {#if cinematic.length > 0}
      <NetflixCarousel
        title="Cinematic Masterpieces"
        items={cinematic}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Energetic -->
    {#if energetic.length > 0}
      <NetflixCarousel
        title="High Energy"
        items={energetic}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Chill -->
    {#if chill.length > 0}
      <NetflixCarousel
        title="Chill Vibes"
        items={chill}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Rooftops -->
    {#if rooftops.length > 0}
      <NetflixCarousel
        title="Rooftop Adventures"
        items={rooftops}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
    
    <!-- Street -->
    {#if street.length > 0}
      <NetflixCarousel
        title="Street Movement"
        items={street}
        {selectedContent}
        {isMobile}
        {onSelect}
      />
    {/if}
  {/if}
</div>

<style>
  .netflix-catalog {
    background: transparent;
  }
</style>
