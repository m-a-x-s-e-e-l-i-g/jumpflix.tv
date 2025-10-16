<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import SidebarDetails from '$lib/tv/SidebarDetails.svelte';
  import PlayerModal from '$lib/tv/PlayerModal.svelte';
  import MobileDetailsOverlay from '$lib/tv/MobileDetailsOverlay.svelte';
  import TvHeroSection from '$lib/tv/TvHeroSection.svelte';
  import TvSearchControls from '$lib/tv/TvSearchControls.svelte';
  import TvCatalogGrid from '$lib/tv/TvCatalogGrid.svelte';
  import { visibleContent, visibleKeys, sortedAllContent, searchQuery, showPaid, sortBy, selectedContent, showPlayer, showDetailsPanel, selectedIndex, selectContent, openContent, closePlayer, closeDetailsPanel, selectedEpisode, openEpisode, selectEpisode } from '$lib/tv/store';
  import type { ContentItem } from '$lib/tv/types';
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { getUrlForItem, getEpisodeUrl } from '$lib/tv/slug';

  export let initialItem: ContentItem | null = null;
  export let initialEpisodeNumber: number | null = null;
  export let initialSeasonNumber: number | null = null;

  let isMobile = false;
  let gridEl: HTMLElement | null = null;
  // Track how selection was changed to decide if URL should sync
  let lastSelectionSource: 'keyboard' | 'click' | 'programmatic' = 'programmatic';
  let currentPath = '';
  let pageTitle: string | null = null;
  let logoTilt = 0;

  // ————————————————————————————————————————————————————————————————
  // Small helpers to deduplicate selection/navigation logic
  function buildItemUrl(item: ContentItem, opts?: { epId?: string; episodeNumber?: number; seasonNumber?: number }) {
    const base = getUrlForItem(item);
    // Prefer pretty episode URL when possible
    const path = (item.type === 'series' && typeof opts?.episodeNumber === 'number')
      ? getEpisodeUrl(item as any, { episodeNumber: Math.max(1, Math.floor(opts!.episodeNumber!)), seasonNumber: opts?.seasonNumber })
      : base;
    // Build query params. IMPORTANT: Do NOT carry forward the search query (`q`).
    // We intentionally keep the URL clean of the search query on any update.
    const params = new URLSearchParams();
    if (item.type === 'series' && !opts?.episodeNumber && opts?.epId) params.set('ep', opts.epId);
    const query = params.toString();
    return `${path}${query ? `?${query}` : ''}`;
  }
  function nav(url: string, opts?: { replace?: boolean }) {
    // Use SvelteKit's navigation for consistent URL updates and store sync.
    goto(url, { replaceState: !!opts?.replace, noScroll: true, keepFocus: true });
  }
  function setMobileDetails(open: boolean) {
    if (!browser) return;
    showDetailsPanel.set(open);
    const cls = 'overflow-hidden';
    if (open) document.documentElement.classList.add(cls);
    else if (!$showPlayer) document.documentElement.classList.remove(cls);
  }

  // Select incoming initial item/episode reactively (supports layout-provided changes on navigation)
  $: if (browser) {
    if (initialItem) {
      selectContent(initialItem);
      if (window.innerWidth < 768) {
        setMobileDetails(true);
      }
      // Apply initial episode/season for series when provided
      if ((initialItem as any).type === 'series') {
        if (typeof initialEpisodeNumber === 'number' && Number.isFinite(initialEpisodeNumber)) {
          const n = Math.max(1, Math.floor(initialEpisodeNumber));
          selectEpisode({ id: `pos:${n}`, title: `Episode ${n}`, position: n } as any);
        }
      }
    }
  }

  function handleSelect(item: ContentItem) {
    // Clicking selects and syncs URL (navigation), but avoids scroll/focus jumps
    lastSelectionSource = 'click';
    selectContent(item);
    if (browser) nav(buildItemUrl(item));
    if (browser && isMobile) setMobileDetails(true);
  }
  function handleOpenContent(item: ContentItem) {
    if (browser && isMobile) setMobileDetails(false);
    // Ensure URL matches opened content
    if (browser) nav(buildItemUrl(item));
    openContent(item);
  }

  // Opening an episode from the details panel opens the player and updates URL
  function handleOpenEpisode(videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) {
    if (browser && isMobile) setMobileDetails(false);
    // Update URL to include the selected episode for series
    if (browser && $selectedContent && $selectedContent.type === 'series') {
      const url = episodeNumber
        ? buildItemUrl($selectedContent, { episodeNumber, seasonNumber: seasonNumber ?? undefined })
        : buildItemUrl($selectedContent, { epId: videoId });
      if (url !== currentPath) nav(url);
    }
    openEpisode({ id: videoId, title, position: episodeNumber });
  }

  // Selecting an episode from the details panel updates selection and URL, but does not open the player
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
    if (isMobile && $showDetailsPanel) document.documentElement.classList.add('overflow-hidden');
    else if (!$showPlayer) document.documentElement.classList.remove('overflow-hidden');
  }
  function openExternalContent(content: ContentItem) { if (content?.externalUrl) window.open(content.externalUrl, '_blank', 'noopener'); }
  
  // Extract season/episode from pretty URLs like /series/<slug>/seasons/1/episodes/7
  function extractSeasonEpisodeFromPath(path: string): { season?: number; episode?: number } {
    const m = path.match(/\/seasons\/(\d+)\/episodes\/(\d+)/);
    if (m) {
      const season = Math.max(1, parseInt(m[1] || '1', 10));
      const episode = Math.max(1, parseInt(m[2] || '1', 10));
      return { season, episode };
    }
    return {};
  }

  // Build a descriptive page title based on the selected content (optionally with S/E)
  function buildPageTitle(item: ContentItem, opts?: { season?: number; episode?: number }): string {
    if (item.type === 'movie') {
      const year = (item as any).year ? ` (${(item as any).year})` : '';
      return `${item.title}${year} — Watch Parkour Film on JUMPFLIX`;
    }
    const s = opts?.season;
    const e = opts?.episode;
    if (typeof e === 'number') {
      const sStr = typeof s === 'number' ? `s${String(s).padStart(2, '0')}` : '';
      const eStr = `e${String(e).padStart(2, '0')}`;
      const code = sStr ? `${sStr}${eStr}` : eStr;
      return `${item.title} ${code} — Watch Parkour Series on JUMPFLIX`;
    }
    return `${item.title} — Watch Parkour Series on JUMPFLIX`;
  }

  // Compute number of columns in the grid based on current layout
  let columns = 1;
  function computeColumns(): number {
    if (!gridEl) return 1;
    const children = Array.from(gridEl.children) as HTMLElement[];
    if (!children.length) return 1;
    // Only consider visible elements (display != none)
    const visibleEls = children.filter((el) => el.offsetParent !== null);
    if (!visibleEls.length) return 1;
    const firstTop = visibleEls[0].offsetTop;
    let count = 0;
    for (const el of visibleEls) {
      if (Math.abs(el.offsetTop - firstTop) < 2) count++;
      else break;
    }
    return count || 1;
  }
  $: if (browser) { columns = computeColumns(); }
  function isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    const tag = target.tagName;
    if (target.isContentEditable) return true;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return true;
    const role = target.getAttribute('role');
    if (role && ['textbox','combobox'].includes(role)) return true;
    return false;
  }

  // Map visible list index to DOM index among all items (skipping hidden ones)
  function getDomIndexForVisibleIndex(vIdx: number) {
    const visibleKeyArray = $visibleContent.map((it) => `${it.type}:${it.id}`);
    const targetKey = visibleKeyArray[vIdx];
    if (!targetKey) return -1;
    const all = $sortedAllContent;
    return all.findIndex((it) => `${it.type}:${it.id}` === targetKey);
  }

  // Ensure the selected item is visible in the grid (if not, scroll it into view)
  function scrollSelectedIntoView(idx: number) {
    if (!gridEl) return;
    const domIdx = getDomIndexForVisibleIndex(idx);
    if (domIdx < 0) return;
    const el = gridEl.children[domIdx] as HTMLElement | undefined;
    if (!el) return;
    // Defer to next frame to ensure DOM has settled before measuring/scrolling
    requestAnimationFrame(() => {
      try {
        const margin = 16; // keep a bit of space from the viewport edges
        const rect = el.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const outsideTop = rect.top < margin;
        const outsideBottom = rect.bottom > (vh - margin);
        const outsideLeft = rect.left < margin;
        const outsideRight = rect.right > (vw - margin);
        if (outsideTop || outsideBottom || outsideLeft || outsideRight) {
          el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
        }
      } catch {}
    });
  }

  // Set selection by index in the visible list
  function setIndex(idx: number) { const list = $visibleContent; if (!list.length) return; const clamped = Math.max(0, Math.min(list.length - 1, idx)); selectedIndex.set(clamped); selectedContent.set(list[clamped]); scrollSelectedIntoView(clamped); }
  
  // Handle keyboard navigation and actions
  function handleKeydown(event: KeyboardEvent) { if ($showPlayer && event.key === 'Escape') { closePlayer(); return; } if (event.key === 'Escape' && document.fullscreenElement) { document.exitFullscreen(); closePlayer(); return; } if (isTypingTarget(event.target)) return; if ($showPlayer) return; const list = $visibleContent; if (!list.length) return; const idx = $selectedIndex; const current = $selectedContent; switch (event.key) { case 'ArrowRight': event.preventDefault(); lastSelectionSource = 'keyboard'; setIndex(idx + 1); break; case 'ArrowLeft': event.preventDefault(); lastSelectionSource = 'keyboard'; setIndex(idx - 1); break; case 'ArrowDown': event.preventDefault(); lastSelectionSource = 'keyboard'; setIndex(idx + columns); break; case 'ArrowUp': event.preventDefault(); lastSelectionSource = 'keyboard'; setIndex(idx - columns); break; case 'Enter': if (current) { event.preventDefault(); lastSelectionSource = 'keyboard'; openContent(current); } break; } }

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
    // Initialize the currentPath from the page store and subscribe for changes
    currentPath = `${get(page).url.pathname}${get(page).url.search}`;
    const unsubPage = page.subscribe((p) => {
      currentPath = `${p.url.pathname}${p.url.search}`;
    });
  
    // Initialize search from URL param (?q=...)
    const q = get(page).url.searchParams.get('q') ?? '';
    if (q) searchQuery.set(q);
  
    // Initialize episode from pretty path: initialEpisodeNumber (preferred)
    if (initialItem && (initialItem as any).type === 'series') {
      if (initialEpisodeNumber && Number.isFinite(initialEpisodeNumber)) {
        const n = Math.max(1, Math.floor(initialEpisodeNumber));
        selectEpisode({ id: `pos:${n}`, title: `Episode ${n}`, position: n } as any);
      }
    }

    function updateIsMobile() { isMobile = window.innerWidth < 768; if (!isMobile) showDetailsPanel.set(false); }
    updateIsMobile();
    columns = computeColumns();
    const resizeHandler = () => { updateIsMobile(); columns = computeColumns(); };
    window.addEventListener('resize', resizeHandler);
    document.addEventListener('keydown', handleKeydown);
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) closePlayer(); });

    const maxTilt = 6.5;
    let rafId: number | null = null;
    const updateLogoTilt = () => {
      const raw = typeof window === 'undefined' ? 0 : window.scrollY;
      const next = Math.min(maxTilt, Math.max(0, raw / 90));
      logoTilt = next;
    };
    const handleScroll = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        updateLogoTilt();
        rafId = null;
      });
    };
    updateLogoTilt();
    window.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', resizeHandler);
      window.removeEventListener('scroll', handleScroll);
      if (rafId !== null) cancelAnimationFrame(rafId);
      unsubPage();
    };
  });

  // Keep the URL in sync with the currently selected content.
  $: if (browser && $selectedContent) {
      // Always keep the document title in sync with the selection (include S/E if available)
      const fromPath = extractSeasonEpisodeFromPath(currentPath);
      const episodeHint = ($selectedEpisode?.position && Number.isFinite($selectedEpisode.position))
        ? Math.max(1, Math.floor($selectedEpisode.position))
        : fromPath.episode;
      const seasonHint = fromPath.season ?? (typeof initialSeasonNumber === 'number' ? Math.max(1, Math.floor(initialSeasonNumber)) : undefined);
      pageTitle = buildPageTitle($selectedContent, { season: seasonHint, episode: episodeHint });

      // Only sync URL when not on a specific episode of a series
      const shouldSyncBaseUrl = !($selectedContent.type === 'series' && $selectedEpisode);
      if (shouldSyncBaseUrl) {
        const target = buildItemUrl($selectedContent);
        const current = currentPath;
        if (current !== target) {
          if (lastSelectionSource === 'keyboard') {
            // Avoid navigation to preserve focus; just update the URL
            window.history.replaceState({}, '', target);
            currentPath = target; // keep our local path in sync
          } else {
            // Use SvelteKit navigation so +layout/+page loads run and <svelte:head> updates
            nav(target, { replace: true });
            // Optimistically sync local path to avoid transient mismatch
            currentPath = target;
          }
        }
      }
  }

  // Prioritize first visible posters above the fold even when hidden items remain mounted
  $: priorityKeys = new Set(($visibleContent || []).slice(0, Math.max(columns * 2, 8)).map((it) => `${it.type}:${it.id}`));
