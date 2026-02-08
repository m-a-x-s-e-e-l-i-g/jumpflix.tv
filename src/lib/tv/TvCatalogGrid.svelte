<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { browser } from '$app/environment';
  import ContentCard from '$lib/tv/ContentCard.svelte';
  import type { ContentItem } from '$lib/tv/types';
  import * as m from '$lib/paraglide/messages';
  import { computeColumns } from '$lib/tv/helpers/grid';

  export let gridElement: HTMLElement | null = null;
  export let visibleContent: ContentItem[] = [];
  export let selectedContent: ContentItem | null = null;
  export let priorityKeys: Set<string> = new Set();
  export let isMobile = false;
  export let onSelect: (item: ContentItem) => void;
  export let gridScale = 1;
  export let viewMode: 'grid' | 'list' = 'grid';

  const keyFor = (item: ContentItem) => `${item.type}:${item.id}`;

  const OVERSCAN_ROWS = 4;
  let startIndex = 0;
  let endIndex = 0;
  let rowHeight = 280;
  let rowGap = 24;
  let columns = 1;
  let paddingTop = 0;
  let paddingBottom = 0;
  let recalcQueued = false;
  let scrollRaf: number | null = null;

  const scheduleRecalc = async () => {
    if (!browser || recalcQueued) return;
    recalcQueued = true;
    await tick();
    recalcQueued = false;
    measureGrid();
    updateRange();
  };

  const measureGrid = () => {
    if (!gridElement) return;
    const styles = getComputedStyle(gridElement);
    const gapValue = parseFloat(styles.rowGap || styles.gap || '0');
    rowGap = Number.isFinite(gapValue) ? gapValue : 0;

    const firstItem = gridElement.querySelector<HTMLElement>('.catalog-item');
    if (firstItem) {
      const rect = firstItem.getBoundingClientRect();
      if (rect.height > 0) rowHeight = rect.height + rowGap;
    }

    columns = computeColumns(gridElement);
  };

  const updateRange = () => {
    if (!browser) return;
    const total = visibleContent.length;
    if (!gridElement || total === 0) {
      startIndex = 0;
      endIndex = total;
      paddingTop = 0;
      paddingBottom = 0;
      return;
    }

    const rect = gridElement.getBoundingClientRect();
    const gridTop = rect.top + window.scrollY;
    const viewTop = window.scrollY;
    const viewBottom = viewTop + window.innerHeight;
    const safeRowHeight = Math.max(1, rowHeight || 1);
    const totalRows = Math.max(1, Math.ceil(total / Math.max(columns, 1)));

    const firstRow = Math.max(0, Math.floor((viewTop - gridTop) / safeRowHeight) - OVERSCAN_ROWS);
    const lastRow = Math.min(
      totalRows - 1,
      Math.ceil((viewBottom - gridTop) / safeRowHeight) + OVERSCAN_ROWS
    );

    startIndex = Math.max(0, firstRow * columns);
    endIndex = Math.min(total, (lastRow + 1) * columns);

    paddingTop = firstRow * safeRowHeight;
    paddingBottom = Math.max(0, (totalRows - lastRow - 1) * safeRowHeight);
  };

  $: if (browser) {
    visibleContent;
    gridScale;
    viewMode;
    isMobile;
    scheduleRecalc();
  }

  onMount(() => {
    if (!browser) return;

    const handleScroll = () => {
      if (scrollRaf !== null) return;
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = null;
        updateRange();
      });
    };

    const handleResize = () => scheduleRecalc();
    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);

    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => scheduleRecalc())
      : null;
    if (observer && gridElement) observer.observe(gridElement);

    scheduleRecalc();

    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
      observer?.disconnect();
      if (scrollRaf !== null) cancelAnimationFrame(scrollRaf);
    };
  });

  $: renderedContent = visibleContent.slice(startIndex, endIndex);
</script>

<div id="catalog" class="catalog-shell">
  <div
    bind:this={gridElement}
    class={`catalog-grid ${viewMode === 'list' ? 'list-mode' : ''}`}
    style={`--card-scale: ${gridScale}; --card-ratio: 2 / 3; padding-top: ${paddingTop}px; padding-bottom: ${paddingBottom}px;`}
  >
    {#if visibleContent.length === 0}
      <div class="col-span-full flex flex-col items-center gap-6 py-10 text-center text-gray-400">
        <img
          src="/images/searching-jumpflix-logo.webp"
          alt="Searching Jumpflix"
          width="220"
          height="160"
          class="h-auto w-48 max-w-full opacity-90"
          loading="lazy"
          decoding="async"
        />
        <div>{m.tv_noResults()}</div>
      </div>
    {:else}
      {#each renderedContent as item (keyFor(item))}
        <div class="catalog-item">
          <ContentCard
            {item}
            isSelected={!!(selectedContent && selectedContent.id === item.id && selectedContent.type === item.type)}
            onSelect={onSelect}
            {isMobile}
            priority={priorityKeys.has(keyFor(item))}
            {viewMode}
          />
        </div>
      {/each}
    {/if}
  </div>
</div>

<style>
  .catalog-shell {
    position: relative;
    z-index: 20;
    margin: 0;
    padding: 2.5rem clamp(1.5rem, 3vw, 3.75rem) 6rem;
  }

  .catalog-grid {
    --card-min: calc(200px * var(--card-scale, 1));
    --card-max: calc(320px * var(--card-scale, 1));
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
    gap: clamp(1rem, 1.8vw, 2.4rem);
    justify-content: start;
    justify-items: stretch;
    align-items: start;
    grid-auto-flow: dense;
  }

  .catalog-item {
    width: 100%;
    max-width: var(--card-max);
    justify-self: start;
  }

  .catalog-grid.list-mode {
    grid-template-columns: repeat(1, minmax(0, 1fr));
    gap: 1.5rem;
  }

  .catalog-grid.list-mode .catalog-item {
    max-width: 100%;
    grid-column: span 1;
    grid-row: span 1;
    justify-self: stretch;
  }

  @media (max-width: 900px) {
    .catalog-grid {
      --card-min: calc(175px * var(--card-scale, 1));
      --card-max: calc(260px * var(--card-scale, 1));
    }

  }

  @media (max-width: 767px) {
    .catalog-shell {
      padding: 2rem 1.25rem 4rem;
    }

    .catalog-grid {
      --card-min: calc(155px * var(--card-scale, 1));
      --card-max: calc(210px * var(--card-scale, 1));
      grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
      justify-content: center;
    }

    .catalog-item {
      grid-column: span 1;
      grid-row: span 1;
      max-width: 100%;
    }
  }

  .catalog-grid :global([role="button"][tabindex="0"]:focus:not(:focus-visible)) {
    outline: none;
    box-shadow: none;
  }
  .catalog-grid :global([role="button"][tabindex="0"]:focus-visible) {
    outline: none;
    border: none;
  }
</style>
