<script lang="ts">
  import type { ContentItem, Episode } from './types';
  import { isInlinePlayable } from './utils';
  import { getUrlForItem, getEpisodeUrl } from './slug';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import * as Select from "$lib/components/ui/select/index.js";
  import Link2Icon from '@lucide/svelte/icons/link-2';
  import CheckIcon from '@lucide/svelte/icons/check';
  import EyeIcon from '@lucide/svelte/icons/eye';
  import EyeOffIcon from '@lucide/svelte/icons/eye-off';
  import * as m from '$lib/paraglide/messages';  
  import { blurhashToCssGradientString } from '@unpic/placeholder';
  import { fade } from 'svelte/transition';
  import { decode } from 'html-entities';
  import { showPlayer, selectEpisode as updateSelectedEpisode } from '$lib/tv/store';
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
  import { getUserRating, saveRating, getMediaRatingSummary, deleteRating } from '$lib/ratings';
  import AuthDialog from '$lib/components/AuthDialog.svelte';
  import FacetChips from '$lib/components/FacetChips.svelte';
  import {
    dispatchRatingUpdated,
    RATING_UPDATED_EVENT,
    type RatingUpdatedDetail
  } from '$lib/rating-events';

  let isAuthenticated = false;

  $: isAuthenticated = Boolean($authUser);
  
  // Rating state
  let currentUserRating: number | null = null;
  let ratingsSummary: { averageRating: number; ratingCount: number } | null = null;
  let showAuthDialog = false;

  export let selected: ContentItem | null;
  export let openContent: (c: ContentItem) => void;
  export let openExternal: (c: ContentItem) => void;
  export let initialSeason: number | undefined;
  // Callback to play a specific episode (id, title)
  export let onOpenEpisode: (videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) => void;
  // Select an episode without playing
  export let onSelectEpisode: (videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) => void;
  // Currently selected episode (for highlighting)
  export let selectedEpisode: Episode | null = null;
  export let isMobile: boolean = false;
  export let ratingRefreshToken = 0;

  // UI state for expanding long name lists
  let showAllCreators = false;
  let showAllStarring = false;
  const MAX_NAMES = 8; // number of names to show before collapsing

  function formatSecondsToTimecode(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function formatTrackStart(track: any): string {
    const tc = track?.startTimecode;
    if (typeof tc === 'string' && tc.trim()) return tc.trim();
    return formatSecondsToTimecode(Number(track?.startOffsetSeconds ?? 0));
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

    const handleRatingUpdated = (event: Event) => {
      const detail = (event as CustomEvent<RatingUpdatedDetail>).detail;
      syncRatingFromEvent(detail);
    };

    window.addEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);
    window.addEventListener(RATING_UPDATED_EVENT, handleRatingUpdated as EventListener);

    return () => {
      window.removeEventListener(PROGRESS_CHANGE_EVENT, handleProgressChange);
      window.removeEventListener(RATING_UPDATED_EVENT, handleRatingUpdated as EventListener);
    };
  });

  $: if (browser && selected) {
    getWatchProgressForSelected();
  }

  $: if (browser && selectedEpisode) {
    getWatchProgressForSelected();
  }

  // Reset expansion state when selection changes
  $: if (selected) {
    showAllCreators = false;
    showAllStarring = false;
    // Reset user rating immediately when item changes, then load actual data
    currentUserRating = null;
    // Use the rating data already available on the content item to prevent flashing
    ratingsSummary = selected.averageRating !== undefined && selected.ratingCount !== undefined
      ? { averageRating: selected.averageRating, ratingCount: selected.ratingCount }
      : null;
  }

  $: if (browser && selected && ratingRefreshToken >= 0) {
    void loadRatingData();
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
    const numericId = Number(selected.id);
    if (Number.isFinite(numericId)) {
      dispatchRatingUpdated({
        mediaId: numericId,
        rating,
        averageRating: summary?.averageRating,
        ratingCount: summary?.ratingCount
      });
    }
  }

  async function handleRatingDelete() {
    if (!selected) return;
    await deleteRating(selected.id);
    currentUserRating = null;
    const summary = await getMediaRatingSummary(selected.id);
    ratingsSummary = summary;
    const numericId = Number(selected.id);
    if (Number.isFinite(numericId)) {
      dispatchRatingUpdated({
        mediaId: numericId,
        rating: null,
        averageRating: summary?.averageRating,
        ratingCount: summary?.ratingCount
      });
    }
  }

  function handleAuthRequired() {
    showAuthDialog = true;
  }

  function syncRatingFromEvent(detail?: RatingUpdatedDetail) {
    if (!detail || !selected) return;
    const numericId = Number(selected.id);
    if (!Number.isFinite(numericId) || detail.mediaId !== numericId) return;
    currentUserRating = detail.rating ?? null;
    if (detail.averageRating !== undefined && detail.ratingCount !== undefined) {
      ratingsSummary = {
        averageRating: detail.averageRating,
        ratingCount: detail.ratingCount
      };
    } else {
      void loadRatingData();
    }
  }

  // Seasons & Episodes for series
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
  
  // Fetch only when currentFetchId changes
  // Avoid duplicate fetches on mobile; MobileDetailsOverlay handles fetching when open
  $: if (browser && currentFetchId && !isMobile) {
    loadingEpisodes = true;
    episodes = [];
    _episodesController?.abort();
    _episodesController = new AbortController();
    const version = ++_episodesFetchVersion;
    const fetchId = currentFetchId; // Capture in closure to avoid race conditions
    // Add a client-side timeout so we don't get stuck if the upstream hangs
    const timeoutId = setTimeout(() => { try { _episodesController?.abort(); } catch {} }, 10000);
    fetch(`/api/series/${encodeURIComponent(fetchId)}/episodes`, { signal: _episodesController.signal })
      .then((r) => r.json())
      .then((data) => {
        if (version === _episodesFetchVersion) {
          episodes = data.episodes || [];
        }
      })
      .catch((err) => {
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
    _episodesController?.abort();
    _episodesController = null;
    episodes = [];
    loadingEpisodes = false;
  }
  // Default-select first episode when episodes list updates and current selection is missing
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
  let currentBlurhash = '';
  let previousBlurhash = '';
  let showPrevious = false;
  
  $: if (selected?.blurhash && selected.blurhash !== currentBlurhash) {
    previousBlurhash = currentBlurhash;
    currentBlurhash = selected.blurhash;
    showPrevious = true;
    setTimeout(() => { showPrevious = false; }, 500);
  } else if (selected && !selected.blurhash && currentBlurhash !== '') {
    previousBlurhash = currentBlurhash;
    currentBlurhash = '';
    showPrevious = true;
    setTimeout(() => { showPrevious = false; }, 500);
  }

  async function copyLink() {
    if (!selected) return;
    let path = getUrlForItem(selected);
    // Prefer pretty episode URL when possible; fallback to ?ep=<id>
    if (selected.type === 'series' && selectedEpisode?.id) {
      const epNum = selectedEpisode.position && Number.isFinite(selectedEpisode.position)
        ? Math.max(1, Math.floor(selectedEpisode.position))
        : null;
      if (epNum) path = getEpisodeUrl(selected as any, { episodeNumber: epNum, seasonNumber: selectedSeason });
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
        // Fallback: temporary input selection
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
      // As a last resort, navigate to the URL (so user can copy from address bar)
      if (browser) window.history.pushState({}, '', url);
    }
  }

  const backdropOverlayClass = 'details-backdrop-overlay';
  const heroButtonClass = 'details-primary-button';
</script>

{#if selected}
  <!-- Background layers for crossfade -->
  <div class="sidebar-background-container">
    {#if previousBlurhash}
      <div 
        class="sidebar-background" 
        class:fade-out={!showPrevious}
        style:background-image={blurhashToCssGradientString(previousBlurhash)}
      ></div>
    {/if}
    {#if currentBlurhash}
      <div 
        class="sidebar-background" 
        style:background-image={blurhashToCssGradientString(currentBlurhash)}
      ></div>
    {:else}
      <div 
        class="sidebar-background sidebar-background-fallback"
      ></div>
    {/if}
  </div>
  <div class={backdropOverlayClass}></div>
  
  <div class="space-y-4 relative z-10 flex-1">
    <div>
  <h2 class="text-3xl font-serif font-light text-gray-100 tracking-wide mb-4">{selected.title}</h2>
    <div class="flex items-center gap-4 text-sm text-gray-400 mb-4">
        {#if selected.type === 'movie'}
          <span class="bg-blue-600 px-2 py-1 rounded text-white text-xs">MOVIE</span>
          {#if selected.paid}<span class="bg-yellow-500 text-black px-2 py-1 rounded text-xs font-bold">PAID</span>{/if}
          <span>{(selected as any).year}</span>
          <span>{(selected as any).duration}</span>
        {:else}
          <span class="bg-red-600 px-2 py-1 rounded text-white text-xs">SERIES</span>
          <span>{(selected as any).episodeCount || '?'} episodes</span>
        {/if}
        {#if (selected as any).trakt}
          <a href={(selected as any).trakt} target="_blank" rel="noopener noreferrer" class="inline-flex items-center justify-center w-5 h-5 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#ED1C24] focus:ring-offset-black rounded transition hover:scale-105" aria-label="View on Trakt" title="View on Trakt">
            <img src="https://trakt.tv/assets/logos/logomark.square.gradient-b644b16c38ff775861b4b1f58c1230f6a097a2466ab33ae00445a505c33fcb91.svg" alt="" class="w-full h-full select-none" loading="lazy" decoding="async" />
            <span class="sr-only">View on Trakt</span>
          </a>
        {/if}
        <!-- Shareable URL: icon-only copy button -->
        <button type="button" class="inline-flex items-center justify-center w-6 h-6 rounded hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500" on:click={copyLink} title="Copy link" aria-label="Copy link">
          <Link2Icon class="w-4 h-4" />
        </button>
      </div>
    </div>
    <div>
      <br />
  <p class="text-gray-300 leading-relaxed text-sm font-sans">{selected.description}</p>
    </div>

    <!-- Facet Tags -->
    {#if selected.facets}
      <div class="mt-4">
        <FacetChips facets={selected.facets} />
      </div>
    {/if}

    <!-- Bangerometer Rating Component -->
    <div class="mt-6">
      <BangerMeter
        mediaId={selected.id}
        initialRating={currentUserRating}
        onRatingChange={handleRatingChange}
        onRatingDelete={handleRatingDelete}
        onAuthRequired={handleAuthRequired}
        isWatched={watchProgress?.isWatched || false}
        averageRating={ratingsSummary?.averageRating || 0}
        ratingCount={ratingsSummary?.ratingCount || 0}
      />
    </div>

    <!-- Watch Progress Toggle (Movies only) -->
    {#if isAuthenticated && selected.type === 'movie'}
      <div class="mt-4">
        <button
          type="button"
          on:click={toggleWatchedStatus}
          class="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 {watchProgress?.isWatched ? 'bg-green-600/20 text-green-400 border border-green-600/50 hover:bg-green-600/30 focus-visible:ring-green-500' : 'bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-700 focus-visible:ring-gray-500'}"
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
      <div class="space-y-4 text-sm">
        {#if selected.paid}
          <div class="space-y-1">
            <span class="text-gray-400 block">Provider:</span>
            <div class="flex flex-wrap gap-1">
              <span class="px-2 py-0.5 rounded-full bg-gray-700 text-white text-xs font-medium">{selected.provider || 'External'}</span>
            </div>
          </div>
        {/if}
        {#if (selected as any).creators?.length}
          <div class="space-y-1">
            <span class="text-gray-400 block">Creators:</span>
            <div class="flex flex-wrap gap-1">
              {#each (showAllCreators ? (selected as any).creators : (selected as any).creators.slice(0, MAX_NAMES)) as c}
                <span class="px-2 py-0.5 rounded-full bg-gray-700 text-white text-xs font-medium">{c}</span>
              {/each}
              {#if (selected as any).creators.length > MAX_NAMES}
                <button class="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition" on:click={() => showAllCreators = !showAllCreators} title={showAllCreators ? 'Show fewer' : 'Show all'}>
                  {#if showAllCreators}−{/if}{#if !showAllCreators}+{/if}
                  {(selected as any).creators.length - MAX_NAMES}
                </button>
              {/if}
            </div>
          </div>
        {/if}

        {#if Array.isArray((selected as any).tracks) && (selected as any).tracks.length}
          <div class="space-y-2">
            <span class="text-gray-400 inline-flex items-center gap-1">
              Tracklist:
              <svg
                viewBox="0 0 24 24"
                class="h-3 w-3 text-[#1DB954]/80"
                aria-hidden="true"
                focusable="false"
              >
                <title>Spotify-backed track metadata</title>
                <path
                  fill="currentColor"
                  d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5 22.5 17.799 22.5 12 17.799 1.5 12 1.5Zm4.82 15.174a.75.75 0 0 1-1.033.247c-2.83-1.73-6.395-2.122-10.598-1.165a.75.75 0 1 1-.332-1.462c4.566-1.04 8.48-.595 11.714 1.382a.75.75 0 0 1 .249 1.0Zm1.476-3.02a.9.9 0 0 1-1.238.296c-3.24-1.99-8.18-2.566-12.01-1.404a.9.9 0 0 1-.522-1.722c4.36-1.322 9.776-.68 13.48 1.596a.9.9 0 0 1 .29 1.234Zm.127-3.153C14.64 8.21 8.38 8 4.79 9.09a1.05 1.05 0 0 1-.61-2.01c4.13-1.255 11.0-1.01 15.36 1.58a1.05 1.05 0 1 1-1.07 1.84Z"
                />
              </svg>
            </span>
            <ul class="space-y-2">
              {#each (selected as any).tracks as t (t.position)}
                <li class="flex items-center justify-between gap-3 rounded-lg bg-gray-900/30 border border-gray-700/50 border-l-2 border-l-[#1DB954]/50 px-3 py-2">
                  <div class="min-w-0 flex-1">
                    <div class="text-xs text-gray-400 font-mono">{formatTrackStart(t)}</div>
                    <div class="text-sm text-gray-100 truncate">
                      {t.song?.artist} — {t.song?.title}
                    </div>
                  </div>
                  {#if t.song?.spotifyUrl}
                    <a
                      href={t.song.spotifyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      class="flex-shrink-0 inline-flex items-center gap-1 text-xs px-2 py-1 rounded bg-[#1DB954]/15 text-[#1DB954] border border-[#1DB954]/35 hover:bg-[#1DB954]/25 transition"
                      aria-label="Open in Spotify"
                      title="Open in Spotify"
                    >
                      <svg viewBox="0 0 24 24" class="h-3 w-3" aria-hidden="true" focusable="false">
                        <path
                          fill="currentColor"
                          d="M12 1.5C6.201 1.5 1.5 6.201 1.5 12S6.201 22.5 12 22.5 22.5 17.799 22.5 12 17.799 1.5 12 1.5Zm4.82 15.174a.75.75 0 0 1-1.033.247c-2.83-1.73-6.395-2.122-10.598-1.165a.75.75 0 1 1-.332-1.462c4.566-1.04 8.48-.595 11.714 1.382a.75.75 0 0 1 .249 1.0Zm1.476-3.02a.9.9 0 0 1-1.238.296c-3.24-1.99-8.18-2.566-12.01-1.404a.9.9 0 0 1-.522-1.722c4.36-1.322 9.776-.68 13.48 1.596a.9.9 0 0 1 .29 1.234Zm.127-3.153C14.64 8.21 8.38 8 4.79 9.09a1.05 1.05 0 0 1-.61-2.01c4.13-1.255 11.0-1.01 15.36 1.58a1.05 1.05 0 1 1-1.07 1.84Z"
                        />
                      </svg>
                      Open
                    </a>
                  {/if}
                </li>
              {/each}
            </ul>
          </div>
        {/if}
        {#if (selected as any).starring?.length}
          <div class="space-y-1">
            <span class="text-gray-400 block">Starring:</span>
            <div class="flex flex-wrap gap-1">
              {#each (showAllStarring ? (selected as any).starring : (selected as any).starring.slice(0, MAX_NAMES)) as s}
                <span class="px-2 py-0.5 rounded-full bg-gray-700 text-white text-xs font-medium">{s}</span>
              {/each}
              {#if (selected as any).starring.length > MAX_NAMES}
                <button class="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition" on:click={() => showAllStarring = !showAllStarring} title={showAllStarring ? 'Show fewer' : 'Show all'}>
                  {#if showAllStarring}−{/if}{#if !showAllStarring}+{/if}
                  {(selected as any).starring.length - MAX_NAMES}
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    {:else}
      <div class="space-y-4 text-sm">
        {#if (selected as any).creators?.length}
          <div class="space-y-1">
            <span class="text-gray-400 block">Creators:</span>
            <div class="flex flex-wrap gap-1">
              {#each (showAllCreators ? (selected as any).creators : (selected as any).creators.slice(0, MAX_NAMES)) as c}
                <span class="px-2 py-0.5 rounded-full bg-gray-700 text-white text-xs font-medium">{c}</span>
              {/each}
              {#if (selected as any).creators.length > MAX_NAMES}
                <button class="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition" on:click={() => showAllCreators = !showAllCreators} title={showAllCreators ? 'Show fewer' : 'Show all'}>
                  {#if showAllCreators}−{/if}{#if !showAllCreators}+{/if}
                  {(selected as any).creators.length - MAX_NAMES}
                </button>
              {/if}
            </div>
          </div>
        {/if}
        {#if (selected as any).starring?.length}
          <div class="space-y-1">
            <span class="text-gray-400 block">Starring:</span>
            <div class="flex flex-wrap gap-1">
              {#each (showAllStarring ? (selected as any).starring : (selected as any).starring.slice(0, MAX_NAMES)) as s}
                <span class="px-2 py-0.5 rounded-full bg-gray-700 text-white text-xs font-medium">{s}</span>
              {/each}
              {#if (selected as any).starring.length > MAX_NAMES}
                <button class="px-2 py-0.5 rounded-full bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition" on:click={() => showAllStarring = !showAllStarring} title={showAllStarring ? 'Show fewer' : 'Show all'}>
                  {#if showAllStarring}−{/if}{#if !showAllStarring}+{/if}
                  {(selected as any).starring.length - MAX_NAMES}
                </button>
              {/if}
            </div>
          </div>
        {/if}
      </div>
    <div class="mt-6">
  <h3 class="text-base font-semibold text-gray-200 mb-3">{m.tv_episodes()}</h3>
      {#if (selected as any).seasons?.length > 0}
        <div class="mb-2">
          <select
            id="sidebar-season-select"
            class="w-full bg-transparent border rounded px-3 py-2 text-sm"
            bind:value={selectedSeason}
            disabled={(selected as any).seasons?.length <= 1}
            on:change={(e) => {
              const next = Number((e.currentTarget as HTMLSelectElement).value);
              selectedSeason = next; // triggers reactive fetch
              // Immediately select Episode 1 of this season and navigate to pretty URL
              const seasonForUrl = Number.isFinite(next) ? Math.max(1, next) : 1;
              Promise.resolve().then(() => onSelectEpisode('pos:1', 'Episode 1', 1, seasonForUrl));
              // Scroll the list to the top for a clean start
              Promise.resolve().then(() => { try { episodesListEl?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} });
            }}
          >
            {#each (selected as any).seasons as s}
              <option value={s.seasonNumber} class="bg-black text-gray-100">
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
          <ul class="max-h-64 overflow-auto pr-2 space-y-2" bind:this={episodesListEl}>
            {#each episodes as ep}
              {@const epProgress = getEpisodeWatchProgress(ep.id)}
              <li class="overflow-hidden">
                <div class="flex items-center gap-2 overflow-hidden">
                  <button type="button" class="flex-1 flex items-center gap-3 p-1.5 rounded hover:bg-white/10 transition text-left border-2 border-transparent outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 overflow-hidden min-w-0 {selectedEpisode && selectedEpisode.id === ep.id ? 'bg-red-900/30 border-2 border-red-500/60' : ''}"
                    on:click={() => onSelectEpisode(ep.id, decode(ep.title), ep.position, selectedSeasonNum)}>
                    <div class="relative w-20 h-12 flex-shrink-0 overflow-hidden rounded">
                      {#if ep.thumbnail}
                        <img src={ep.thumbnail} alt={decode(ep.title)} class="w-full h-full object-cover {epProgress?.isWatched ? 'opacity-30' : ''}" loading="lazy" decoding="async" />
                      {:else}
                        <div class="w-full h-full bg-gray-700"></div>
                      {/if}
                      {#if epProgress?.isWatched}
                        <div class="absolute inset-0 bg-black/60 flex items-center justify-center">
                          <CheckIcon class="w-5 h-5 text-green-400" />
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
                      class="flex-shrink-0 p-2 rounded-lg transition-all hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 text-gray-500 hover:text-gray-400 focus-visible:ring-gray-500"
                      title={epProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                      aria-label={epProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                    >
                      {#if epProgress?.isWatched}
                        <EyeOffIcon class="w-5 h-5" />
                      {:else}
                        <EyeIcon class="w-5 h-5" />
                      {/if}
                    </button>
                  {/if}
                </div>
              </li>
            {/each}
          </ul>
        {/if}
      </div>
    {/if}
  </div>
  <div class="relative z-10 pt-4">
    {#if !$showPlayer}
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
  }} class={heroButtonClass}>
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
    {/if}
  </div>
{:else}
  <div class="absolute inset-0 z-0 bg-gray-800 border-l border-white/10"></div>
  <div class="text-center text-gray-400 py-12 relative z-10">
    <svg class="w-16 h-16 mx-auto mb-4 opacity-30" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>
    <p>{m.tv_selectPlaceholder()}</p>
  </div>
{/if}

<!-- Auth Dialog for non-authenticated users -->
<AuthDialog bind:open={showAuthDialog} />

<style>
  .sidebar-background-container {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    width: 460px;
    z-index: 0;
    overflow: hidden;
    pointer-events: none;
  }

  @media (max-width: 1280px) {
    .sidebar-background-container {
      width: 420px;
    }
  }

  .sidebar-background {
    position: absolute;
    inset: 0;
    background-size: cover;
    background-position: center;
    opacity: 1;
    transition: opacity 0.5s ease-in-out;
  }

  .sidebar-background.fade-out {
    opacity: 0;
  }

  .sidebar-background-fallback {
    background: linear-gradient(135deg, rgb(37, 99, 235), rgb(147, 51, 234));
  }

  .details-backdrop-overlay {
    position: fixed;
    top: 0;
    bottom: 0;
    right: 0;
    width: 460px;
    z-index: 1;
    border-left: 1px solid rgba(71, 85, 105, 0.38);
    background: linear-gradient(185deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.68) 58%, rgba(15, 23, 42, 0.48) 100%);
    pointer-events: none;
  }

  @media (max-width: 1280px) {
    .details-backdrop-overlay {
      width: 420px;
    }
  }

  .sticky-play-button {
    position: sticky;
    bottom: 0;
    background: linear-gradient(to top, 
      rgba(15, 23, 42, 1) 0%, 
      rgba(15, 23, 42, 1) 50%, 
      rgba(15, 23, 42, 0.95) 75%, 
      rgba(15, 23, 42, 0) 100%
    );
    padding-top: 2rem;
    margin-top: -1.5rem;
  }

  .details-primary-button {
    width: 100%;
    background: linear-gradient(135deg, rgba(37, 99, 235, 0.95), rgba(59, 130, 246, 0.92));
    color: #fff;
    padding: 0.95rem 1.5rem;
    border-radius: 18px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    cursor: pointer;
    transition: transform 0.2s ease, box-shadow 0.25s ease, background 0.25s ease;
    box-shadow: 0 22px 40px -24px rgba(37, 99, 235, 0.6);
  }

  .details-primary-button:hover {
    transform: translateY(-1px);
    box-shadow: 0 26px 45px -22px rgba(37, 99, 235, 0.66);
  }

</style>
