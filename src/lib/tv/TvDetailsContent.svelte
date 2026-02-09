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
  import { fade } from 'svelte/transition';
  import { decode } from 'html-entities';
  import { showPlayer, selectEpisode as updateSelectedEpisode } from '$lib/tv/store';
  import Tracklist from '$lib/tv/Tracklist.svelte';
  import { getProviderLink, type ProviderLink } from '$lib/tv/provider-links';
  import { setWatchedStatus, PROGRESS_CHANGE_EVENT } from '$lib/tv/watchHistory';
  import { flushWatchHistoryNow } from '$lib/tv/watchHistory';
  import type { WatchProgress } from '$lib/tv/watchHistory';
  import { onMount } from 'svelte';
  import { user as authUser } from '$lib/stores/authStore';
  import BangerMeter from '$lib/components/Bangerometer.svelte';
  import {
    applyRatingEventUpdate,
    buildBaseId,
    buildWatchProgressMap,
    fetchRatings,
    getEpisodeWatchProgress as resolveEpisodeWatchProgress,
    getInitialRatingsSummary,
    getPreferredMovieProgressId,
    getWatchProgressForSelection,
    removeRating,
    updateRating
  } from '$lib/tv/details-helpers';
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
  export let ratingRefreshToken = 0;

  // UI state for expanding long name lists
  let showAllCreators = false;
  let showAllStarring = false;
  const MAX_NAMES = 8; // number of names to show before collapsing

  // Watch progress tracking
  let watchProgress: { percent: number; isWatched: boolean; position: number } | null = null;
  let watchProgressMap: Map<string, WatchProgress> = new Map();

  function getWatchProgressForSelected(): void {
    if (!browser || !selected) {
      watchProgress = null;
      watchProgressMap = new Map();
      return;
    }
    watchProgressMap = buildWatchProgressMap(browser);
    watchProgress = getWatchProgressForSelection({ selected, selectedEpisode, watchProgressMap });
  }

  function getEpisodeWatchProgress(episodeId: string): { isWatched: boolean; percent: number } | null {
    return resolveEpisodeWatchProgress({
      browser,
      selected,
      episodeId,
      watchProgressMap
    });
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
    
    watchProgressMap = buildWatchProgressMap(browser);
    watchProgress = getWatchProgressForSelection({ selected, selectedEpisode, watchProgressMap });
    
    // Force reactivity by creating a new episodes array reference
    episodes = [...episodes];
    
    toast.success(newStatus ? 'Episode marked as watched' : 'Episode marked as unwatched');
  }

  function toggleWatchedStatus() {
    if (!browser || !selected || selected.type !== 'movie' || !isAuthenticated) return;
    const preferredId = getPreferredMovieProgressId(selected);
    if (!preferredId) return;

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
    ratingsSummary = getInitialRatingsSummary(selected);
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
      const { userRating, summary } = await fetchRatings(selected.id);
      currentUserRating = userRating;
      // Update with fresh data from the server
      ratingsSummary = summary;
    } catch (error) {
      console.error('Error loading rating data:', error);
    }
  }

  async function handleRatingChange(rating: number) {
    if (!selected) return;
    currentUserRating = rating;
    // Refresh summary to show updated average
    const summary = await updateRating(selected.id, rating);
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
    const summary = await removeRating(selected.id);
    currentUserRating = null;
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
    if (!selected) return;
    const update = applyRatingEventUpdate(selected.id, detail);
    if (!update) return;
    currentUserRating = update.rating;
    if (update.summary) {
      ratingsSummary = update.summary;
    } else if (update.shouldReload) {
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
  $: if (browser && currentFetchId) {
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

  let providerLink: ProviderLink | null = null;
  $: providerLink = selected ? getProviderLink(selected, selectedEpisode) : null;
</script>

{#if selected}
  <section class="detail-wrap">
    <header class="detail-header">
      <div class="detail-header-top">
        <div>
          <h2 class="detail-title jf-display">{selected.title}</h2>
        </div>
      </div>

      <div class="detail-meta">
        <span class="detail-pill">{selected.type === 'movie' ? 'Movie' : 'Series'}</span>
        {#if selected.paid}
          <span class="detail-pill detail-pill--paid">Paid</span>
        {/if}
        {#if selected.type === 'movie' && (selected as any).year}
          <span>{(selected as any).year}</span>
        {/if}
        {#if selected.type === 'movie' && (selected as any).duration}
          <span>{(selected as any).duration}</span>
        {/if}
        {#if selected.type === 'series'}
          <span>{(selected as any).episodeCount || '?'} episodes</span>
        {/if}
        <div class="detail-meta-actions">
          {#if (selected as any).trakt}
            <a href={(selected as any).trakt} target="_blank" rel="noopener noreferrer" class="detail-icon" aria-label="View on Trakt" title="View on Trakt">
              <img src="https://trakt.tv/assets/logos/logomark.square.gradient-b644b16c38ff775861b4b1f58c1230f6a097a2466ab33ae00445a505c33fcb91.svg" alt="" class="detail-icon-img" loading="lazy" decoding="async" />
              <span class="sr-only">View on Trakt</span>
            </a>
          {/if}
          <button type="button" class="detail-icon" on:click={copyLink} title="Copy link" aria-label="Copy link">
            <Link2Icon class="w-4 h-4" />
          </button>
          {#if providerLink}
            <a
              href={providerLink.url}
              target="_blank"
              rel="noopener noreferrer"
              class="detail-icon"
              title={providerLink.title}
              aria-label={providerLink.ariaLabel}
            >
              {#if providerLink.kind === 'youtube'}
                <span class="provider-icon provider-icon-youtube w-4 h-4" aria-hidden="true"></span>
              {:else}
                <span class="provider-icon provider-icon-vimeo w-4 h-4" aria-hidden="true"></span>
              {/if}
            </a>
          {/if}
        </div>
      </div>

    </header>

    <div class="detail-grid">
      <aside class="detail-aside">
        <div class={selected.type === 'series' ? 'detail-poster detail-poster--series' : 'detail-poster'}>
          {#if selected.thumbnail}
            <img src={selected.thumbnail} alt={selected.title} loading="lazy" decoding="async" />
          {:else}
            <div class="detail-poster-fallback"></div>
          {/if}
        </div>

        <div class="detail-actions">
          {#if !$showPlayer}
            <button on:click={() => {
              if (selected?.type === 'series' && selectedEpisode) { 
                if (selectedEpisode.externalUrl) {
                  if (browser) window.open(selectedEpisode.externalUrl, '_blank');
                  return;
                }
                onOpenEpisode(selectedEpisode.id, decode(selectedEpisode.title), selectedEpisode.position || 1, selectedSeasonNum);
                return; 
              }
              if (isInlinePlayable(selected)) openContent(selected);
              else if (selected?.externalUrl) openExternal(selected);
            }} class="detail-play">
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

          {#if isAuthenticated && selected.type === 'movie'}
            <button
              type="button"
              on:click={toggleWatchedStatus}
              class={`detail-toggle ${watchProgress?.isWatched ? 'detail-toggle--active' : ''}`}
            >
              {#if watchProgress?.isWatched}
                <CheckIcon class="w-4 h-4" />
                <span>{m.tv_markUnwatched()}</span>
              {:else}
                <EyeIcon class="w-4 h-4" />
                <span>{m.tv_markWatched()}</span>
              {/if}
            </button>
          {/if}

          {#if watchProgress && watchProgress.percent > 0 && watchProgress.percent < 85}
            <div class="detail-progress">
              <div class="detail-progress-label">
                <span>Progress</span>
                <span>{Math.round(watchProgress.percent)}%</span>
              </div>
              <div class="detail-progress-track">
                <div class="detail-progress-fill" style:width="{watchProgress.percent}%"></div>
              </div>
            </div>
          {/if}
        </div>

      </aside>

      <div class="detail-main">
        <div class="detail-main-content">
          <section class="detail-section detail-overview">
            <div class="detail-overview-copy">
              <h3>Overview</h3>
              <p>{selected.description || 'No description available.'}</p>
            </div>
          </section>

          {#if selected.facets}
            <section class="detail-section">
              <h3>Facets</h3>
              <FacetChips facets={selected.facets} />
            </section>
          {/if}

          {#if (selected as any).creators?.length}
            <section class="detail-section">
              <h3>Creators</h3>
              <div class="detail-tags">
                {#each (showAllCreators ? (selected as any).creators : (selected as any).creators.slice(0, MAX_NAMES)) as c}
                  <span>{c}</span>
                {/each}
                {#if (selected as any).creators.length > MAX_NAMES}
                  <button class="detail-tags-more" on:click={() => showAllCreators = !showAllCreators} title={showAllCreators ? 'Show fewer' : 'Show all'}>
                    {#if showAllCreators}−{/if}{#if !showAllCreators}+{/if}
                    {(selected as any).creators.length - MAX_NAMES}
                  </button>
                {/if}
              </div>
            </section>
          {/if}

          {#if (selected as any).starring?.length}
            <section class="detail-section">
              <h3>Starring</h3>
              <div class="detail-tags">
                {#each (showAllStarring ? (selected as any).starring : (selected as any).starring.slice(0, MAX_NAMES)) as s}
                  <span>{s}</span>
                {/each}
                {#if (selected as any).starring.length > MAX_NAMES}
                  <button class="detail-tags-more" on:click={() => showAllStarring = !showAllStarring} title={showAllStarring ? 'Show fewer' : 'Show all'}>
                    {#if showAllStarring}−{/if}{#if !showAllStarring}+{/if}
                    {(selected as any).starring.length - MAX_NAMES}
                  </button>
                {/if}
              </div>
            </section>
          {/if}

          {#if selected.type === 'movie' && Array.isArray(selected.tracks) && selected.tracks.length}
            <section class="detail-section">
              <h3>Tracklist</h3>
              <Tracklist tracks={selected.tracks} />
            </section>
          {/if}

          {#if selected.type === 'series'}
            <section class="detail-section">
              <div class="detail-episodes-header">
                <h3>{m.tv_episodes()}</h3>
                {#if (selected as any).seasons?.length > 0}
                  <select
                    id="detail-season-select"
                    class="detail-select"
                    bind:value={selectedSeason}
                    disabled={(selected as any).seasons?.length <= 1}
                    on:change={(e) => {
                      const next = Number((e.currentTarget as HTMLSelectElement).value);
                      selectedSeason = next;
                      const seasonForUrl = Number.isFinite(next) ? Math.max(1, next) : 1;
                      Promise.resolve().then(() => onSelectEpisode('pos:1', 'Episode 1', 1, seasonForUrl));
                      Promise.resolve().then(() => { try { episodesListEl?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} });
                    }}
                  >
                    {#each (selected as any).seasons as s}
                      <option value={s.seasonNumber} class="bg-black text-gray-100">
                        {s.customName || `Season ${s.seasonNumber}`}
                      </option>
                    {/each}
                  </select>
                {/if}
              </div>

              {#if loadingEpisodes}
                <p class="detail-muted">Loading episodes…</p>
              {:else if episodes.length === 0}
                <p class="detail-muted">No episodes found.</p>
              {:else}
                <ul class="detail-episodes" bind:this={episodesListEl}>
                  {#each episodes as ep}
                    {@const epProgress = getEpisodeWatchProgress(ep.id)}
                    <li>
                      <button type="button" class={`detail-episode ${selectedEpisode && selectedEpisode.id === ep.id ? 'detail-episode--active' : ''}`}
                        on:click={() => onSelectEpisode(ep.id, decode(ep.title), ep.position, selectedSeasonNum)}>
                        <div class="detail-episode-thumb">
                          {#if ep.thumbnail}
                            <img src={ep.thumbnail} alt={decode(ep.title)} class={epProgress?.isWatched ? 'is-watched' : ''} loading="lazy" decoding="async" />
                          {:else}
                            <div class="detail-episode-fallback"></div>
                          {/if}
                          {#if epProgress?.isWatched}
                            <div class="detail-episode-status"><CheckIcon class="w-4 h-4" /></div>
                          {/if}
                          {#if epProgress && epProgress.percent > 0}
                            <div class="detail-episode-progress">
                              <div style:width="{epProgress.percent}%"></div>
                            </div>
                          {/if}
                        </div>
                        <div class="detail-episode-info">
                          <span>Ep {ep.position}</span>
                          <strong>{decode(ep.title)}</strong>
                        </div>
                      </button>
                      {#if isAuthenticated}
                        <button
                          type="button"
                          on:click={(e) => toggleEpisodeWatchedStatus(ep.id, e)}
                          class="detail-episode-toggle"
                          title={epProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                          aria-label={epProgress?.isWatched ? 'Mark as unwatched' : 'Mark as watched'}
                        >
                          {#if epProgress?.isWatched}
                            <EyeOffIcon class="w-4 h-4" />
                          {:else}
                            <EyeIcon class="w-4 h-4" />
                          {/if}
                        </button>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </section>
          {/if}
        </div>
      </div>

      <aside class="detail-review-sidebar">
        <h3>Ratings &amp; Reviews</h3>
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
        <p class="detail-review-note">Reviews coming soon.</p>
      </aside>
    </div>
  </section>
{:else}
  <div class="detail-empty">
    <svg class="w-16 h-16 mx-auto mb-4 opacity-30" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>
    <p>{m.tv_selectPlaceholder()}</p>
  </div>
{/if}

<AuthDialog bind:open={showAuthDialog} />

<style>
  .detail-wrap {
    display: grid;
    gap: 2rem;
  }

  .detail-header {
    display: grid;
    gap: 1rem;
    position: relative;
  }

  .detail-header-top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1.5rem;
  }

  .detail-title {
    font-size: clamp(2rem, 4vw, 3.6rem);
    color: var(--jf-ink);
    text-shadow: 0 18px 40px rgba(2, 6, 23, 0.6);
  }

  .detail-back {
    position: absolute;
    top: 0;
    left: 0.75rem;
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    height: 2.25rem;
    padding: 0 0.85rem;
    border-radius: 0.75rem;
    border: 1px solid rgba(248, 250, 252, 0.2);
    background: rgba(8, 12, 24, 0.75);
    color: rgba(248, 250, 252, 0.85);
    font-size: 0.6rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    box-shadow: 0 10px 30px -20px rgba(2, 6, 23, 0.8);
    transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease;
  }

  .detail-back:hover {
    transform: translateY(-2px);
    background: rgba(15, 23, 42, 0.85);
    box-shadow: 0 16px 34px -22px rgba(2, 6, 23, 0.9);
  }

  .detail-back:focus-visible {
    outline: 2px solid rgba(229, 9, 20, 0.6);
    outline-offset: 3px;
  }

  :global(.detail-suggest) {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: 999px;
    border: 1px solid rgba(248, 250, 252, 0.2);
    color: rgba(248, 250, 252, 0.75);
    background: rgba(8, 12, 24, 0.6);
    transition: transform 0.2s ease, color 0.2s ease;
  }

  :global(.detail-suggest:hover) {
    transform: translateY(-1px);
    color: rgba(248, 250, 252, 0.95);
  }

  .detail-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.6rem 1.2rem;
    font-size: 0.75rem;
    text-transform: uppercase;
    letter-spacing: 0.16em;
    color: rgba(226, 232, 240, 0.65);
    align-items: center;
  }

  .detail-meta-actions {
    display: inline-flex;
    gap: 0.6rem;
    align-items: center;
  }

  .detail-pill {
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    border: 1px solid rgba(248, 250, 252, 0.2);
    color: rgba(248, 250, 252, 0.85);
    font-size: 0.6rem;
    letter-spacing: 0.18em;
  }

  .detail-pill--paid {
    border-color: rgba(250, 204, 21, 0.6);
    color: rgba(254, 240, 138, 0.85);
  }

  .detail-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: 999px;
    border: 1px solid rgba(248, 250, 252, 0.2);
    color: rgba(248, 250, 252, 0.75);
    transition: transform 0.2s ease, color 0.2s ease;
    background: rgba(8, 12, 24, 0.6);
  }

  .detail-icon:hover {
    transform: translateY(-1px);
    color: rgba(248, 250, 252, 0.95);
  }

  .detail-icon-img {
    width: 18px;
    height: 18px;
  }

  .detail-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 2rem;
  }

  .detail-aside {
    display: grid;
    gap: 0.4rem;
    align-content: start;
    min-width: 0;
  }

  .detail-poster {
    border-radius: 24px;
    overflow: hidden;
    border: 1px solid rgba(248, 250, 252, 0.2);
    background: rgba(8, 12, 24, 0.6);
    box-shadow: 0 20px 45px -30px rgba(2, 6, 23, 0.8);
    aspect-ratio: 2 / 3;
  }

  .detail-poster img {
    width: 100%;
    height: 100%;
    display: block;
    object-fit: cover;
  }

  .detail-poster--series img {
    object-fit: contain;
  }

  .detail-poster-fallback {
    height: 100%;
    background: linear-gradient(160deg, rgba(229, 9, 20, 0.4), rgba(37, 99, 235, 0.3));
  }

  .detail-actions {
    display: grid;
    gap: 0.6rem;
    margin-top: 0;
  }

  .detail-play {
    width: 100%;
    border-radius: 14px;
    border: 1px solid rgba(229, 9, 20, 0.5);
    background: linear-gradient(120deg, rgba(229, 9, 20, 0.95), rgba(229, 9, 20, 0.7));
    color: #fff;
    padding: 0.6rem 0.9rem;
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    display: inline-flex;
    justify-content: center;
    align-items: center;
    gap: 0.6rem;
    box-shadow: 0 20px 45px -30px rgba(229, 9, 20, 0.8);
  }

  .detail-toggle {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(248, 250, 252, 0.18);
    background: rgba(8, 12, 24, 0.65);
    color: rgba(226, 232, 240, 0.85);
    padding: 0.7rem 1rem;
    font-size: 0.75rem;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .detail-toggle--active {
    border-color: rgba(34, 197, 94, 0.5);
    color: rgba(187, 247, 208, 0.9);
  }

  .detail-progress {
    border-radius: 16px;
    border: 1px solid rgba(248, 250, 252, 0.12);
    background: rgba(7, 10, 20, 0.7);
    padding: 0.75rem;
  }

  .detail-progress-label {
    display: flex;
    justify-content: space-between;
    font-size: 0.6rem;
    text-transform: uppercase;
    letter-spacing: 0.2em;
    color: rgba(226, 232, 240, 0.7);
  }

  .detail-progress-track {
    margin-top: 0.5rem;
    height: 0.25rem;
    border-radius: 999px;
    background: rgba(248, 250, 252, 0.15);
    overflow: hidden;
  }

  .detail-progress-fill {
    height: 100%;
    border-radius: inherit;
    background: linear-gradient(90deg, rgba(229, 9, 20, 0.9), rgba(229, 9, 20, 0.6));
  }


  .detail-main {
    display: grid;
    gap: 1.6rem;
    align-items: start;
    min-width: 0;
  }

  .detail-main-content {
    display: grid;
    gap: 1.6rem;
    grid-column: 1;
    min-width: 0;
  }

  .detail-main-content > * {
    min-width: 0;
  }

  .detail-section h3 {
    font-size: 0.85rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.7);
  }

  .detail-section,
  .detail-overview-copy {
    min-width: 0;
  }

  .detail-section.detail-overview {
    margin-bottom: -0.4rem;
  }

  .detail-review-sidebar {
    display: grid;
    gap: 0.6rem;
    align-content: start;
    min-height: 0;
    grid-column: auto;
    min-width: 0;
    overflow: visible;
    min-width: 320px;
  }

  .detail-review-note {
    margin-top: 0.2rem;
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.55);
  }

  .detail-review-sidebar h3 {
    font-size: 0.85rem;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.7);
  }

  .detail-section p {
    margin-top: 0.75rem;
    color: rgba(226, 232, 240, 0.78);
    line-height: 1.7;
    overflow-wrap: anywhere;
  }

  .detail-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .detail-tags span,
  .detail-tags-more {
    padding: 0.3rem 0.6rem;
    border-radius: 999px;
    border: 1px solid rgba(248, 250, 252, 0.18);
    font-size: 0.65rem;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.75);
    background: rgba(8, 12, 24, 0.6);
  }

  .detail-tags-more {
    cursor: pointer;
  }

  .detail-episodes-header {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    align-items: center;
    justify-content: space-between;
  }

  .detail-select {
    border-radius: 999px;
    border: 1px solid rgba(248, 250, 252, 0.2);
    background: rgba(8, 12, 24, 0.6);
    padding: 0.5rem 1rem;
    color: rgba(248, 250, 252, 0.9);
    font-size: 0.7rem;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }

  .detail-episodes {
    margin: 1rem 0 0;
    display: grid;
    gap: 0.75rem;
    max-height: 420px;
    overflow: auto;
    padding-right: 0.5rem;
    padding-left: 0;
    list-style: none;
  }

  .detail-episodes li {
    position: relative;
  }

  .detail-episode {
    width: 100%;
    display: grid;
    grid-template-columns: 120px 1fr;
    gap: 1rem;
    align-items: center;
    padding: 0.75rem;
    padding-right: 3.25rem;
    border-radius: 18px;
    border: 1px solid rgba(248, 250, 252, 0.15);
    background: rgba(8, 12, 24, 0.6);
    color: rgba(248, 250, 252, 0.85);
    text-align: left;
  }

  .detail-episode--active {
    border-color: rgba(229, 9, 20, 0.5);
  }

  .detail-episode-thumb {
    position: relative;
    width: 120px;
    height: 70px;
    border-radius: 12px;
    overflow: hidden;
    background: rgba(6, 10, 20, 0.8);
  }

  .detail-episode-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .detail-episode-thumb img.is-watched {
    opacity: 0.45;
  }

  .detail-episode-fallback {
    width: 100%;
    height: 100%;
    background: linear-gradient(140deg, rgba(59, 130, 246, 0.35), rgba(229, 9, 20, 0.3));
  }

  .detail-episode-status {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(187, 247, 208, 0.9);
    background: rgba(2, 6, 23, 0.6);
  }

  .detail-episode-progress {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 4px;
    background: rgba(248, 250, 252, 0.2);
  }

  .detail-episode-progress div {
    height: 100%;
    background: linear-gradient(90deg, rgba(229, 9, 20, 0.9), rgba(229, 9, 20, 0.6));
  }

  .detail-episode-info {
    display: grid;
    gap: 0.25rem;
  }

  .detail-episode-info span {
    font-size: 0.65rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: rgba(226, 232, 240, 0.55);
  }

  .detail-episode-info strong {
    font-size: 0.95rem;
    font-weight: 600;
  }

  .detail-episode-toggle {
    position: absolute;
    right: 0.85rem;
    top: 50%;
    transform: translateY(-50%);
    border-radius: 0;
    border: none;
    background: transparent;
    color: rgba(226, 232, 240, 0.65);
    width: 34px;
    height: 34px;
    transition: color 0.2s ease, transform 0.2s ease;
  }

  .detail-episode-toggle:hover {
    color: rgba(248, 250, 252, 0.95);
    transform: translateY(-50%) scale(1.06);
  }

  .detail-episode-toggle:focus-visible {
    outline: 2px solid rgba(229, 9, 20, 0.6);
    outline-offset: 3px;
  }

  .detail-muted {
    color: rgba(226, 232, 240, 0.6);
    font-size: 0.9rem;
    margin-top: 0.75rem;
  }

  .detail-empty {
    text-align: center;
    color: rgba(226, 232, 240, 0.6);
    padding: 3rem 1rem;
  }

  @media (min-width: 1200px) {
    .detail-grid {
      grid-template-columns: clamp(240px, 22vw, 300px) minmax(0, 1fr) clamp(240px, 22vw, 300px);
      gap: clamp(1.25rem, 2vw, 2rem);
    }

    .detail-review-sidebar {
      grid-column: 3;
      min-height: 420px;
    }
  }

  @media (max-width: 960px) {
    .detail-main-content {
      grid-column: 1 / -1;
    }

    .detail-review-sidebar {
      min-height: 0;
    }

    .detail-aside {
      order: 1;
    }

    .detail-main {
      order: 3;
    }

    .detail-review-sidebar {
      order: 2;
    }
  }

  @media (max-width: 640px) {
    .detail-header {
      position: relative;
      padding-top: 2.25rem;
    }

    .detail-header-top {
      flex-direction: column;
      align-items: flex-start;
      padding-right: 0;
    }

    .detail-back {
      margin-top: 0;
      margin-bottom: 0.5rem;
    }

    .detail-title {
      font-size: clamp(1.6rem, 8vw, 2.4rem);
    }

    :global(.detail-suggest) {
      position: fixed;
      top: 0.75rem;
      right: 0.75rem;
      z-index: 30;
      margin: 0;
      transform: none;
    }

    .detail-meta {
      font-size: 0.65rem;
      letter-spacing: 0.12em;
    }

    .detail-aside {
      justify-items: center;
      gap: 0.8rem;
    }

    .detail-poster {
      width: min(72vw, 240px);
      justify-self: center;
    }

    .detail-actions {
      width: 100%;
      max-width: 360px;
      margin: 0 auto;
    }

    .detail-episodes {
      max-height: 340px;
    }
  }

  @media (min-width: 641px) {
    .detail-header {
      padding-top: 3.5rem;
    }
  }

  .provider-icon {
    display: inline-block;
    background-color: currentColor;
    -webkit-mask-repeat: no-repeat;
    -webkit-mask-position: center;
    -webkit-mask-size: contain;
    mask-repeat: no-repeat;
    mask-position: center;
    mask-size: contain;
  }

  .provider-icon-youtube {
    -webkit-mask-image: url('/icons/brand-youtube.svg');
    mask-image: url('/icons/brand-youtube.svg');
  }

  .provider-icon-vimeo {
    -webkit-mask-image: url('/icons/brand-vimeo.svg');
    mask-image: url('/icons/brand-vimeo.svg');
  }
</style>
