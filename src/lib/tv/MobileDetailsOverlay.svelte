<script lang="ts">
  import { fade } from 'svelte/transition';
  import { isImage, isInlinePlayable } from './utils';
  import type { ContentItem, Episode } from './types';
  import * as m from '$lib/paraglide/messages';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import Link2Icon from '@lucide/svelte/icons/link-2';
  import CheckIcon from '@lucide/svelte/icons/check';
  import XIcon from '@lucide/svelte/icons/x';
  import { getUrlForItem, getEpisodeUrl } from './slug';
  import { Image } from '@unpic/svelte';
  import { dev } from '$app/environment';
  import { blurhashToCssGradientString } from '@unpic/placeholder';
  import { posterBlurhash } from '$lib/assets/blurhash';
  import { decode } from 'html-entities';
  import { getWatchProgress, setWatchedStatus } from '$lib/tv/watchHistory';
  import { onMount } from 'svelte';

  export let show = false;
  export let isMobile = false;
  export let selected: ContentItem | null = null;
  export let closeDetailsPanel: () => void;
  export let openContent: (c: ContentItem) => void;
  export let openExternal: (c: ContentItem) => void;
  export let initialSeason: number | undefined;
  // Callback to play a specific episode (id, title)
  export let onOpenEpisode: (videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) => void;
  // Select an episode without playing
  export let onSelectEpisode: (videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) => void;
  // Currently selected episode (for highlighting)
  export let selectedEpisode: Episode | null = null;
  export let onBack: (() => void) | null = null;
  
  function handleBack() {
    if (onBack) {
      onBack();
    } else {
      closeDetailsPanel();
    }
  }

  // Watch progress tracking
  let watchProgress: { percent: number; isWatched: boolean; position: number } | null = null;
  
  function updateWatchProgress() {
    if (!browser || !selected) return;
    const mediaId = `${selected.type}:${selected.id}`;
    const progress = getWatchProgress(mediaId);
    if (progress) {
      watchProgress = { 
        percent: progress.percent, 
        isWatched: progress.isWatched,
        position: progress.position 
      };
    } else {
      watchProgress = null;
    }
  }

  function toggleWatchedStatus() {
    if (!browser || !selected) return;
    const mediaId = `${selected.type}:${selected.id}`;
    const newStatus = !watchProgress?.isWatched;
    setWatchedStatus(mediaId, selected.type, newStatus);
    updateWatchProgress();
    toast.message(newStatus ? 'Marked as watched' : 'Marked as unwatched');
  }

  function formatTime(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  $: if (selected) {
    updateWatchProgress();
  }

  let progressPollInterval: ReturnType<typeof setInterval> | null = null;
  let isPolling = false;

  // Start/stop polling based on whether overlay is visible and has selection
  $: if (browser && show && selected) {
    // Start polling if not already running
    if (!isPolling) {
      isPolling = true;
      progressPollInterval = setInterval(updateWatchProgress, 2000);
    }
  } else {
    // Stop polling when overlay hidden or no selection
    if (isPolling && progressPollInterval) {
      clearInterval(progressPollInterval);
      progressPollInterval = null;
      isPolling = false;
    }
  }

  onMount(() => {
    updateWatchProgress();
    // Update when localStorage changes (from other tabs or components)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'jumpflix-watch-history' || e.key === null) {
        updateWatchProgress();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      if (progressPollInterval) {
        clearInterval(progressPollInterval);
        progressPollInterval = null;
        isPolling = false;
      }
    };
  });

  $: hasProgress = watchProgress && watchProgress.percent > 0 && !watchProgress.isWatched;

  // Seasons & Episodes for series (fetched via API to avoid CORS)
  let episodes: Episode[] = [];
  let loadingEpisodes = false;
  let selectedSeason = 1;
  let episodesListEl: HTMLUListElement | null = null;
  $: if (typeof initialSeason === 'number' && Number.isFinite(initialSeason)) {
    selectedSeason = Math.max(1, Math.floor(initialSeason));
  }
  // Always work with a numeric season internally (select returns strings)
  $: selectedSeasonNum = Number.isFinite(Number(selectedSeason)) ? Math.max(1, Number(selectedSeason)) : 1;
  // Abort/race handling for fetches when switching series quickly
  let _episodesController: AbortController | null = null;
  let _episodesFetchVersion = 0;
  $: playlistId = selected?.type === 'series'
    ? (selected as any).seasons?.find((s: any) => s.seasonNumber === selectedSeasonNum)?.playlistId as string | undefined
    : undefined;
  // Fetch when playlistId changes
  $: if (browser && playlistId && show) {
    // start fresh load and cancel any in-flight request
    loadingEpisodes = true;
    episodes = [];
    _episodesController?.abort();
    _episodesController = new AbortController();
    const version = ++_episodesFetchVersion;
    const timeoutId = setTimeout(() => { try { _episodesController?.abort(); } catch {} }, 10000);
    fetch(`/api/series/${encodeURIComponent(playlistId)}/episodes`, { signal: _episodesController.signal })
      .then((r) => r.json())
      .then((data) => {
        if (version === _episodesFetchVersion) {
          episodes = data.episodes || [];
        }
      })
      .catch((err) => {
        // Ignore AbortError; for other errors, clear episodes
        if (err?.name !== 'AbortError' && version === _episodesFetchVersion) {
          episodes = [];
        }
      })
      .finally(() => {
        clearTimeout(timeoutId);
        if (version === _episodesFetchVersion) {
          loadingEpisodes = false;
        }
      });
  } else {
    // Not a series or missing playlist id
    _episodesController?.abort();
    _episodesController = null;
    episodes = [];
    loadingEpisodes = false;
  }
  // Default-select first episode if none selected or selection not in list
  // IMPORTANT: Defer the write to avoid updating a store inside an effect that reads it (prevents update-depth loops)
  // Context: Switching between series updates `selected` and the fetched `episodes` list.
  // If we synchronously call `onSelectEpisode`, the upstream store changes in the same
  // reactive turn and can re-trigger this effect repeatedly. Deferring breaks the cycle.
  $: if (browser && episodes && episodes.length > 0) {
    const cur = selectedEpisode?.id;
    const exists = cur && episodes.some(e => e.id === cur);
    if (!cur) {
      Promise.resolve().then(() => onSelectEpisode(episodes[0].id, episodes[0].title, episodes[0].position || 1, selectedSeasonNum));
    } else if (cur?.startsWith?.('pos:')) {
      const pos = Number(cur.split(':')[1] || '1');
      const found = episodes.find(e => (e.position || 0) === pos) || episodes[0];
      Promise.resolve().then(() => onSelectEpisode(found.id, found.title, found.position || 1, selectedSeasonNum));
    } else if (!exists) {
      Promise.resolve().then(() => onSelectEpisode(episodes[0].id, episodes[0].title, episodes[0].position || 1, selectedSeasonNum));
    }
  }

  // BlurHash placeholder background for selected thumbnail
  $: blurhash = selected?.blurhash || (selected?.thumbnail ? posterBlurhash[selected.thumbnail] : undefined);
  $: background = blurhash ? blurhashToCssGradientString(blurhash) : undefined;

  async function copyLink() {
    if (!selected) return;
    let path = getUrlForItem(selected);
    if (selected.type === 'series' && selectedEpisode?.id) {
      const epNum = selectedEpisode.position && Number.isFinite(selectedEpisode.position)
        ? Math.max(1, Math.floor(selectedEpisode.position))
        : null;
      if (epNum) path = getEpisodeUrl(selected as any, { episodeNumber: epNum, seasonNumber: selectedSeasonNum });
      else {
        const params = new URLSearchParams();
        params.set('ep', selectedEpisode.id);
        path = `${path}?${params.toString()}`;
      }
    }
    const url = browser ? new URL(path, window.location.origin).toString() : path;
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const el = document.createElement('textarea');
        el.value = url;
        el.setAttribute('readonly', '');
        el.style.position = 'absolute';
        el.style.left = '-9999px';
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
      toast.message('Link copied');
    } catch (e) {
      if (browser) window.history.pushState({}, '', url);
    }
  }

  const overlayClass = 'mobile-overlay-surface';
  const headerClass = 'mobile-overlay-header';
  const actionsClass = 'mobile-overlay-actions';
