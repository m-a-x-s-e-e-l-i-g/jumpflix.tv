<script lang="ts">
  import { getContext, onMount } from 'svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import PlayerModal from '$lib/tv/PlayerModal.svelte';
  import MobileDetailsOverlay from '$lib/tv/MobileDetailsOverlay.svelte';
  import TvHeroSection from '$lib/tv/TvHeroSection.svelte';
  import TvSearchControls from '$lib/tv/TvSearchControls.svelte';
  import TvCatalogGrid from '$lib/tv/TvCatalogGrid.svelte';
  import TvPageBackdrop from '$lib/tv/TvPageBackdrop.svelte';
  import TvDesktopDetailsPanel from '$lib/tv/TvDesktopDetailsPanel.svelte';
  import {
    visibleContent,
    visibleKeys,
    sortedAllContent,
    searchQuery,
    showPaid,
    sortBy,
    selectedContent,
    showPlayer,
    showDetailsPanel,
    selectedIndex,
    selectContent,
    openContent,
    closePlayer,
    closeDetailsPanel,
    selectedEpisode,
    openEpisode,
    selectEpisode
  } from '$lib/tv/store';
  import type { ContentItem } from '$lib/tv/types';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { buildItemUrl, buildPageTitle, extractSeasonEpisodeFromPath, openExternalContent } from '$lib/tv/helpers/navigation';
  import { clampIndex, computeColumns, ensureVisibleSelection, isTypingTarget } from '$lib/tv/helpers/grid';
  import { SCROLL_CONTEXT_KEY, type ScrollSubscription } from '$lib/scroll-context';

  export let initialItem: ContentItem | null = null;
  export let initialEpisodeNumber: number | null = null;
  export let initialSeasonNumber: number | null = null;

  let isMobile = false;
  let gridEl: HTMLElement | null = null;
  let lastSelectionSource: 'keyboard' | 'click' | 'programmatic' = 'programmatic';
  let currentPath = '';
  let pageTitle: string | null = null;
  let logoTilt = 0;
  let columns = 1;

  const subscribeToScroll = getContext<ScrollSubscription | undefined>(SCROLL_CONTEXT_KEY);

  function nav(url: string, opts?: { replace?: boolean }) {
    goto(url, { replaceState: !!opts?.replace, noScroll: true, keepFocus: true });
  }

  function setMobileDetails(open: boolean) {
    if (!browser) return;
    showDetailsPanel.set(open);
    const cls = 'overflow-hidden';
    if (open) {
      document.documentElement.classList.add(cls);
    } else if (!$showPlayer) {
      document.documentElement.classList.remove(cls);
    }
  }

  $: if (browser && initialItem) {
    selectContent(initialItem);
    if (window.innerWidth < 768) {
      setMobileDetails(true);
    }
    if ((initialItem as any).type === 'series' && typeof initialEpisodeNumber === 'number' && Number.isFinite(initialEpisodeNumber)) {
      const n = Math.max(1, Math.floor(initialEpisodeNumber));
      selectEpisode({ id: `pos:${n}`, title: `Episode ${n}`, position: n } as any);
    }
  }

  function handleSelect(item: ContentItem) {
    lastSelectionSource = 'click';
    selectContent(item);
    if (browser) nav(buildItemUrl(item));
    if (browser && isMobile) setMobileDetails(true);
  }

  function handleOpenContent(item: ContentItem) {
    if (browser && isMobile) setMobileDetails(false);
    if (browser) nav(buildItemUrl(item));
    openContent(item);
  }

  function handleOpenEpisode(videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) {
    if (browser && isMobile) setMobileDetails(false);
    if (browser && $selectedContent && $selectedContent.type === 'series') {
      const url = episodeNumber
        ? buildItemUrl($selectedContent, { episodeNumber, seasonNumber: seasonNumber ?? undefined })
        : buildItemUrl($selectedContent, { epId: videoId });
      if (url !== currentPath) nav(url);
    }
    openEpisode({ id: videoId, title, position: episodeNumber });
  }

  function handleSelectEpisode(videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) {
    selectEpisode({ id: videoId, title, position: episodeNumber });
    if (browser && $selectedContent) {
      const url = ($selectedContent.type === 'series' && episodeNumber)
        ? buildItemUrl($selectedContent, { episodeNumber, seasonNumber: seasonNumber ?? undefined })
        : buildItemUrl($selectedContent, { epId: videoId });
      if (url !== currentPath) nav(url, { replace: true });
    }
  }

  $: if (browser) {
    if (isMobile && $showDetailsPanel) {
      document.documentElement.classList.add('overflow-hidden');
    } else if (!$showPlayer) {
      document.documentElement.classList.remove('overflow-hidden');
    }
  }

  $: if (browser) {
    columns = computeColumns(gridEl);
  }

  function setIndex(idx: number) {
    const list = $visibleContent;
    if (!list.length) return;
    const clamped = clampIndex(list.length, idx);
    selectedIndex.set(clamped);
    selectedContent.set(list[clamped]);
    ensureVisibleSelection({
      gridEl,
      visibleContent: list,
      allContent: $sortedAllContent,
      index: clamped
    });
  }

  function handleKeydown(event: KeyboardEvent) {
    if ($showPlayer && event.key === 'Escape') {
      closePlayer();
      return;
    }
    if (event.key === 'Escape' && document.fullscreenElement) {
      document.exitFullscreen();
      closePlayer();
      return;
    }
    if (isTypingTarget(event.target) || $showPlayer) {
      return;
    }

    const list = $visibleContent;
    if (!list.length) return;

    const idx = $selectedIndex;
    const current = $selectedContent;

    switch (event.key) {
      case 'ArrowRight':
        event.preventDefault();
        lastSelectionSource = 'keyboard';
        setIndex(idx + 1);
        break;
      case 'ArrowLeft':
        event.preventDefault();
        lastSelectionSource = 'keyboard';
        setIndex(idx - 1);
        break;
      case 'ArrowDown':
        event.preventDefault();
        lastSelectionSource = 'keyboard';
        setIndex(idx + columns);
        break;
      case 'ArrowUp':
        event.preventDefault();
        lastSelectionSource = 'keyboard';
        setIndex(idx - columns);
        break;
      case 'Enter':
        if (current) {
          event.preventDefault();
          lastSelectionSource = 'keyboard';
          openContent(current);
        }
        break;
    }
  }

  function handleMobileBack() {
    lastSelectionSource = 'programmatic';
    setMobileDetails(false);
    selectedContent.set(null);
    selectedEpisode.set(null);
    pageTitle = null;
    if (browser) {
      const target = '/';
      if (currentPath !== target) {
        nav(target, { replace: true });
        currentPath = target;
      }
    }
  }

  onMount(() => {
    currentPath = `${get(page).url.pathname}${get(page).url.search}`;
    const unsubPage = page.subscribe((p) => {
      currentPath = `${p.url.pathname}${p.url.search}`;
    });

    const q = get(page).url.searchParams.get('q') ?? '';
    if (q) searchQuery.set(q);

    if (initialItem && (initialItem as any).type === 'series') {
      if (initialEpisodeNumber && Number.isFinite(initialEpisodeNumber)) {
        const n = Math.max(1, Math.floor(initialEpisodeNumber));
        selectEpisode({ id: `pos:${n}`, title: `Episode ${n}`, position: n } as any);
      }
    }

    const updateIsMobile = () => {
      isMobile = window.innerWidth < 768;
      if (!isMobile) showDetailsPanel.set(false);
    };
    updateIsMobile();
    columns = computeColumns(gridEl);

    const resizeHandler = () => {
      updateIsMobile();
      columns = computeColumns(gridEl);
    };
    window.addEventListener('resize', resizeHandler);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('fullscreenchange', () => {
      if (!document.fullscreenElement) closePlayer();
    });

    const maxTilt = 6.5;
    let rafId: number | null = null;
    const applyLogoTilt = (raw: number) => {
      const next = Math.min(maxTilt, Math.max(0, raw / 30));
      logoTilt = next;
    };
    const scheduleLogoTilt = (raw: number) => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        applyLogoTilt(raw);
        rafId = null;
      });
    };

    const initialScroll = typeof window === 'undefined' ? 0 : window.scrollY;
    applyLogoTilt(initialScroll);

    const cleanupScroll = subscribeToScroll
      ? subscribeToScroll((value) => scheduleLogoTilt(value))
      : (() => {
          const fallbackScroll = () => {
            scheduleLogoTilt(window.scrollY);
          };
          window.addEventListener('scroll', fallbackScroll, { passive: true });
          fallbackScroll();
          return () => {
            window.removeEventListener('scroll', fallbackScroll);
          };
        })();

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', resizeHandler);
      cleanupScroll?.();
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsubPage();
    };
  });

  $: if (browser && $selectedContent) {
    const fromPath = extractSeasonEpisodeFromPath(currentPath);
    const episodeHint = ($selectedEpisode?.position && Number.isFinite($selectedEpisode.position))
      ? Math.max(1, Math.floor($selectedEpisode.position))
      : fromPath.episode;
    const seasonHint = fromPath.season ?? (typeof initialSeasonNumber === 'number'
      ? Math.max(1, Math.floor(initialSeasonNumber))
      : undefined);
    pageTitle = buildPageTitle($selectedContent, { season: seasonHint, episode: episodeHint });

    const shouldSyncBaseUrl = !($selectedContent.type === 'series' && $selectedEpisode);
    if (shouldSyncBaseUrl) {
      const target = buildItemUrl($selectedContent);
      const current = currentPath;
      if (current !== target) {
        if (lastSelectionSource === 'keyboard') {
          window.history.replaceState({}, '', target);
          currentPath = target;
        } else {
          nav(target, { replace: true });
          currentPath = target;
        }
      }
    }
  }

  $: priorityKeys = new Set(($visibleContent || [])
    .slice(0, Math.max(columns * 2, 8))
    .map((it) => `${it.type}:${it.id}`));