</script>

<svelte:head>
  {#if pageTitle}
    <title>{pageTitle}</title>
  {/if}
</svelte:head>

<div class="relative isolate min-h-screen bg-background text-foreground tv-page overflow-x-hidden md:pr-[460px]">
  <div class="page-backdrop" aria-hidden="true">
    <div class="hero-gradient hero-gradient--page"></div>
    <div class="hero-glow hero-glow--one hero-glow--page"></div>
    <div class="hero-glow hero-glow--two hero-glow--page"></div>
    <div class="hero-grid hero-grid--page"></div>
    <div class="hero-noise hero-noise--page"></div>
  </div>
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
    <div class="hidden md:flex w-[460px] border-l border-slate-200/70 dark:border-gray-700/50 px-6 pt-14 pb-6 fixed right-0 top-0 bottom-0 overflow-hidden flex-col bg-gradient-to-b from-white/90 via-white/75 to-white/55 dark:from-[#0f172a]/60 dark:via-[#0f172a]/35 dark:to-[#0f172a]/20 backdrop-blur-xl">
      <SidebarDetails
        selected={$selectedContent}
        openContent={handleOpenContent}
        openExternal={openExternalContent}
        onOpenEpisode={handleOpenEpisode}
        onSelectEpisode={handleSelectEpisode}
        selectedEpisode={$selectedEpisode}
        initialSeason={initialSeasonNumber ?? undefined}
        {isMobile}
      />
    </div>
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

  .page-backdrop {
    position: absolute;
    inset: 0;
    z-index: -30;
    pointer-events: none;
    overflow: hidden;
  }

  .hero-gradient {
    position: absolute;
    inset: 0;
    background: var(--hero-gradient);
    opacity: var(--hero-gradient-opacity);
  }

  .hero-glow {
    position: absolute;
    border-radius: 9999px;
    filter: blur(120px);
    opacity: 0.7;
    mix-blend-mode: screen;
    animation: heroGlow 14s ease-in-out infinite alternate;
  }

  .hero-glow--one {
    top: -28%;
    right: 12%;
    width: 420px;
    height: 420px;
    background: var(--hero-glow-one);
    animation-delay: -3s;
  }

  .hero-glow--two {
    bottom: -30%;
    left: 6%;
    width: 520px;
    height: 520px;
    background: var(--hero-glow-two);
    animation-delay: -8s;
  }

  .hero-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, var(--hero-grid-line-x) 1px, transparent 1px),
      linear-gradient(to bottom, var(--hero-grid-line-y) 1px, transparent 1px);
    background-size: 140px 140px;
    mask-image: radial-gradient(circle at 40% 30%, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0) 70%);
    opacity: var(--hero-grid-opacity);
  }

  .hero-noise {
    position: absolute;
    inset: -10px;
    background-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="none"%3E%3Cfilter id="n" x="0" y="0" width="1" height="1"%3E%3CfeTurbulence baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" type="fractalNoise"/%3E%3CfeColorMatrix type="saturate" values="0"/%3E%3C/filter%3E%3Crect width="200" height="200" filter="url(%23n)" opacity="0.22"/%3E%3C/svg%3E');
    background-size: 260px;
    opacity: var(--hero-noise-opacity);
    mix-blend-mode: soft-light;
    pointer-events: none;
  }

  .hero-gradient--page,
  .hero-grid--page,
  .hero-noise--page,
  .hero-glow--page {
    height: 100%;
  }

  .hero-gradient--page {
    opacity: 1;
  }

  .hero-grid--page {
    opacity: var(--hero-grid-opacity);
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.85) 30%, rgba(0, 0, 0, 0.6) 65%, rgba(0, 0, 0, 0.2) 100%);
  }

  .hero-noise--page {
    opacity: var(--hero-noise-opacity);
  }

  .hero-glow--page {
    filter: blur(160px);
    opacity: var(--hero-glow-page-opacity);
    animation-duration: 20s;
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

  @keyframes heroGlow {
    from {
      transform: translate3d(-12px, -10px, 0) scale(0.96);
      opacity: 0.68;
    }
    to {
      transform: translate3d(16px, 18px, 0) scale(1.04);
      opacity: 0.85;
    }
  }

  /* Only apply hover effects on non-mobile devices */
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
