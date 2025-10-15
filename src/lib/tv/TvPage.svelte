<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { get } from 'svelte/store';
  import ContentCard from '$lib/tv/ContentCard.svelte';
  import SidebarDetails from '$lib/tv/SidebarDetails.svelte';
  import PlayerModal from '$lib/tv/PlayerModal.svelte';
  import MobileDetailsOverlay from '$lib/tv/MobileDetailsOverlay.svelte';
  import { visibleContent, visibleKeys, sortedAllContent, searchQuery, showPaid, sortBy, selectedContent, showPlayer, showDetailsPanel, selectedIndex, selectContent, openContent, closePlayer, closeDetailsPanel, selectedEpisode, openEpisode, selectEpisode } from '$lib/tv/store';
  import { loadedThumbnails } from '$lib/tv/store';
  import Switch from '$lib/components/ui/Switch.svelte';
  import { sortLabels } from '$lib/tv/utils';
  import type { ContentItem } from '$lib/tv/types';
  import { browser } from '$app/environment';
  import * as m from '$lib/paraglide/messages';
  import { Image } from '@unpic/svelte';
  import { dev } from '$app/environment';
  import { goto } from '$app/navigation';
  import { getUrlForItem, getEpisodeUrl } from '$lib/tv/slug';

  export let initialItem: ContentItem | null = null;
  export let initialEpisodeNumber: number | null = null;
  export let initialSeasonNumber: number | null = null;

  let isMobile = false;
  let gridEl: HTMLElement;
  // Track how selection was changed to decide if URL should sync
  let lastSelectionSource: 'keyboard' | 'click' | 'programmatic' = 'programmatic';
  let currentPath = '';
  let pageTitle: string | null = null;

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

    return () => {
      document.removeEventListener('keydown', handleKeydown);
      window.removeEventListener('resize', resizeHandler);
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

    <div class="relative z-10 mx-auto flex max-w-6xl flex-col items-center gap-8 text-center">
  <div class="hero-logo-stack">
        <a href="/" aria-label="Go to homepage" data-sveltekit-reload class="hero-logo-link">
          <Image src="/images/jumpflix.webp" alt="JUMPFLIX parkour tv" width={300} height={264} class="hero-logo" cdn={dev ? undefined : 'netlify'} loading="eager" fetchpriority="high" decoding="async" />
        </a>
        <div class="hero-logo-text" aria-hidden="true"><span>JUMPFLIX</span></div>
      </div>
      <div class="flex flex-col items-center gap-4">
        <h1 class="text-center text-4xl font-black uppercase tracking-tight text-white drop-shadow-[0_12px_30px_rgba(0,0,0,0.65)] sm:text-5xl md:text-6xl">
          <span class="hero-title-gradient">{m.tv_heroHeading()}</span>
        </h1>
        <p class="max-w-2xl text-sm font-medium uppercase tracking-[0.28em] text-white/60 sm:text-xs">
          {m.tv_heroTagline()}
        </p>
      </div>
      <div class="mt-4 flex flex-col items-center gap-4 sm:flex-row">
        <a href="#catalog" class="group inline-flex items-center gap-3 rounded-full bg-[#e50914] px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white shadow-[0_22px_40px_-15px_rgba(229,9,20,0.8)] transition hover:bg-[#f6121d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white">
          {m.tv_heroCtaWatch()}
          <svg class="size-4 transition-transform group-hover:translate-x-1" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M11.293 4.293a1 1 0 0 1 1.414 0l4.5 4.5a1 1 0 0 1 0 1.414l-4.5 4.5A1 1 0 0 1 11 14.5V12H4a1 1 0 1 1 0-2h7V5.5a1 1 0 0 1 .293-.707Z"/></svg>
        </a>
        <a href="https://forms.gle/16nYjzWtiTbmwdnGA" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-3 rounded-full border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold uppercase tracking-[0.2em] text-white/80 backdrop-blur transition hover:border-white/60 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/70">
          {m.tv_heroCtaSubmit()}
        </a>
      </div>
    </div>

    <div class="relative z-10 mx-auto mt-16 w-full max-w-5xl">
      <div class="rounded-3xl border border-white/10 bg-white/70 p-6 shadow-[0_35px_90px_-40px_rgba(0,0,0,0.95)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-950/65">
        <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
          <!-- Search -->
          <form class="relative flex-1 min-w-[260px] group">
            <span class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-700 group-focus-within:text-[#e50914] dark:text-gray-400 dark:group-focus-within:text-[#f87171] transition-colors z-10">
              <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"/></svg>
            </span>
            {#if $searchQuery}
              <button type="button" class="absolute inset-y-0 right-3 flex items-center rounded-md p-1 text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 focus:outline-none focus:ring-2 focus:ring-[#e50914] focus:ring-offset-2 focus:ring-offset-white/40 dark:focus:ring-offset-slate-950/70 z-10" on:click={() => { searchQuery.set(''); }} aria-label="Clear search">
                <svg class="h-4 w-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            {/if}
            <input bind:value={$searchQuery} type="text" autocomplete="off" spellcheck="false" placeholder={m.tv_searchPlaceholder()} aria-label="Search content" class="h-12 w-full rounded-2xl border border-white/50 bg-white/60 pr-12 text-sm text-gray-900 placeholder-gray-600 shadow-sm transition focus:border-[#e50914]/80 focus:outline-none focus:ring-2 focus:ring-[#e50914]/70 dark:border-white/10 dark:bg-slate-900/80 dark:text-gray-100 dark:placeholder-gray-400" style="padding-left: 3rem;" />
            <!-- Hidden submit to allow pressing Enter in the input to apply URL update without live-sync -->
            <button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
          </form>

          <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-center lg:justify-end lg:pl-6">
            <!-- Show paid switch -->
            <label class="flex items-center gap-3 select-none rounded-2xl border border-white/15 bg-white/40 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-gray-700 backdrop-blur dark:border-white/10 dark:bg-slate-900/70 dark:text-gray-200">
              <span>{m.tv_showPaid()}</span>
              <Switch bind:checked={$showPaid} ariaLabel={m.tv_showPaid()} />
            </label>

            <!-- Sorting -->
            <div class="relative min-w-[170px]">
              <select
                bind:value={$sortBy}
                class="appearance-none w-full rounded-2xl border border-white/30 bg-white/50 px-4 py-3 pr-10 text-sm font-semibold uppercase tracking-[0.12em] text-gray-800 transition focus:border-[#e50914]/80 focus:outline-none focus:ring-2 focus:ring-[#e50914]/70 dark:border-white/10 dark:bg-slate-900/70 dark:text-gray-100"
              >
                {#each Object.entries(sortLabels) as [value, label]}
                  <option {value}>{label}</option>
                {/each}
              </select>
              <span class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-gray-600 dark:text-gray-300">▾</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
  <div>
    <div id="catalog" class="container mx-auto px-6 py-10 tv-main mt-2">
      <div bind:this={gridEl} class="grid auto-fit-grid gap-6">
        {#if $visibleContent.length === 0}
          <div class="col-span-full text-center text-gray-400 py-8">{m.tv_noResults()}</div>
        {:else}
          {#each $sortedAllContent as item, i (item.type + ':' + item.id)}
            <div class:hidden={!$visibleKeys.has(item.type + ':' + item.id)} class="w-full">
              <ContentCard
                {item}
                isSelected={!!($selectedContent && $selectedContent.id === item.id && $selectedContent.type === item.type)}
                onSelect={handleSelect}
                {isMobile}
                priority={priorityKeys.has(item.type + ':' + item.id)}
              />
            </div>
          {/each}
        {/if}
      </div>
    </div>
    <div class="hidden md:flex w-[460px] border-l border-gray-700/50 px-6 pt-14 pb-6 fixed right-0 top-0 bottom-0 overflow-hidden flex-col bg-gradient-to-b from-[#0f172a]/60 to-[#0f172a]/20 dark:from-gray-900/60 dark:to-gray-900/20 backdrop-blur-xl">
  <SidebarDetails selected={$selectedContent} openContent={handleOpenContent} openExternal={openExternalContent} onOpenEpisode={handleOpenEpisode} onSelectEpisode={handleSelectEpisode} selectedEpisode={$selectedEpisode} initialSeason={initialSeasonNumber ?? undefined} {isMobile} />
    </div>
    <MobileDetailsOverlay show={$showDetailsPanel} {isMobile} selected={$selectedContent} openContent={handleOpenContent} openExternal={openExternalContent} onOpenEpisode={handleOpenEpisode} onSelectEpisode={handleSelectEpisode} selectedEpisode={$selectedEpisode} {closeDetailsPanel} initialSeason={initialSeasonNumber ?? undefined} />
  </div>
</div>
<PlayerModal show={$showPlayer} selected={$selectedContent} selectedEpisode={$selectedEpisode} close={closePlayer} />

<style>
  .hero-gradient {
    position: absolute;
    inset: 0;
    background: linear-gradient(150deg, #050712 5%, #0c1430 45%, #1a233e 100%);
    opacity: 0.98;
  }
  .hero-glow {
    position: absolute;
    border-radius: 9999px;
    filter: blur(120px);
    opacity: 0.7;
    mix-blend-mode: screen;
    animation: heroGlow 14s ease-in-out infinite alternate;
  }
  .hero-logo-stack {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    margin-top: -4rem;
  }
  .hero-logo-text {
    font-family: 'Bebas Neue', 'Anton', 'Archivo Black', sans-serif;
    font-size: clamp(2.5rem, 6vw, 4.75rem);
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-align: center;
    line-height: 0.86;
    margin-bottom: 6rem;
  }
  .hero-logo-text > span {
    display: inline-block;
    color: #e63b28;
    font-weight: 800;
    transform: perspective(100px) rotateX(31deg) scaleX(1.04);
    transform-origin: center top;
    filter: saturate(110%) contrast(110%);
    text-shadow: 0 12px 30px rgba(0, 0, 0, 0.55);
  }
  @media (max-width: 479px) {
    .hero-logo-text { font-size: clamp(2rem, 12vw, 3.6rem); letter-spacing: 0.12em; }
  }
  .hero-glow--one {
    top: -28%;
    right: 12%;
    width: 420px;
    height: 420px;
    background: radial-gradient(circle at center, rgba(229, 9, 20, 0.7), rgba(229, 9, 20, 0));
    animation-delay: -3s;
  }
  .hero-glow--two {
    bottom: -30%;
    left: 6%;
    width: 520px;
    height: 520px;
    background: radial-gradient(circle at center, rgba(59, 130, 246, 0.55), rgba(59, 130, 246, 0));
    animation-delay: -8s;
  }
  .hero-grid {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(to right, rgba(255, 255, 255, 0.08) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
    background-size: 140px 140px;
    mask-image: radial-gradient(circle at 40% 30%, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0) 70%);
    opacity: 0.55;
  }
  .hero-noise {
    position: absolute;
    inset: -10px;
    background-image: url('data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" preserveAspectRatio="none"%3E%3Cfilter id="n" x="0" y="0" width="1" height="1"%3E%3CfeTurbulence baseFrequency="0.9" numOctaves="3" stitchTiles="stitch" type="fractalNoise"/%3E%3CfeColorMatrix type="saturate" values="0"/%3E%3C/filter%3E%3Crect width="200" height="200" filter="url(%23n)" opacity="0.22"/%3E%3C/svg%3E');
    background-size: 260px;
    opacity: 0.22;
    mix-blend-mode: soft-light;
    pointer-events: none;
  }
  .hero-logo-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    transition: transform 200ms ease, filter 200ms ease;
  }
  .hero-logo-link:hover { transform: scale(1.03); filter: drop-shadow(0 25px 60px rgba(229, 9, 20, 0.45)); }
  .hero-logo-link:focus-visible {
    outline: 2px solid rgba(255, 255, 255, 0.85);
    outline-offset: 8px;
  }
  :global(.hero-logo) {
    height: 118px;
    width: auto;
    filter: drop-shadow(0 25px 55px rgba(0, 0, 0, 0.5));
  }
  @media (min-width: 768px) {
    :global(.hero-logo) { height: 180px; }
  }
  .hero-title-gradient {
    background-image: linear-gradient(120deg, rgba(255, 255, 255, 0.95), rgba(229, 9, 20, 0.95) 45%, rgba(244, 114, 182, 0.95) 90%);
    background-clip: text;
    -webkit-background-clip: text;
    color: transparent;
  }
  .page-backdrop {
    position: absolute;
    inset: 0;
    z-index: -30;
    pointer-events: none;
    overflow: hidden;
  }
  .hero-gradient--page,
  .hero-grid--page,
  .hero-noise--page,
  .hero-glow--page {
    height: 100%;
  }
  .hero-gradient--page { opacity: 1; }
  .hero-grid--page {
    opacity: 0.5;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 0.92) 0%, rgba(0, 0, 0, 0.85) 30%, rgba(0, 0, 0, 0.6) 65%, rgba(0, 0, 0, 0.2) 100%);
  }
  .hero-noise--page {
    opacity: 0.26;
  }
  .hero-glow--page {
    filter: blur(160px);
    opacity: 0.72;
    animation-duration: 20s;
  }
  .hero-overlay {
    position: absolute;
    inset: 0;
    z-index: -5;
    pointer-events: none;
    background: radial-gradient(circle at 40% 20%, rgba(229, 9, 20, 0.34), transparent 55%),
      radial-gradient(circle at 70% 10%, rgba(59, 130, 246, 0.28), transparent 60%),
      linear-gradient(180deg, rgba(5, 7, 18, 0.05) 0%, rgba(5, 7, 18, 0.85) 100%);
    mix-blend-mode: screen;
    mask-image: linear-gradient(180deg, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.85) 70%, rgba(0, 0, 0, 0) 100%);
  }
  @keyframes heroGlow {
    from { transform: translate3d(-12px, -10px, 0) scale(0.96); opacity: 0.68; }
    to { transform: translate3d(16px, 18px, 0) scale(1.04); opacity: 0.85; }
  }
  /* Only apply hover effects on non-mobile devices */
  @media (min-width: 768px) {
    .tv-page :global(.group:hover img) { filter: brightness(1.05); }
  }
  .auto-fit-grid {
    --card-max: 220px;
    grid-template-columns: repeat(auto-fill, minmax(180px, var(--card-max)));
    justify-content: center;
    justify-items: center;
  }
  .auto-fit-grid > * { width: 100%; max-width: var(--card-max); }
  @media (max-width: 767px) {
    .auto-fit-grid {
      --card-min: 120px;
      --card-max: 165px;
      grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
      justify-content: center;
    }
    .auto-fit-grid > * { max-width: var(--card-max); }
  }
  @media (min-width: 768px) {
    .tv-page { margin-left: auto; margin-right: auto; }
    .tv-page .container { max-width: 100%; width: 100%; }
    .tv-page .tv-main { width: 100%; }
  }
  :global(.tv-layout main) { max-width: 100vw; padding: 0 1rem 0 0; margin: 1rem auto; }
  .auto-fit-grid :global([role="button"][tabindex="0"]:focus:not(:focus-visible)) { outline: none; box-shadow: none; }
  .auto-fit-grid :global([role="button"][tabindex="0"]:focus-visible) { outline: none; border: none; }
</style>