</script>

<svelte:head>
  {#if pageTitle}
    <title>{pageTitle}</title>
  {/if}
</svelte:head>

<div class="relative isolate min-h-screen bg-background text-foreground tv-page overflow-x-hidden md:pr-[460px]">
  <TvPageBackdrop />
  <section class="relative isolate overflow-hidden px-6 pt-24 pb-16 sm:pt-32 sm:pb-20">
    <div class="hero-overlay" aria-hidden="true"></div>

    <TvHeroSection {logoTilt} />

    <TvSearchControls {searchQuery} {showPaid} {sortBy} />
  </section>
  <div>
    <TvCatalogGrid
      bind:gridElement={gridEl}
      sortedAllContent={$sortedAllContent}
      visibleContent={$visibleContent}
      visibleKeys={$visibleKeys}
      selectedContent={$selectedContent}
      {isMobile}
      priorityKeys={priorityKeys}
      onSelect={handleSelect}
    />
    <TvDesktopDetailsPanel
      selected={$selectedContent}
      openContent={handleOpenContent}
      openExternal={openExternalContent}
      onOpenEpisode={handleOpenEpisode}
      onSelectEpisode={handleSelectEpisode}
      selectedEpisode={$selectedEpisode}
      initialSeasonNumber={initialSeasonNumber}
      {isMobile}
    />
    <MobileDetailsOverlay
      show={$showDetailsPanel}
      {isMobile}
      selected={$selectedContent}
      openContent={handleOpenContent}
      openExternal={openExternalContent}
      onOpenEpisode={handleOpenEpisode}
      onSelectEpisode={handleSelectEpisode}
      selectedEpisode={$selectedEpisode}
      {closeDetailsPanel}
      initialSeason={initialSeasonNumber ?? undefined}
      onBack={handleMobileBack}
    />
  </div>
</div>
<PlayerModal show={$showPlayer} selected={$selectedContent} selectedEpisode={$selectedEpisode} close={closePlayer} />

<style>
  :global(.tv-page) {
    --hero-gradient: linear-gradient(150deg, #eef2ff 5%, #fdeff7 45%, #fff6e5 100%);
    --hero-gradient-opacity: 0.96;
    --hero-glow-one: radial-gradient(circle at center, rgba(248, 113, 113, 0.4), rgba(248, 113, 113, 0));
    --hero-glow-two: radial-gradient(circle at center, rgba(14, 165, 233, 0.3), rgba(14, 165, 233, 0));
    --hero-grid-line-x: rgba(15, 23, 42, 0.12);
    --hero-grid-line-y: rgba(15, 23, 42, 0.08);
    --hero-grid-opacity: 0.4;
    --hero-glow-page-opacity: 0.6;
    --hero-overlay: radial-gradient(circle at 38% 24%, rgba(248, 113, 113, 0.22), transparent 55%),
      radial-gradient(circle at 70% 12%, rgba(59, 130, 246, 0.18), transparent 60%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.8) 0%, rgba(248, 250, 252, 0.92) 100%);
    --hero-overlay-blend: normal;
    --hero-noise-opacity: 0.12;
    --hero-logo-text-shadow: 0 10px 26px rgba(148, 163, 184, 0.35);
    --hero-title-gradient: linear-gradient(120deg, #0f172a 0%, #b91c1c 48%, #7c3aed 92%);
    --hero-title-shadow: 0 10px 22px rgba(148, 163, 184, 0.3);
  }

  :global(.dark .tv-page) {
    --hero-gradient: linear-gradient(150deg, #050712 5%, #0c1430 45%, #1a233e 100%);
    --hero-gradient-opacity: 0.98;
    --hero-glow-one: radial-gradient(circle at center, rgba(229, 9, 20, 0.7), rgba(229, 9, 20, 0));
    --hero-glow-two: radial-gradient(circle at center, rgba(59, 130, 246, 0.55), rgba(59, 130, 246, 0));
    --hero-grid-line-x: rgba(255, 255, 255, 0.08);
    --hero-grid-line-y: rgba(255, 255, 255, 0.05);
    --hero-grid-opacity: 0.55;
    --hero-glow-page-opacity: 0.72;
    --hero-overlay: radial-gradient(circle at 40% 20%, rgba(229, 9, 20, 0.34), transparent 55%),
      radial-gradient(circle at 70% 10%, rgba(59, 130, 246, 0.28), transparent 60%),
      linear-gradient(180deg, rgba(5, 7, 18, 0.05) 0%, rgba(5, 7, 18, 0.85) 100%);
    --hero-overlay-blend: screen;
    --hero-noise-opacity: 0.26;
    --hero-logo-text-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
    --hero-title-gradient: linear-gradient(120deg, rgba(255, 255, 255, 0.95), rgba(229, 9, 20, 0.95) 45%, rgba(244, 114, 182, 0.95) 90%);
    --hero-title-shadow: 0 12px 30px rgba(0, 0, 0, 0.65);
  }

  .hero-overlay {
    position: absolute;
    inset: 0;
    z-index: -5;
    pointer-events: none;
    background: var(--hero-overlay);
    mix-blend-mode: var(--hero-overlay-blend);
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.85) 70%, rgba(0, 0, 0, 0) 100%);
  }

  @media (min-width: 768px) {
    :global(.tv-page .group:hover img) {
      filter: brightness(1.05);
    }

    :global(.tv-page) {
      margin-left: auto;
      margin-right: auto;
    }

    :global(.tv-page .container) {
      max-width: 100%;
      width: 100%;
    }

    :global(.tv-page .tv-main) {
      width: 100%;
    }
  }

  :global(.tv-layout main) {
    max-width: 100vw;
    padding: 0 1rem 0 0;
    margin: 1rem auto;
  }
</style>
