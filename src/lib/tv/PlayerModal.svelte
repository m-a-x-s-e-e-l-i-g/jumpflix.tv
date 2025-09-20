<script lang="ts">
  import { fade, scale } from 'svelte/transition';
  import type { ContentItem, Episode } from './types';
  import { getPlaylistEmbedUrl, getVimeoEmbedUrl, getYouTubeEmbedUrl, isInlinePlayable } from './utils';
  export let show = false;
  export let selected: ContentItem | null = null;
  export let selectedEpisode: Episode | null = null;
  export let close: () => void;
  let playerContainer: HTMLElement;
  export let requestFs: (el: HTMLElement) => void = (el) => el.requestFullscreen?.();
  $: if (show && ((selected && isInlinePlayable(selected)) || selectedEpisode)) {
    setTimeout(() => { if (playerContainer) requestFs(playerContainer); }, 100);
  }
</script>

{#if show && selected}
  <div bind:this={playerContainer} class="fixed inset-0 bg-black z-50 flex items-center justify-center" transition:fade={{ duration: 300 }} on:click={close} role="dialog" aria-modal="true" tabindex="0" on:keydown={(e)=> e.key==='Escape' && close()}>
    <div class="relative w-full h-full bg-black" transition:scale={{ duration: 300 }} on:click|stopPropagation role="presentation">
      <button on:click={close} class="absolute top-4 right-4 z-10 bg-black/50 hover:bg-black/70 text-white p-2 rounded-full transition-colors" aria-label="Close player">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      {#if selectedEpisode}
        <iframe src={getYouTubeEmbedUrl(selectedEpisode.id)} title={selectedEpisode.title} class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      {:else if selected.type === 'movie' && (selected as any).videoId}
        <iframe src={getYouTubeEmbedUrl((selected as any).videoId)} title={selected.title} class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      {:else if selected.type === 'movie' && (selected as any).vimeoId}
        <iframe src={getVimeoEmbedUrl((selected as any).vimeoId)} title={selected.title} class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      {:else if selected.type === 'series' && (selected as any).playlistId}
        <iframe src={getPlaylistEmbedUrl((selected as any).playlistId)} title={selected.title} class="w-full h-full" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
      {:else}
        <div class="w-full h-full flex items-center justify-center text-gray-300"><p>Not available for inline playback. Opening external provider…</p></div>
      {/if}
    </div>
  </div>
{/if}
