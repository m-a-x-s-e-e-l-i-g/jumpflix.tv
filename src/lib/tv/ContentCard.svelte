<script lang="ts">
  import type { ContentItem } from './types';
  import { isImage } from './utils';
  import { Image } from '@unpic/svelte';
  import { blurhashToCssGradientString } from '@unpic/placeholder';
  import { dev } from '$app/environment';
  import { loadedThumbnails, markThumbnailLoaded } from '$lib/tv/store';
  import {
    getWatchProgress,
    getLatestWatchProgressByBaseId,
    getSeriesProgressSummary,
    PROGRESS_CHANGE_EVENT
  } from '$lib/tv/watchHistory';
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  export let item: ContentItem;
  export let isSelected = false;
  export let isMobile = false;
  export let onSelect: (item: ContentItem) => void;
  // Prioritize above-the-fold images for fastest first paint
  export let priority = false;
  export let viewMode: 'grid' | 'list' = 'grid';

  let error = false;
  $: blurhash = item.blurhash;
  $: background = blurhash ? blurhashToCssGradientString(blurhash) : undefined;

  $: altSuffix = item.type === 'movie' ? ' poster' : ' thumbnail';

  // Watch progress tracking
  let watchProgress: { percent: number; isWatched: boolean } | null = null;
  
  function buildBaseId(content: ContentItem | null): string | null {
    if (!content) return null;
    return `${content.type}:${content.id}`;
  }

  function updateWatchProgress() {
    if (!browser) return;
    const baseId = buildBaseId(item);
    if (!baseId) {
      watchProgress = null;
      return;
    }

    // For series, aggregate progress across episodes using total episode metadata when available
    if (item.type === 'series') {
      const series = item as any;
      const hintedTotalValue = Number(series?.episodeCount);
      const hintedTotal = Number.isFinite(hintedTotalValue) && hintedTotalValue > 0
        ? Math.floor(hintedTotalValue)
        : null;
      const summary = getSeriesProgressSummary(baseId, { totalEpisodes: hintedTotal });

      if (!summary || (!summary.isWatched && summary.percent <= 0)) {
        watchProgress = null;
        return;
      }

      watchProgress = {
        percent: summary.percent,
        isWatched: summary.isWatched
      };
      return;
    }

    // For movies, use existing logic
    const candidateIds: string[] = [];
    if (item.type === 'movie') {
      const movie = item as any;
      if (movie.videoId) candidateIds.push(`${baseId}:yt:${movie.videoId}`);
      if (movie.vimeoId) candidateIds.push(`${baseId}:vimeo:${movie.vimeoId}`);
    }

    let progress: ReturnType<typeof getWatchProgress> | null = null;
    for (const id of candidateIds) {
      progress = getWatchProgress(id);
      if (progress) break;
    }

    if (!progress) {
      progress = getLatestWatchProgressByBaseId(baseId);
    }

    if (progress) {
      watchProgress = { percent: progress.percent, isWatched: progress.isWatched };
    } else {
      watchProgress = null;
    }
  }

  onMount(() => {
    updateWatchProgress();
    
    // Update when progress changes in the same tab
    const handleProgressChange: EventListener = () => {
      updateWatchProgress();
    };
    
    window.addEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);
    
    return () => {
      window.removeEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);
    };
  });

  // React to item changes
  $: if (browser && item) {
    updateWatchProgress();
  }

  const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
  function isWithinLastWeek(value?: string): boolean {
    if (!value || typeof value !== 'string') return false;
    const ts = Date.parse(value);
    if (!Number.isFinite(ts)) return false;
    return Date.now() - ts <= ONE_WEEK_MS;
  }

  $: isRecentlyAdded = item.type === 'movie' && isWithinLastWeek((item as any).createdAt);

  $: isWatched = watchProgress?.isWatched || false;
  $: progressPercent = watchProgress?.percent || 0;
  $: hasProgress = !isWatched && progressPercent > 0 && progressPercent < 85;
  $: progressDisplayPercent =
    progressPercent <= 0 ? 0 : Math.min(99, Math.max(1, Math.round(progressPercent)));
  $: progressBarWidth = Math.min(100, Math.max(progressPercent, 4));
  $: isList = viewMode === 'list';
  $: averageRating = item.averageRating ?? null;
  $: ratingCount = item.ratingCount ?? null;
  $: facetType = item.facets?.type ?? null;
  $: facetStyle = item.facets?.filmStyle ?? null;
  $: facetMoodList = Array.isArray(item.facets?.mood) ? item.facets?.mood?.slice(0, 2) : [];

  const facetEmojiMap: Record<string, string> = {
    fiction: '🎬',
    documentary: '🎥',
    session: '🧭',
    event: '🎟️',
    tutorial: '🧠',
    cinematic: '🎞️',
    'street-cinematic': '🏙️',
    skateish: '🛹',
    raw: '⚡',
    pov: '👁️',
    longtakes: '⏳',
    'music-driven': '🎧',
    montage: '🧩',
    slowmo: '🐢',
    gonzo: '🔥',
    vintage: '📼',
    minimalist: '◻️',
    experimental: '🧪',
    energetic: '⚡',
    chill: '🌙',
    gritty: '🧱',
    wholesome: '☀️',
    artistic: '🎨'
  };

  function formatFacet(value: string) {
    return value.replace(/-/g, ' ');
  }

  function facetEmoji(value: string) {
    return facetEmojiMap[value] ?? '✨';
  }

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
  $: baseImageClass = `relative inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ease-out ${isWatched ? 'opacity-30' : ''}`;
