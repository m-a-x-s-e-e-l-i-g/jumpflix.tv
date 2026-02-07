<script lang="ts">
  import ContentCard from '$lib/tv/ContentCard.svelte';
  import type { ContentItem } from '$lib/tv/types';
  import ChevronLeftIcon from '@lucide/svelte/icons/chevron-left';
  import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';
  
  let { title, items = [], selectedContent = null, isMobile = false, onSelect } = $props<{
    title: string;
    items: ContentItem[];
    selectedContent: ContentItem | null;
    isMobile: boolean;
    onSelect: (item: ContentItem) => void;
  }>();
  
  let scrollContainer: HTMLElement | null = null;
  let canScrollLeft = $state(false);
  let canScrollRight = $state(true);
  
  function updateScrollButtons() {
    if (!scrollContainer) return;
    canScrollLeft = scrollContainer.scrollLeft > 0;
    canScrollRight = scrollContainer.scrollLeft < scrollContainer.scrollWidth - scrollContainer.clientWidth - 10;
  }
  
  function scrollLeft() {
    if (!scrollContainer) return;
    const scrollAmount = scrollContainer.clientWidth * 0.8;
    scrollContainer.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    setTimeout(updateScrollButtons, 300);
  }
  
  function scrollRight() {
    if (!scrollContainer) return;
    const scrollAmount = scrollContainer.clientWidth * 0.8;
    scrollContainer.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    setTimeout(updateScrollButtons, 300);
  }
</script>

<div class="netflix-carousel mb-12">
  <h2 class="text-white text-xl md:text-2xl font-bold mb-4 px-6">{title}</h2>
  
  <div class="relative group">
    <!-- Left scroll button -->
    {#if !isMobile && canScrollLeft}
      <button
        class="absolute left-0 top-0 bottom-0 z-30 w-16 bg-black/60 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
        onclick={scrollLeft}
        aria-label="Scroll left"
      >
        <ChevronLeftIcon class="w-10 h-10 text-white" />
      </button>
    {/if}
    
    <!-- Scrollable container -->
    <div
      bind:this={scrollContainer}
      class="flex gap-2 overflow-x-auto overflow-y-hidden px-6 scrollbar-hide snap-x snap-mandatory"
      onscroll={updateScrollButtons}
    >
      {#each items as item (item.id)}
        <div class="flex-none w-40 md:w-52 snap-start">
          <ContentCard
            {item}
            isSelected={!!(selectedContent && selectedContent.id === item.id && selectedContent.type === item.type)}
            {onSelect}
            {isMobile}
            priority={false}
          />
        </div>
      {/each}
    </div>
    
    <!-- Right scroll button -->
    {#if !isMobile && canScrollRight}
      <button
        class="absolute right-0 top-0 bottom-0 z-30 w-16 bg-black/60 hover:bg-black/80 transition-all opacity-0 group-hover:opacity-100 flex items-center justify-center"
        onclick={scrollRight}
        aria-label="Scroll right"
      >
        <ChevronRightIcon class="w-10 h-10 text-white" />
      </button>
    {/if}
  </div>
</div>

<style>
  .scrollbar-hide {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
  
  .scrollbar-hide::-webkit-scrollbar {
    display: none;
  }
</style>
