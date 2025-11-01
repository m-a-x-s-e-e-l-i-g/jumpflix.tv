<script lang="ts">
  import type { ContentItem, Episode } from './types';
  import { isInlinePlayable } from './utils';
  import { getUrlForItem, getEpisodeUrl } from './slug';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import * as Select from "$lib/components/ui/select/index.js";
  import Link2Icon from '@lucide/svelte/icons/link-2';
  import * as m from '$lib/paraglide/messages';  
  import { blurhashToCssGradientString } from '@unpic/placeholder';
  import { fade } from 'svelte/transition';
  import { decode } from 'html-entities';
  import { showPlayer } from '$lib/tv/store';
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

  // UI state for expanding long name lists
  let showAllCreators = false;
  let showAllStarring = false;
  const MAX_NAMES = 8; // number of names to show before collapsing

  // Reset expansion state when selection changes
  $: if (selected) {
    showAllCreators = false;
    showAllStarring = false;
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
  $: playlistId = selected?.type === 'series'
    ? (selected as any).seasons?.find((s: any) => s.seasonNumber === selectedSeasonNum)?.playlistId as string | undefined
    : undefined;
  // Fetch only when playlistId changes
  // Avoid duplicate fetches on mobile; MobileDetailsOverlay handles fetching when open
  $: if (browser && playlistId && !isMobile) {
    loadingEpisodes = true;
    episodes = [];
    _episodesController?.abort();
    _episodesController = new AbortController();
    const version = ++_episodesFetchVersion;
    // Add a client-side timeout so we don't get stuck if the upstream hangs
    const timeoutId = setTimeout(() => { try { _episodesController?.abort(); } catch {} }, 10000);
    fetch(`/api/series/${encodeURIComponent(playlistId)}/episodes`, { signal: _episodesController.signal })
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
  $: blurhash = selected?.blurhash;
  $: background = blurhash ? blurhashToCssGradientString(blurhash) : undefined;

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
  <div class="absolute inset-0 z-0">
    <!-- BlurHash placeholder layer -->
    {#if background}
      {#key background}
        <div
          class="absolute inset-0"
          style:background-image={background}
          style:background-size="cover"
          style:background-position="center"
          transition:fade={{ duration: 250 }}
        ></div>
      {/key}
    {:else}
      <div class="w-full h-full bg-gradient-to-br from-blue-600 to-purple-700 scale-110" transition:fade={{ duration: 250 }}></div>
    {/if}
  <div class={backdropOverlayClass}></div>
  </div>
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
          <span>{(selected as any).videoCount || '?'} episodes</span>
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
    {#if selected.type === 'movie'}
      <div class="space-y-2 text-sm">
        {#if selected.paid}
          <div class="flex justify-between"><span class="text-gray-400">Provider:</span><span class="text-white">{selected.provider || 'External'}</span></div>
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
      <div class="space-y-2 text-sm">
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
              onSelectEpisode(`pos:1`, 'Episode 1', 1, Number.isFinite(next) ? Math.max(1, next) : 1);
              // Scroll the list to the top for a clean start
              Promise.resolve().then(() => { try { episodesListEl?.scrollTo({ top: 0, behavior: 'smooth' }); } catch {} });
            }}
          >
            {#each (selected as any).seasons as s}
              <option value={s.seasonNumber} class="bg-black text-gray-100">Season {s.seasonNumber}</option>
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
              <li>
                <button type="button" class="w-full flex items-center gap-3 p-1.5 rounded hover:bg-white/10 transition text-left border-2 border-transparent outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 {selectedEpisode && selectedEpisode.id === ep.id ? 'bg-red-900/30 border-2 border-red-500/60' : ''}"
                  on:click={() => onSelectEpisode(ep.id, decode(ep.title), ep.position, selectedSeason)}>
                  <div class="relative w-20 h-12 flex-shrink-0 overflow-hidden rounded">
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
    {/if}
  </div>
  <div class="relative z-10 pt-4">
    {#if !$showPlayer}
      <button on:click={() => {
      if (selected?.type === 'series' && selectedEpisode) { onOpenEpisode(selectedEpisode.id, decode(selectedEpisode.title), selectedEpisode.position || 1, selectedSeason); return; }
      if (isInlinePlayable(selected)) openContent(selected);
      else if (selected?.externalUrl) openExternal(selected);
  }} class={heroButtonClass}>
      <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>
        {#if selected?.type === 'series'}
        {#if selectedEpisode}
          {m.tv_playSelectedEpisode()}
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

<style>
  .details-backdrop-overlay {
    position: absolute;
    inset: 0;
    border-left: 1px solid rgba(71, 85, 105, 0.38);
    background: linear-gradient(185deg, rgba(15, 23, 42, 0.9) 0%, rgba(15, 23, 42, 0.68) 58%, rgba(15, 23, 42, 0.48) 100%);
    pointer-events: none;
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