</script>

<div
  class="card-shell group"
  class:list={isList}
  class:transform={!isMobile && !isList}
  class:hover:scale-105={!isMobile && !isList}
  class:transition-all={!isMobile && !isList}
  class:duration-300={!isMobile && !isList}
  class:scale-105={!isMobile && !isList && isSelected}
  on:click={() => onSelect(item)}
  on:keydown={(e) => e.key === 'Enter' && onSelect(item)}
  tabindex="0"
  role="button"
>
  {#if isList}
    <div class="list-poster" aria-hidden="true">
      <div class="list-poster-frame">
        <div class="absolute inset-0" style:background-image={background} style:background-size="cover" style:background-position="center"></div>
        {#if isImage(item.thumbnail) && !error}
          <Image
            src={item.thumbnail}
            alt={item.title + altSuffix}
            loading={priority ? 'eager' : 'lazy'}
            fetchpriority={priority ? 'high' : undefined}
            decoding="async"
            width={160}
            height={240}
            class={`${baseImageClass} ${imageOpacityClass}`}
            cdn={dev ? undefined : 'netlify'}
            layout="constrained"
            onload={handleLoaded}
            onerror={() => { error = true; }}
          />
        {/if}
        {#if isWatched}
          <div class="absolute inset-0 bg-black/45 z-10 pointer-events-none"></div>
        {/if}
      </div>
    </div>
    <div class="list-body">
      <div class="list-main">
        <div class="list-header">
          <div class="list-title">
            {item.title}
            {#if item.type === 'movie' && item.year}
              <span class="list-year">({item.year})</span>
            {/if}
          </div>
          <div class="list-meta">
            {#if item.type === 'movie'}
              <span>{item.duration || 'Movie'}</span>
            {:else}
              <span>{(item as any).episodeCount || '?'} eps</span>
            {/if}
            {#if item.paid}
              <span class="list-pill">Paid</span>
            {/if}
            {#if isRecentlyAdded}
              <span class="list-pill list-pill--hot">New</span>
            {/if}
            {#if isWatched}
              <span class="list-pill list-pill--watched">Watched</span>
            {/if}
          </div>
        </div>
        {#if item.description}
          <p class="list-description">{item.description}</p>
        {/if}
        {#if facetType || facetStyle || facetMoodList.length}
          <div class="list-facets">
            {#if facetType}
              <span class="list-facet-chip list-facet-chip--type">{facetEmoji(facetType)} {formatFacet(facetType)}</span>
            {/if}
            {#if facetStyle}
              <span class="list-facet-chip list-facet-chip--style">{facetEmoji(facetStyle)} {formatFacet(facetStyle)}</span>
            {/if}
            {#each facetMoodList as mood}
              <span class="list-facet-chip list-facet-chip--mood">{facetEmoji(mood)} {formatFacet(mood)}</span>
            {/each}
          </div>
        {/if}
        {#if hasProgress}
          <div class="list-progress" aria-label={`Continue watching at ${progressDisplayPercent}%`}>
            <div class="list-progress-track">
              <div class="list-progress-fill" style:width={`${progressBarWidth}%`}></div>
            </div>
            <span>{progressDisplayPercent}%</span>
          </div>
        {/if}
      </div>
      <div class="list-side">
        <div class="list-side-block">
          <div class="list-side-label">Rating</div>
          <div class="list-rating">
            {#if averageRating !== null && ratingCount}
              {averageRating.toFixed(1)}
              <span class="list-rating-count">({ratingCount})</span>
            {:else}
              n/a
            {/if}
          </div>
        </div>
        <div class="list-side-block">
          <div class="list-side-label">Details</div>
          <div class="list-side-row list-side-chips">
            <span>{item.type === 'movie' ? 'Movie' : 'Series'}</span>
            {#if item.provider}
              <span>{item.provider}</span>
            {/if}
            {#if item.type === 'movie' && item.year}
              <span>{item.year}</span>
            {/if}
            {#if item.type === 'movie' && item.duration}
              <span>{item.duration}</span>
            {/if}
            {#if item.type === 'series'}
              <span>{(item as any).episodeCount || '?'} eps</span>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else}
    <div
      class="card-frame"
      class:transition-all={!isMobile}
      class:duration-300={!isMobile}
      class:card-frame--active={!isMobile && isSelected}
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
          class={`${baseImageClass} ${imageOpacityClass}`}
          cdn={dev ? undefined : 'netlify'}
          layout="constrained"
          onload={handleLoaded}
          onerror={() => { error = true; }}
        />
      {/if}

      <!-- Watched dimming overlay -->
      {#if isWatched}
        <div class="absolute inset-0 bg-black/50 z-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-0"></div>
      {/if}

      <div class="card-badges">
        {#if isRecentlyAdded}
          <span class="card-badge card-badge--hot">NEW</span>
        {/if}
        {#if item.paid}
          <span class="card-badge card-badge--paid">PAID</span>
        {/if}
        {#if isWatched}
          <span class="card-badge card-badge--watched">WATCHED</span>
        {/if}
      </div>

      <!-- Bottom-right info: duration for movies, episode count for series -->
      <div class="card-meta">
        {#if item.type === 'movie'}
          {item.duration}
        {:else}
          {(item as any).episodeCount || '?'} eps
        {/if}
      </div>

      <!-- Progress bar at bottom -->
      {#if hasProgress}
        <div class="card-progress" aria-label={`Continue watching at ${progressDisplayPercent}%`}>
          <div class="card-progress-inner">
            <div class="card-progress-label">
              <span>CONTINUE</span>
              <span>{progressDisplayPercent}%</span>
            </div>
            <div class="card-progress-track">
              <div class="card-progress-fill" style:width={`${progressBarWidth}%`}></div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .card-shell {
    cursor: pointer;
  }

  .card-shell.list {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 1rem;
    align-items: center;
    padding: 0.85rem 1rem;
    border-radius: 22px;
    border: 1px solid rgba(248, 250, 252, 0.14);
    background:
      linear-gradient(135deg, rgba(14, 20, 36, 0.92), rgba(8, 12, 24, 0.85)),
      radial-gradient(circle at top left, rgba(229, 9, 20, 0.12), transparent 55%);
    box-shadow: 0 24px 60px -42px rgba(2, 6, 23, 0.85);
    transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
  }

  .card-shell.list:hover {
    border-color: rgba(248, 250, 252, 0.26);
    box-shadow: 0 28px 70px -40px rgba(2, 6, 23, 0.9);
  }

  .card-frame {
    position: relative;
    aspect-ratio: var(--card-ratio, 2 / 3);
    border-radius: 20px;
    overflow: hidden;
    background: rgba(8, 12, 24, 0.6);
    border: 1px solid rgba(248, 250, 252, 0.15);
    box-shadow: 0 18px 40px -25px rgba(2, 6, 23, 0.85);
  }

  .card-frame--active {
    border-color: rgba(229, 9, 20, 0.55);
    box-shadow: 0 25px 55px -30px rgba(229, 9, 20, 0.55);
  }

  .card-badges {
    position: absolute;
    top: 0.75rem;
    left: 0.75rem;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    z-index: 20;
  }

  .card-badge {
    font-size: 0.55rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    padding: 0.2rem 0.45rem;
    border-radius: 999px;
    border: 1px solid rgba(248, 250, 252, 0.2);
    background: rgba(8, 12, 24, 0.7);
    color: rgba(248, 250, 252, 0.85);
  }

  .card-badge--hot {
    border-color: rgba(229, 9, 20, 0.6);
    color: rgba(255, 230, 224, 0.9);
  }

  .card-badge--paid {
    border-color: rgba(250, 204, 21, 0.5);
    color: rgba(254, 240, 138, 0.9);
  }

  .card-badge--watched {
    border-color: rgba(34, 197, 94, 0.45);
    color: rgba(187, 247, 208, 0.9);
  }

  .card-meta {
    position: absolute;
    bottom: 0.8rem;
    right: 0.8rem;
    z-index: 20;
    font-size: 0.6rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 0.35rem 0.55rem;
    border-radius: 999px;
    background: rgba(6, 10, 20, 0.7);
    border: 1px solid rgba(248, 250, 252, 0.12);
    color: rgba(226, 232, 240, 0.85);
  }

  .card-progress {
    position: absolute;
    left: 0.75rem;
    right: 0.75rem;
    bottom: 0.75rem;
    z-index: 20;
  }

  .card-progress-inner {
    border-radius: 16px;
    border: 1px solid rgba(248, 250, 252, 0.12);
    background: rgba(7, 10, 20, 0.7);
    padding: 0.55rem 0.75rem;
    backdrop-filter: blur(8px);
  }

  .card-progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.55rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(248, 250, 252, 0.85);
  }

  .card-progress-track {
    margin-top: 0.4rem;
    height: 0.25rem;
    width: 100%;
    border-radius: 999px;
    background: rgba(248, 250, 252, 0.15);
    overflow: hidden;
  }

  .card-progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(229, 9, 20, 0.9), rgba(229, 9, 20, 0.6));
    transition: width 0.3s ease;
  }

  .list-poster {
    width: clamp(78px, 8vw, 120px);
  }

  .list-poster-frame {
    position: relative;
    border-radius: 16px;
    overflow: hidden;
    aspect-ratio: 2 / 3;
    border: 1px solid rgba(248, 250, 252, 0.12);
    background: rgba(8, 12, 24, 0.6);
  }

  .list-body {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.8fr);
    gap: 1.25rem;
    min-width: 0;
  }

  .list-main {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 0;
  }

  .list-title {
    font-size: 1.05rem;
    font-weight: 700;
    color: rgba(248, 250, 252, 0.95);
    line-height: 1.15;
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    align-items: baseline;
  }

  .list-year {
    font-size: 0.75rem;
    color: rgba(148, 163, 184, 0.9);
  }

  .list-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
    font-size: 0.62rem;
    text-transform: uppercase;
    letter-spacing: 0.14em;
    color: rgba(148, 163, 184, 0.85);
  }

  .list-pill {
    padding: 0.15rem 0.45rem;
    border-radius: 999px;
    border: 1px solid rgba(248, 250, 252, 0.18);
    color: rgba(226, 232, 240, 0.85);
  }

  .list-pill--hot {
    border-color: rgba(229, 9, 20, 0.55);
    color: rgba(255, 226, 220, 0.95);
  }

  .list-pill--watched {
    border-color: rgba(34, 197, 94, 0.45);
    color: rgba(187, 247, 208, 0.95);
  }

  .list-description {
    color: rgba(203, 213, 225, 0.85);
    font-size: 0.84rem;
    line-height: 1.5;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
    max-width: 60ch;
  }

  .list-facets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .list-facet-chip {
    padding: 0.2rem 0.55rem;
    border-radius: 999px;
    font-size: 0.6rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    border: 1px solid rgba(248, 250, 252, 0.18);
    color: rgba(248, 250, 252, 0.9);
    background: rgba(8, 12, 24, 0.65);
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .list-facet-chip--type {
    border-color: rgba(229, 9, 20, 0.45);
    background: rgba(62, 12, 18, 0.65);
  }

  .list-facet-chip--style {
    border-color: rgba(37, 99, 235, 0.45);
    background: rgba(10, 20, 45, 0.65);
  }

  .list-facet-chip--mood {
    border-color: rgba(16, 185, 129, 0.45);
    background: rgba(10, 30, 26, 0.65);
  }

  .list-rating {
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: rgba(248, 250, 252, 0.7);
  }

  .list-rating-count {
    font-size: 0.7rem;
    letter-spacing: 0.04em;
    color: rgba(148, 163, 184, 0.8);
  }

  .list-side {
    display: flex;
    flex-direction: column;
    gap: 0.9rem;
    align-items: flex-start;
    padding-left: 1.1rem;
    border-left: 1px solid rgba(248, 250, 252, 0.12);
  }

  .list-side-block {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    width: 100%;
  }

  .list-side-label {
    font-size: 0.55rem;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: rgba(148, 163, 184, 0.7);
  }

  .list-side-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 0.6rem;
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: rgba(203, 213, 225, 0.8);
  }

  .list-side-chips span {
    padding: 0.18rem 0.5rem;
    border-radius: 999px;
    border: 1px solid rgba(248, 250, 252, 0.12);
    background: rgba(8, 12, 24, 0.6);
  }

  .list-progress {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.62rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: rgba(248, 250, 252, 0.7);
    margin-top: 0.35rem;
  }

  .list-progress-track {
    width: 96px;
    height: 0.25rem;
    border-radius: 999px;
    background: rgba(248, 250, 252, 0.14);
    overflow: hidden;
  }

  .list-progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(229, 9, 20, 0.9), rgba(229, 9, 20, 0.6));
  }

  @media (max-width: 640px) {
    .card-shell.list {
      grid-template-columns: 1fr;
      justify-items: center;
      text-align: center;
    }

    .list-body {
      grid-template-columns: 1fr;
    }

    .list-side {
      align-items: center;
      padding-left: 0;
      border-left: none;
      border-top: 1px solid rgba(248, 250, 252, 0.12);
      padding-top: 0.75rem;
      width: 100%;
    }

    .list-meta,
    .list-side-row {
      justify-content: center;
    }

    .list-progress {
      justify-content: center;
    }
  }
</style>