</script>

{#if isMobile && show && selected}
  <div class={overlayClass} transition:fade>
    <div class="flex-1 overflow-y-auto">
      <div class={headerClass}>
  <button on:click={handleBack} class="flex items-center gap-2 text-sm font-medium text-white px-3 py-2 rounded-lg bg-white/10 hover:bg-white/20">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          { m.tv_back() }
        </button>
  <h2 class="text-base line-clamp-2 pr-2 pl-2 text-white" style="margin:0;font-size:.9em!important;">{selected.title}</h2>
      </div>
      <div class="relative">
        <!-- BlurHash placeholder layer for hero -->
        {#if background}
          <div class="absolute inset-0" style:background-image={background} style:background-size="cover" style:background-position="center"></div>
        {/if}
        {#if isImage(selected.thumbnail)}
          <Image src={selected.thumbnail} alt={selected.title + ' background'} class="w-full h-72 object-cover opacity-60" layout="fullWidth" aspectRatio={2/3} sizes="100vw" cdn={dev ? undefined : 'netlify'} />
        {/if}
  <div class="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-black/10"></div>
        <div class="absolute bottom-4 left-4 right-4">
          <h1 class="mb-2 text-white font-light" style="font-size:2em!important;font-family: 'Merriweather', serif;">{selected.title}</h1>
          <div class="flex flex-wrap items-center gap-2 text-xs text-gray-300 mb-3">
            {#if selected.type === 'movie'}
              <span class="bg-blue-600 px-2 py-1 rounded text-white">MOVIE</span>
              {#if selected.paid}<span class="bg-yellow-400 text-black px-2 py-1 rounded font-bold">PAID</span>{/if}
              <span>{(selected as any).year}</span>
              <span>{(selected as any).duration}</span>
            {:else}
              <span class="bg-red-600 px-2 py-1 rounded">SERIES</span>
              <span>{(selected as any).videoCount || '?'} episodes</span>
            {/if}
            {#if selected.type === 'movie' && (selected as any).trakt}
              <a href={(selected as any).trakt} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center w-6 h-6 mx-1 focus:outline-none focus:ring-2 focus:ring-[#ED1C24] focus:ring-offset-2 focus:ring-offset-black rounded transition active:scale-95 hover:scale-105" aria-label="View on Trakt" title="Trakt">
                <img src="https://trakt.tv/assets/logos/logomark.square.gradient-b644b16c38ff775861b4b1f58c1230f6a097a2466ab33ae00445a505c33fcb91.svg" alt="" class="w-full h-full select-none" loading="lazy" decoding="async" />
                <span class="sr-only">Trakt</span>
              </a>
            {/if}
            <!-- Shareable URL: icon-only copy button -->
            <button type="button" class="inline-flex items-center justify-center w-7 h-7 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" on:click={copyLink} title="Copy link" aria-label="Copy link">
              <Link2Icon class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
  <div class="px-4 pb-28 pt-4 space-y-6 mobile-overlay-content">
        <div>
          <p class="text-gray-200 text-sm leading-relaxed">{selected.description}</p>
        </div>

        <!-- Watch Progress Bar -->
        {#if hasProgress}
          <div class="relative w-full">
            <div class="h-1.5 bg-gray-700/60 rounded-full overflow-hidden">
              <div class="h-full bg-red-500 transition-all duration-300" style:width="{watchProgress?.percent || 0}%"></div>
            </div>
            <div class="text-xs text-gray-400 mt-1.5 flex justify-between items-center">
              <span>Progress: {Math.round(watchProgress?.percent || 0)}%</span>
              {#if watchProgress?.position}
                <span>Resume at {formatTime(watchProgress.position)}</span>
              {/if}
            </div>
          </div>
        {/if}

        <!-- Watch Status Toggle -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all {watchProgress?.isWatched ? 'bg-green-700/20 text-green-400 active:bg-green-700/30 border border-green-600/40' : 'bg-gray-700/40 text-gray-300 active:bg-gray-700/60 border border-gray-600/40'}"
            on:click={toggleWatchedStatus}
            title={watchProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched'}
          >
            {#if watchProgress?.isWatched}
              <CheckIcon class="w-4 h-4" />
              <span>Watched</span>
            {:else}
              <XIcon class="w-4 h-4" />
              <span>Mark as watched</span>
            {/if}
          </button>
        </div>

        {#if selected.type === 'movie'}
          <div>
            <ul class="text-xs text-gray-300 space-y-1" style="padding-left:0;">
              {#if selected.paid}
                <li class="flex justify-between"><span class="text-gray-400">Provider</span><span>{selected.provider || 'External'}</span></li>
              {/if}
              {#if (selected as any).creators?.length}
                <li class="flex flex-col gap-1"><span class="text-gray-400">Creators</span><span>{(selected as any).creators.join(', ')}</span></li>
              {/if}
              {#if (selected as any).starring?.length}
                <li class="flex flex-col gap-1"><span class="text-gray-400">Starring</span><span>{(selected as any).starring.join(', ')}</span></li>
              {/if}
            </ul>
          </div>
        {:else}
          <div>
            <ul class="text-xs text-gray-300 space-y-1" style="padding-left:0;">
              {#if (selected as any).creators?.length}
                <li class="flex flex-col"><span class="text-gray-400">Creators</span><span>{(selected as any).creators.join(', ')}</span></li>
              {/if}
              {#if (selected as any).starring?.length}
                <li class="flex flex-col gap-1"><span class="text-gray-400">Starring</span><span>{(selected as any).starring.join(', ')}</span></li>
              {/if}
            </ul>
            <div class="mt-4">
              <h3 class="text-base font-semibold text-gray-200 mb-3">{m.tv_episodes()}</h3>
              {#if (selected as any).seasons?.length > 0}
                <div class="mb-3">
                  <select
                    id="mobile-season-select"
                    class="w-full bg-transparent border rounded px-3 py-2 text-sm"
                    bind:value={selectedSeason}
                    disabled={(selected as any).seasons?.length <= 1}
                    on:change={(e) => { const next = Number((e.currentTarget as HTMLSelectElement).value); selectedSeason = next; /* triggers reactive fetch */ onSelectEpisode('pos:1', 'Episode 1', 1, Number.isFinite(next) ? Math.max(1, next) : 1); Promise.resolve().then(() => { try { episodesListEl?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} }); }}
                  >
                    {#each (selected as any).seasons as s}
                      <option value={s.seasonNumber}>Season {s.seasonNumber}</option>
                    {/each}
                  </select>
                </div>
              {/if}
              {#if loadingEpisodes}
                <p class="text-gray-400 text-sm">Loading episodes…</p>
              {:else if episodes.length === 0}
                <p class="text-gray-400 text-sm">No episodes found.</p>
              {:else}
                <ul class="space-y-2 max-h-64 overflow-auto pr-1" bind:this={episodesListEl}>
                  {#each episodes as ep}
                    <li>
                      <button type="button" class="w-full flex items-center gap-3 p-1.5 rounded hover:bg-white/10 transition text-left outline-none border-2 border-transparent focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 {selectedEpisode && selectedEpisode.id === ep.id ? 'bg-red-900/30 border-2 border-red-500/60' : ''}"
                        on:click={() => onSelectEpisode(ep.id, decode(ep.title), ep.position, selectedSeasonNum)}>
                        <div class="relative w-24 h-14 flex-shrink-0 overflow-hidden rounded">
                          {#if ep.thumbnail}
                            <img src={ep.thumbnail} alt={decode(ep.title)} class="w-full h-full object-cover" loading="lazy" decoding="async" />
                          {:else}
                            <div class="w-full h-full bg-gray-700"></div>
                          {/if}
                        </div>
                        <div class="flex-1 min-w-0">
                          <div class="text-[13px] text-gray-400">Ep {ep.position}</div>
                          <div class="text-base text-gray-100 truncate">{decode(ep.title)}</div>
                        </div>
                        
                      </button>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    </div>
  <div class={actionsClass}>
      <button on:click={() => {
        if (selected?.type === 'series' && selectedEpisode) { onOpenEpisode(selectedEpisode.id, decode(selectedEpisode.title), selectedEpisode.position || 1, selectedSeason); return; }
        if (isInlinePlayable(selected)) openContent(selected);
        else if (selected?.externalUrl) openExternal(selected);
  }} class="w-full bg-blue-600/90 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>
        {#if selected?.type === 'series'}
          {#if selectedEpisode}
            {m.tv_playSelectedEpisode()}
          {:else}
            Play series
          {/if}
        {:else}
          {#if isInlinePlayable(selected)}
            {#if hasProgress}
              Continue watching
            {:else}
              { m.tv_playNow() }
            {/if}
          {:else}
            { m.tv_watchOn() } {selected?.provider || 'External'}
          {/if}
        {/if}
      </button>
    </div>
  </div>
{/if}

<style>
  .mobile-overlay-surface {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: flex;
    flex-direction: column;
    background: linear-gradient(180deg, #050712, #0a1023);
    backdrop-filter: none;
  }

  .mobile-overlay-header {
    position: sticky;
    top: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.85rem 1rem;
    background: linear-gradient(185deg, #050712, #0a1023);
    border-color: rgba(71, 85, 105, 0.38);
  }

  .mobile-overlay-actions {
    padding: 1rem;
    padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
    background: linear-gradient(180deg, #050712, #0a1023);
    border-color: rgba(71, 85, 105, 0.4);
  }

  .mobile-overlay-content {
    padding-bottom: calc(7rem + env(safe-area-inset-bottom, 0px));
  }
</style>
