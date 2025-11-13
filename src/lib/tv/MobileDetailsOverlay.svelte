<script lang="ts">
  import { fade } from 'svelte/transition';
  import { isImage, isInlinePlayable } from './utils';
  import type { ContentItem, Episode } from './types';
  import * as m from '$lib/paraglide/messages';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import Link2Icon from '@lucide/svelte/icons/link-2';
  import CheckIcon from '@lucide/svelte/icons/check';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import { getUrlForItem, getEpisodeUrl } from './slug';
  import { Image } from '@unpic/svelte';
  import { dev } from '$app/environment';
  import { blurhashToCssGradientString } from '@unpic/placeholder';
  import { decode } from 'html-entities';
  import { selectEpisode as updateSelectedEpisode } from '$lib/tv/store';
  import {
    getAllWatchProgress,
    setWatchedStatus,
    PROGRESS_CHANGE_EVENT
  } from '$lib/tv/watchHistory';
  import { flushWatchHistoryNow } from '$lib/tv/watchHistory';
  import type { WatchProgress } from '$lib/tv/watchHistory';
  import { onMount } from 'svelte';
  import { user as authUser } from '$lib/stores/authStore';
  import BangerMeter from '$lib/components/Bangerometer.svelte';
  import { getUserRating, saveRating, getMediaRatingSummary } from '$lib/ratings';
  import AuthDialog from '$lib/components/AuthDialog.svelte';
  import FacetChips from '$lib/components/FacetChips.svelte';

  let isAuthenticated = false;

  $: isAuthenticated = Boolean($authUser);

  // Rating state
  let currentUserRating: number | null = null;
  let ratingsSummary: { averageRating: number; ratingCount: number } | null = null;
  let showAuthDialog = false;

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
  let watchProgressMap: Map<string, WatchProgress> = new Map();

  function refreshWatchProgressMap() {
    if (!browser) {
      watchProgressMap = new Map();
      return;
    }
    const entries = getAllWatchProgress();
    const next = new Map<string, WatchProgress>();
    for (const entry of entries) {
      next.set(entry.mediaId, entry);
    }
    watchProgressMap = next;
  }

  function buildBaseId(item: ContentItem | null): string | null {
    if (!item) return null;
    return `${item.type}:${item.id}`;
  }

  function parseWatchedAt(value: string | undefined | null): number {
    if (!value) return 0;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : 0;
  }

  function pickLatestProgress(current: WatchProgress | null, candidate: WatchProgress): WatchProgress {
    if (!current) return candidate;
    const currentTime = parseWatchedAt(current.watchedAt);
    const candidateTime = parseWatchedAt(candidate.watchedAt);
    if (candidateTime > currentTime) return candidate;
    if (candidateTime < currentTime) return current;
    return candidate.percent > current.percent ? candidate : current;
  }

  function getWatchProgressForSelected(): void {
    if (!browser || !selected) {
      watchProgress = null;
      watchProgressMap = new Map();
      return;
    }

    refreshWatchProgressMap();

    const baseId = buildBaseId(selected);
    if (!baseId) {
      watchProgress = null;
      return;
    }

    const candidateIds: string[] = [];

    if (selected.type === 'movie') {
      const movie = selected as any;
      if (movie.videoId) candidateIds.push(`${baseId}:yt:${movie.videoId}`);
      if (movie.vimeoId) candidateIds.push(`${baseId}:vimeo:${movie.vimeoId}`);
    }

    if (selected.type === 'series' && selectedEpisode?.id) {
      candidateIds.push(`${baseId}:ep:${selectedEpisode.id}`);
    }

    let progress: WatchProgress | null = null;
    for (const id of candidateIds) {
      progress = watchProgressMap.get(id) ?? null;
      if (progress) break;
    }

    if (!progress) {
      const basePrefix = `${baseId}:`;
      for (const entry of watchProgressMap.values()) {
        if (entry.mediaId === baseId || entry.mediaId.startsWith(basePrefix)) {
          progress = pickLatestProgress(progress, entry);
        }
      }
    }

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

  function getEpisodeWatchProgress(episodeId: string): { isWatched: boolean; percent: number } | null {
    if (!browser || !selected || selected.type !== 'series') return null;
    const baseId = buildBaseId(selected);
    if (!baseId) return null;
    
    const fullId = `${baseId}:ep:${episodeId}`;
    const progress = watchProgressMap.get(fullId);
    
    if (progress) {
      return {
        isWatched: progress.isWatched,
        percent: progress.percent
      };
    }
    return null;
  }

  function toggleEpisodeWatchedStatus(episodeId: string, event: Event) {
    event.stopPropagation(); // Prevent episode selection
    if (!browser || !selected || selected.type !== 'series' || !isAuthenticated) return;
    const baseId = buildBaseId(selected);
    if (!baseId) return;

    const fullId = `${baseId}:ep:${episodeId}`;
    const currentProgress = getEpisodeWatchProgress(episodeId);
    const newStatus = !currentProgress?.isWatched;

    setWatchedStatus(fullId, 'episode', newStatus);
  void flushWatchHistoryNow();
    
    // Force refresh by reassigning the map
    refreshWatchProgressMap();
    // Also update the selected progress
    getWatchProgressForSelected();
    
    // Force reactivity by creating a new episodes array reference
    episodes = [...episodes];
    
    toast.success(newStatus ? 'Episode marked as watched' : 'Episode marked as unwatched');
  }

  function toggleWatchedStatus() {
    if (!browser || !selected || selected.type !== 'movie' || !isAuthenticated) return;
    const baseId = buildBaseId(selected);
    if (!baseId) return;

    const preferredId = (() => {
      const movie = selected as any;
      if (movie.videoId) return `${baseId}:yt:${movie.videoId}`;
      if (movie.vimeoId) return `${baseId}:vimeo:${movie.vimeoId}`;
      return baseId;
    })();

    const newStatus = !watchProgress?.isWatched;
    setWatchedStatus(preferredId, 'movie', newStatus);
    void flushWatchHistoryNow();
    toast.success(newStatus ? 'Marked as watched' : 'Marked as unwatched');
  }

  onMount(() => {
    getWatchProgressForSelected();
    
    const handleProgressChange: EventListener = () => {
      getWatchProgressForSelected();
    };
    
    window.addEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);
    
    return () => {
      window.removeEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);
    };
  });

  $: if (browser && selected) {
    getWatchProgressForSelected();
    // Reset user rating immediately when item changes, then load actual data
    currentUserRating = null;
    // Use the rating data already available on the content item to prevent flashing
    ratingsSummary = selected.averageRating !== undefined && selected.ratingCount !== undefined
      ? { averageRating: selected.averageRating, ratingCount: selected.ratingCount }
      : null;
    loadRatingData();
  }

  async function loadRatingData() {
    if (!selected || !browser) {
      currentUserRating = null;
      return;
    }

    try {
      const [userRating, summary] = await Promise.all([
        getUserRating(selected.id),
        getMediaRatingSummary(selected.id)
      ]);
      currentUserRating = userRating;
      // Update with fresh data from the server
      ratingsSummary = summary;
    } catch (error) {
      console.error('Error loading rating data:', error);
    }
  }

  async function handleRatingChange(rating: number) {
    if (!selected) return;
    await saveRating(selected.id, rating);
    currentUserRating = rating;
    // Refresh summary to show updated average
    const summary = await getMediaRatingSummary(selected.id);
    ratingsSummary = summary;
  }

  function handleAuthRequired() {
    showAuthDialog = true;
  }

  $: if (browser && selectedEpisode) {
    getWatchProgressForSelected();
  }

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

  // Derive the fetch ID from selected series and season number
  let currentFetchId: string | undefined = undefined;
  $: {
    if (selected?.type === 'series') {
      const season = (selected as any).seasons?.find((s: any) => s.seasonNumber === selectedSeasonNum);
      if (season) {
        currentFetchId = season.playlistId || (season.id ? String(season.id) : undefined);
      } else {
        currentFetchId = undefined;
      }
    } else {
      currentFetchId = undefined;
    }
  }
  
  // Fetch when currentFetchId changes
  $: if (browser && currentFetchId && show) {
    // start fresh load and cancel any in-flight request
    loadingEpisodes = true;
    episodes = [];
    _episodesController?.abort();
    _episodesController = new AbortController();
    const version = ++_episodesFetchVersion;
    const fetchId = currentFetchId; // Capture in closure to avoid race conditions
    const timeoutId = setTimeout(() => { try { _episodesController?.abort(); } catch {} }, 10000);
    fetch(`/api/series/${encodeURIComponent(fetchId)}/episodes`, { signal: _episodesController.signal })
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
    const curId = selectedEpisode?.id ?? null;
    const exists = curId ? episodes.some((ep) => ep.id === curId) : false;

    if (!curId) {
      const first = episodes[0];
      Promise.resolve().then(() => onSelectEpisode(first.id, first.title, first.position || 1, selectedSeasonNum));
    } else if (curId.startsWith?.('pos:')) {
      const pos = Number(curId.split(':')[1] || '1');
      const found = episodes.find((ep) => (ep.position || 0) === pos) || episodes[0];
      Promise.resolve().then(() => onSelectEpisode(found.id, found.title, found.position || 1, selectedSeasonNum));
    } else if (!exists) {
      const first = episodes[0];
      Promise.resolve().then(() => onSelectEpisode(first.id, first.title, first.position || 1, selectedSeasonNum));
    }

    if (curId) {
      const match = episodes.find((ep) => ep.id === curId);
      if (match) {
        const hydratedTitle = match.title ? decode(match.title) : `Episode ${match.position ?? ''}`.trim();
        const hydrated: Episode = {
          ...match,
          title: hydratedTitle
        };
        updateSelectedEpisode(hydrated);
      }
    }
  }

  // BlurHash placeholder background for selected thumbnail
  $: blurhash = selected?.blurhash;
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
              <span>{(selected as any).episodeCount || '?'} episodes</span>
            {/if}
            {#if (selected as any).trakt}
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

        <!-- Facet Tags -->
        {#if selected.facets}
          <div>
            <FacetChips facets={selected.facets} />
          </div>
        {/if}

        <!-- Bangerometer Rating Component -->
        <div>
          <BangerMeter
            mediaId={selected.id}
            initialRating={currentUserRating}
            onRatingChange={handleRatingChange}
            onAuthRequired={handleAuthRequired}
            isWatched={watchProgress?.isWatched || false}
            averageRating={ratingsSummary?.averageRating || 0}
            ratingCount={ratingsSummary?.ratingCount || 0}
          />
        </div>

        <!-- Watch Progress Toggle (Movies only) -->
        {#if isAuthenticated && selected.type === 'movie'}
          <div>
            <button
              type="button"
              on:click={toggleWatchedStatus}
              class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 {watchProgress?.isWatched ? 'bg-green-600/20 text-green-400 border border-green-600/50 active:bg-green-600/30 focus-visible:ring-green-500' : 'bg-gray-700/50 text-gray-300 border border-gray-600/50 active:bg-gray-700 focus-visible:ring-gray-500'}"
            >
              {#if watchProgress?.isWatched}
                <CheckIcon class="w-4 h-4" />
                <span>{m.tv_markUnwatched()}</span>
              {:else}
                <EyeIcon class="w-4 h-4" />
                <span>{m.tv_markWatched()}</span>
              {/if}
            </button>
            {#if watchProgress && watchProgress.percent > 0 && watchProgress.percent < 85}
              <div class="mt-3 space-y-1">
                <div class="flex justify-between text-xs text-gray-400">
                  <span>Progress</span>
                  <span>{Math.round(watchProgress.percent)}%</span>
                </div>
                <div class="w-full h-2 bg-gray-700/50 rounded-full overflow-hidden">
                  <div 
                    class="h-full bg-red-500 transition-all duration-300 rounded-full" 
                    style:width="{watchProgress.percent}%"
                  ></div>
                </div>
              </div>
            {/if}
          </div>
        {/if}

        {#if selected.type === 'movie'}
          <div>
            <ul class="text-xs text-gray-300 space-y-3" style="padding-left:0;">
              {#if selected.paid}
                <li class="flex flex-col gap-1"><span class="text-gray-400">Provider</span><span>{selected.provider || 'External'}</span></li>
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
            <ul class="text-xs text-gray-300 space-y-3" style="padding-left:0;">
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
                    on:change={(e) => {
                      const next = Number((e.currentTarget as HTMLSelectElement).value);
                      selectedSeason = next; /* triggers reactive fetch */
                      const seasonForUrl = Number.isFinite(next) ? Math.max(1, next) : 1;
                      Promise.resolve().then(() => onSelectEpisode('pos:1', 'Episode 1', 1, seasonForUrl));
                      Promise.resolve().then(() => { try { episodesListEl?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} });
                    }}
                  >
                    {#each (selected as any).seasons as s}
                      <option value={s.seasonNumber}>
                        {s.customName || `Season ${s.seasonNumber}`}
                      </option>
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
                    {@const epProgress = getEpisodeWatchProgress(ep.id)}
                    <li class="overflow-hidden">
                      <div class="flex items-center gap-2 overflow-hidden">
                        <button type="button" class="flex-1 flex items-center gap-3 p-1.5 rounded hover:bg-white/10 transition text-left outline-none border-2 border-transparent focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 overflow-hidden min-w-0 {selectedEpisode && selectedEpisode.id === ep.id ? 'bg-red-900/30 border-2 border-red-500/60' : ''}"
                          on:click={() => onSelectEpisode(ep.id, decode(ep.title), ep.position, selectedSeasonNum)}>
                          <div class="relative w-24 h-14 flex-shrink-0 overflow-hidden rounded">
                            {#if ep.thumbnail}
                              <img src={ep.thumbnail} alt={decode(ep.title)} class="w-full h-full object-cover {epProgress?.isWatched ? 'opacity-30' : ''}" loading="lazy" decoding="async" />
                            {:else}
                              <div class="w-full h-full bg-gray-700"></div>
                            {/if}
                            {#if epProgress?.isWatched}
                              <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
                                <CheckIcon class="w-6 h-6 text-green-400" />
                              </div>
                            {/if}
                            {#if epProgress && epProgress.percent > 0}
                              <div class="absolute bottom-0 left-0 right-0 h-1 bg-gray-700/80">
                                <div class="h-full bg-red-500 transition-all duration-300" style:width="{epProgress.percent}%"></div>
                              </div>
                            {/if}
                          </div>
                          <div class="flex-1 min-w-0 overflow-hidden">
                            <div class="text-[13px] text-gray-400">Ep {ep.position}</div>
                            <div class="text-base text-gray-100 truncate">{decode(ep.title)}</div>
                          </div>
                        </button>
                        {#if isAuthenticated}
                          <button
                            type="button"
                            on:click={(e) => toggleEpisodeWatchedStatus(ep.id, e)}
                            class="flex-shrink-0 p-2 rounded-lg transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 text-gray-500 active:text-gray-400 focus-visible:ring-gray-500"
                            title={epProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                            aria-label={epProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                          >
                            {#if epProgress?.isWatched}
                              <EyeOffIcon class="w-6 h-6" />
                            {:else}
                              <EyeIcon class="w-6 h-6" />
                            {/if}
                          </button>
                        {/if}
                      </div>
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
        if (selected?.type === 'series' && selectedEpisode) { 
          // Check if episode has external URL (for paid content not on YouTube)
          if (selectedEpisode.externalUrl) {
            if (browser) window.open(selectedEpisode.externalUrl, '_blank');
            return;
          }
  onOpenEpisode(selectedEpisode.id, decode(selectedEpisode.title), selectedEpisode.position || 1, selectedSeasonNum); 
          return; 
        }
        if (isInlinePlayable(selected)) openContent(selected);
        else if (selected?.externalUrl) openExternal(selected);
  }} class="w-full bg-blue-600/90 hover:bg-blue-600 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
        <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>
        {#if selected?.type === 'series'}
          {#if selectedEpisode}
            {#if selectedEpisode.externalUrl}
              { m.tv_watchOn() } {selected?.provider || 'External'}
            {:else}
              {m.tv_playSelectedEpisode()}
            {/if}
          {:else}
            Play series
          {/if}
        {:else}
          {#if isInlinePlayable(selected)}
            { m.tv_playNow() }
          {:else}
            { m.tv_watchOn() } {selected?.provider || 'External'}
          {/if}
        {/if}
      </button>
    </div>
  </div>
{/if}

<!-- Auth Dialog for non-authenticated users -->
<AuthDialog bind:open={showAuthDialog} />

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
