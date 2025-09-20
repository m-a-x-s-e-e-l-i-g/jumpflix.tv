<script lang="ts">
  import type { ContentItem, Episode } from './types';
  import { isInlinePlayable } from './utils';
  import { getUrlForItem } from './slug';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import Link2Icon from '@lucide/svelte/icons/link-2';
  import * as m from '$lib/paraglide/messages';
  // Fetch via local API to avoid CORS and keep server-side parsing
  
  import { blurhashToCssGradientString } from '@unpic/placeholder';
  import { posterBlurhash } from '$lib/assets/blurhash';
  import { fade } from 'svelte/transition';
  export let selected: ContentItem | null;
  export let openContent: (c: ContentItem) => void;
  export let openExternal: (c: ContentItem) => void;
  // Callback to play a specific episode (id, title)
  export let onOpenEpisode: (videoId: string, title: string) => void;
  // Select an episode without playing
  export let onSelectEpisode: (videoId: string, title: string) => void;
  // Currently selected episode (for highlighting)
  export let selectedEpisode: Episode | null = null;

  // UI state for expanding long name lists
  let showAllCreators = false;
  let showAllStarring = false;
  const MAX_NAMES = 8; // number of names to show before collapsing

  // Reset expansion state when selection changes
  $: if (selected) {
    showAllCreators = false;
    showAllStarring = false;
  }

  // Episodes for series
  let episodes: Episode[] = [];
  let loadingEpisodes = false;
  // Abort/race handling for fetches when switching series quickly
  let _episodesController: AbortController | null = null;
  let _episodesFetchVersion = 0;
  $: playlistId = selected?.type === 'series' ? (selected as any).playlistId as string | undefined : undefined;
  // Fetch only when playlistId changes
  $: if (playlistId) {
    loadingEpisodes = true;
    episodes = [];
    _episodesController?.abort();
    _episodesController = new AbortController();
    const version = ++_episodesFetchVersion;
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
  $: if (episodes && episodes.length > 0) {
    const cur = selectedEpisode?.id;
    const exists = cur && episodes.some(e => e.id === cur);
    if (!exists) Promise.resolve().then(() => onSelectEpisode(episodes[0].id, episodes[0].title));
  }

  // BlurHash placeholder background for selected thumbnail
  $: blurhash = selected?.blurhash || (selected?.thumbnail ? posterBlurhash[selected.thumbnail] : undefined);
  $: background = blurhash ? blurhashToCssGradientString(blurhash) : undefined;

  async function copyLink() {
    if (!selected) return;
    const path = getUrlForItem(selected);
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
      <div class="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 dark:from-blue-600 dark:to-purple-700 scale-110" transition:fade={{ duration: 250 }}></div>
    {/if}
    <div class="absolute inset-0 backdrop-blur-2xl bg-white/70 dark:bg-black/70 border-l border-black/10 dark:border-white/10"></div>
  </div>
  <div class="space-y-4 relative z-10 flex-1">
    <div>
  <h2 class="text-3xl font-serif font-light text-gray-900 dark:text-gray-100 tracking-wide mb-4">{selected.title}</h2>
      <div class="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
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
  <p class="text-gray-700 dark:text-gray-300 leading-relaxed text-sm font-sans">{selected.description}</p>
    </div>
    {#if selected.type === 'movie'}
      <div class="space-y-2 text-sm">
        <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Type:</span><span class="text-gray-900 dark:text-white">Documentary</span></div>
        {#if selected.paid}
          <div class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Provider:</span><span class="text-gray-900 dark:text-white">{selected.provider || 'External'}</span></div>
        {/if}
        {#if (selected as any).creators?.length}
          <div class="space-y-1">
            <span class="text-gray-500 dark:text-gray-400 block">Creators:</span>
            <div class="flex flex-wrap gap-1">
              {#each (showAllCreators ? (selected as any).creators : (selected as any).creators.slice(0, MAX_NAMES)) as c}
                <span class="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-xs font-medium">{c}</span>
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
            <span class="text-gray-500 dark:text-gray-400 block">Starring:</span>
            <div class="flex flex-wrap gap-1">
              {#each (showAllStarring ? (selected as any).starring : (selected as any).starring.slice(0, MAX_NAMES)) as s}
                <span class="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-xs font-medium">{s}</span>
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
            <span class="text-gray-500 dark:text-gray-400 block">Creators:</span>
            <div class="flex flex-wrap gap-1">
              {#each (showAllCreators ? (selected as any).creators : (selected as any).creators.slice(0, MAX_NAMES)) as c}
                <span class="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-xs font-medium">{c}</span>
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
            <span class="text-gray-500 dark:text-gray-400 block">Starring:</span>
            <div class="flex flex-wrap gap-1">
              {#each (showAllStarring ? (selected as any).starring : (selected as any).starring.slice(0, MAX_NAMES)) as s}
                <span class="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white text-xs font-medium">{s}</span>
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
  <h3 class="text-base font-semibold text-gray-800 dark:text-gray-200 mb-3">{m.tv_episodes()}</h3>
        {#if loadingEpisodes}
          <p class="text-gray-500 dark:text-gray-400 text-sm">Loading episodes…</p>
        {:else if episodes.length === 0}
          <p class="text-gray-500 dark:text-gray-400 text-sm">No episodes found.</p>
        {:else}
          <ul class="max-h-64 overflow-auto pr-2 space-y-2">
            {#each episodes as ep}
              <li>
                <button type="button" class="w-full flex items-center gap-3 p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/10 transition text-left border-2 border-transparent outline-none focus-visible:ring-2 focus-visible:ring-red-500/70 focus-visible:ring-offset-2 {selectedEpisode && selectedEpisode.id === ep.id ? 'bg-red-50 dark:bg-red-900/30 border-2 border-red-500/60' : ''}"
                  on:click={() => onSelectEpisode(ep.id, ep.title)}>
                  <div class="relative w-20 h-12 flex-shrink-0 overflow-hidden rounded">
                    {#if ep.thumbnail}
                      <img src={ep.thumbnail} alt={ep.title} class="w-full h-full object-cover" loading="lazy" decoding="async" />
                    {:else}
                      <div class="w-full h-full bg-gray-300 dark:bg-gray-700"></div>
                    {/if}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-[13px] text-gray-600 dark:text-gray-400">Ep {ep.position}</div>
                    <div class="text-base text-gray-900 dark:text-gray-100 truncate">{ep.title}</div>
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
    <button on:click={() => {
      if (selected?.type === 'series' && selectedEpisode) { onOpenEpisode(selectedEpisode.id, selectedEpisode.title); return; }
      if (isInlinePlayable(selected)) openContent(selected);
      else if (selected?.externalUrl) openExternal(selected);
    }} class="w-full bg-blue-600/90 hover:bg-blue-500 text-white py-4 px-6 rounded-2xl font-medium tracking-wide transition-colors flex items-center justify-center gap-3 cursor-pointer shadow-lg shadow-blue-900/30 backdrop-blur">
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
  </div>
{:else}
  <div class="absolute inset-0 z-0 bg-white dark:bg-gray-800 border-l border-black/10 dark:border-white/10"></div>
  <div class="text-center text-gray-500 dark:text-gray-400 py-12 relative z-10">
    <svg class="w-16 h-16 mx-auto mb-4 opacity-30" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>
    <p>{m.tv_selectPlaceholder()}</p>
  </div>
{/if}
