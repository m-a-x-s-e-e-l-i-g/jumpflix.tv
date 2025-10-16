<script lang="ts">
  import ContentCard from '$lib/tv/ContentCard.svelte';
  import type { ContentItem } from '$lib/tv/types';
  import * as m from '$lib/paraglide/messages';

  export let gridElement: HTMLElement | null = null;
  export let sortedAllContent: ContentItem[] = [];
  export let visibleContent: ContentItem[] = [];
  export let visibleKeys: Set<string> = new Set();
  export let selectedContent: ContentItem | null = null;
  export let priorityKeys: Set<string> = new Set();
  export let isMobile = false;
  export let onSelect: (item: ContentItem) => void;

  const keyFor = (item: ContentItem) => `${item.type}:${item.id}`;
</script>

<div id="catalog" class="container mx-auto px-6 py-10 tv-main -mt-16 z-20">
  <div bind:this={gridElement} class="grid auto-fit-grid gap-6">
    {#if visibleContent.length === 0}
      <div class="col-span-full text-center text-gray-400 py-8">{m.tv_noResults()}</div>
    {:else}
      {#each sortedAllContent as item (keyFor(item))}
        <div class:hidden={!visibleKeys.has(keyFor(item))} class="w-full">
          <ContentCard
            {item}
            isSelected={!!(selectedContent && selectedContent.id === item.id && selectedContent.type === item.type)}
            onSelect={onSelect}
            {isMobile}
            priority={priorityKeys.has(keyFor(item))}
          />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .auto-fit-grid {
    --card-max: 220px;
    grid-template-columns: repeat(auto-fill, minmax(180px, var(--card-max)));
    justify-content: center;
    justify-items: center;
  }
  .auto-fit-grid > * {
    width: 100%;
    max-width: var(--card-max);
  }
  @media (max-width: 767px) {
    .auto-fit-grid {
      --card-min: 120px;
      --card-max: 165px;
      grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
      justify-content: center;
    }
    .auto-fit-grid > * {
      max-width: var(--card-max);
    }
  }
  .auto-fit-grid :global([role="button"][tabindex="0"]:focus:not(:focus-visible)) {
    outline: none;
    box-shadow: none;
  }
  .auto-fit-grid :global([role="button"][tabindex="0"]:focus-visible) {
    outline: none;
    border: none;
  }
</style>
