<script lang="ts">
  import { fade } from 'svelte/transition';
  import { isImage, isInlinePlayable } from './utils';
  import type { ContentItem } from './types';
  import * as m from '$lib/paraglide/messages';
  import { browser } from '$app/environment';
  import { toast } from 'svelte-sonner';
  import Link2Icon from '@lucide/svelte/icons/link-2';
  import { getUrlForItem } from './slug';
  import { Image } from '@unpic/svelte';
  import { dev } from '$app/environment';

  export let show = false;
  export let isMobile = false;
  export let selected: ContentItem | null = null;
  export let closeDetailsPanel: () => void;
  export let openContent: (c: ContentItem) => void;
  export let openExternal: (c: ContentItem) => void;

  async function copyLink() {
    if (!selected) return;
    const path = getUrlForItem(selected);
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
</script>

{#if isMobile && show && selected}
  <div class="md:hidden fixed inset-0 z-40 bg-white/95 dark:bg-black/90 backdrop-blur-xl flex flex-col" transition:fade>
    <div class="flex-1 overflow-y-auto">
      <div class="sticky top-0 z-50 flex items-center justify-between px-4 py-3 bg-white/80 dark:bg-black/70 backdrop-blur border-b border-black/10 dark:border-white/10">
        <button on:click={closeDetailsPanel} class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-white px-3 py-2 rounded-lg bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/20">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/></svg>
          { m.tv_back() }
        </button>
        <h2 class="text-base line-clamp-2 pr-2 pl-2 text-gray-900 dark:text-white" style="margin:0;font-size:.9em!important;">{selected.title}</h2>
      </div>
      <div class="relative">
        {#if isImage(selected.thumbnail)}
          <Image src={selected.thumbnail} alt={selected.title + ' background'} class="w-full h-72 object-cover opacity-60" layout="fullWidth" aspectRatio={2/3} sizes="100vw" cdn={dev ? undefined : 'netlify'} />
        {/if}
        <div class="absolute inset-0 bg-gradient-to-t from-white via-white/70 to-white/10 dark:from-black dark:via-black/60 dark:to-black/10"></div>
        <div class="absolute bottom-4 left-4 right-4">
          <h1 class="mb-2 text-gray-900 dark:text-white font-light" style="font-size:2em!important;font-family: 'Merriweather', serif;">{selected.title}</h1>
          <div class="flex flex-wrap items-center gap-2 text-xs text-gray-700 dark:text-gray-300 mb-3">
            {#if selected.type === 'movie'}
              <span class="bg-blue-600 px-2 py-1 rounded text-white">MOVIE</span>
              {#if selected.paid}<span class="bg-yellow-400 text-black px-2 py-1 rounded font-bold">PAID</span>{/if}
              <span>{(selected as any).year}</span>
              <span>{(selected as any).duration}</span>
            {:else}
              <span class="bg-red-600 px-2 py-1 rounded">PLAYLIST</span>
              <span>{(selected as any).videoCount || '?'} videos</span>
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
      <div class="px-4 pb-28 pt-4 space-y-6">
        <div>
          <p class="text-gray-700 dark:text-gray-200 text-sm leading-relaxed">{selected.description}</p>
        </div>
        {#if selected.type === 'movie'}
          <div>
            <ul class="text-xs text-gray-600 dark:text-gray-300 space-y-1" style="padding-left:0;">
              {#if selected.paid}
                <li class="flex justify-between"><span class="text-gray-500 dark:text-gray-400">Provider</span><span>{selected.provider || 'External'}</span></li>
              {/if}
              {#if (selected as any).creators?.length}
                <li class="flex flex-col gap-1"><span class="text-gray-500 dark:text-gray-400">Creators</span><span>{(selected as any).creators.join(', ')}</span></li>
              {/if}
              {#if (selected as any).starring?.length}
                <li class="flex flex-col gap-1"><span class="text-gray-500 dark:text-gray-400">Starring</span><span>{(selected as any).starring.join(', ')}</span></li>
              {/if}
            </ul>
          </div>
        {:else}
          <div>
            <ul class="text-xs text-gray-600 dark:text-gray-300 space-y-1" style="padding-left:0;">
              {#if (selected as any).creators?.length}
                <li class="flex flex-col"><span class="text-gray-500 dark:text-gray-400">Creators</span><span>{(selected as any).creators.join(', ')}</span></li>
              {/if}
              {#if (selected as any).starring?.length}
                <li class="flex flex-col gap-1"><span class="text-gray-500 dark:text-gray-400">Starring</span><span>{(selected as any).starring.join(', ')}</span></li>
              {/if}
            </ul>
          </div>
        {/if}
      </div>
    </div>
    <div class="p-4 bg-white/90 dark:bg-black/80 backdrop-blur border-t border-black/10 dark:border-white/10">
      <button on:click={() => { if (isInlinePlayable(selected)) openContent(selected); else if (selected?.externalUrl) openExternal(selected); }} class="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 px-4 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2">
        {#if isInlinePlayable(selected)}
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>{ m.tv_playNow() }
        {:else}
          <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path d="M8 5v10l8-5-8-5z"/></svg>{ m.tv_watchOn() } {selected.provider || 'External'}
        {/if}
      </button>
    </div>
  </div>
{/if}
