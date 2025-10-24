<script lang="ts">
  import { onMount } from 'svelte';
  import { fade, scale } from 'svelte/transition';
  import { browser } from '$app/environment';
  import type { ContentItem, Episode } from './types';
  import VideoPlayer from '$lib/tv/VideoPlayer.svelte';
  export let show = false;
  export let selected: ContentItem | null = null;
  export let selectedEpisode: Episode | null = null;
  export let close: () => void;
  let isDesktop = false;
  let layoutVersion = 0;
  let overlayStyle = '';
  let isFullscreen = false;
  type PlayerView =
    | { kind: 'video'; src: string; title: string; poster?: string | null; autoPlay: boolean; key: string }
    | { kind: 'message'; text: string };

  const sanitizeTitle = (value?: string | null) => (value?.trim() ? value.trim() : 'Now Playing');

  // Compute CSS variables so the desktop player fills everything except the sidebar.
  function computeDesktopStyle(version: number) {
    version; // ensure Svelte tracks layoutVersion updates
    if (!browser) return {} as Record<string, string>;
    const panel = document.querySelector<HTMLElement>('.tv-details-panel');
    const sidebarWidth = panel?.getBoundingClientRect().width ?? 460;
    return {
      '--player-sidebar-width': `${sidebarWidth}px`,
    } as Record<string, string>;
  }

  function updateOverlayStyle() {
    if (!(browser && show && isDesktop)) {
      overlayStyle = '';
      return;
    }
    const styleVars = computeDesktopStyle(layoutVersion);
    overlayStyle = Object.entries(styleVars)
      .map(([key, value]) => `${key}: ${value}`)
      .join('; ');
  }

  onMount(() => {
    if (!browser) return () => {};
    const mq = window.matchMedia('(min-width: 768px)');
    const handleMatch = () => {
      isDesktop = mq.matches;
      updateOverlayStyle();
    };
    handleMatch();
    mq.addEventListener('change', handleMatch);
    const handleResize = () => {
      layoutVersion += 1;
      updateOverlayStyle();
    };
    window.addEventListener('resize', handleResize);
    const handleFullscreenChange = () => {
      isFullscreen = !!document.fullscreenElement;
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => {
      mq.removeEventListener('change', handleMatch);
      window.removeEventListener('resize', handleResize);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  });

  $: updateOverlayStyle();

  $: playerView = (() => {
    if (!show || !selected) return null;

    const poster = selectedEpisode?.thumbnail ?? (selected as any)?.thumbnail ?? null;
    const baseKey = `${selected.type}:${selected.id ?? 'unknown'}`;
    const deriveVideoView = (src: string, title: string, keySuffix: string, autoPlay = true) => ({
      kind: 'video',
      src,
      title: sanitizeTitle(title),
      poster,
      autoPlay,
      key: `${baseKey}:${keySuffix}`
    } satisfies PlayerView);

    if (selectedEpisode) {
      const episodeId = selectedEpisode.id;
      if (!episodeId) {
        return { kind: 'message', text: 'Episode data is still loading…' } satisfies PlayerView;
      }
      if (episodeId.startsWith?.('pos:')) {
        return { kind: 'message', text: 'Fetching episode details…' } satisfies PlayerView;
      }
      return deriveVideoView(`youtube/${episodeId}`, selectedEpisode.title ?? selected.title, `ep:${episodeId}`);
    }

    if (selected.type === 'movie') {
      const movie: any = selected;
      if (movie.videoId) {
        return deriveVideoView(`youtube/${movie.videoId}`, movie.title ?? selected.title, `yt:${movie.videoId}`);
      }
      if (movie.vimeoId) {
        return deriveVideoView(`vimeo/${movie.vimeoId}`, movie.title ?? selected.title, `vimeo:${movie.vimeoId}`);
      }
      return { kind: 'message', text: 'This movie is only available on its external provider.' } satisfies PlayerView;
    }

    if (selected.type === 'series') {
      return { kind: 'message', text: 'Select an episode to start watching.' } satisfies PlayerView;
    }

    return { kind: 'message', text: 'This content is not available for inline playback yet.' } satisfies PlayerView;
  })();
</script>

{#if show && selected}
  <div
    bind:this={playerContainer}
    class="player-overlay"
    class:desktop={isDesktop}
    style={overlayStyle || undefined}
    transition:fade={{ duration: 300 }}
    on:click={close}
    role="dialog"
    aria-modal="true"
    tabindex="0"
    on:keydown={(e)=> {
      if (e.key === 'Escape' && !document.fullscreenElement) {
        close();
      }
    }}
  >
    <div
      class="player-shell"
      class:desktop={isDesktop}
      transition:scale={{ duration: 300 }}
      on:click|stopPropagation
      role="presentation"
    >
      <button on:click={close} class="player-close" aria-label="Close player">
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/></svg>
      </button>
      {#if playerView?.kind === 'video'}
        <VideoPlayer
          src={playerView.src}
          title={playerView.title}
          poster={playerView.poster ?? null}
          keySeed={playerView.key}
          autoPlay={playerView.autoPlay}
        />
      {:else if playerView?.kind === 'message'}
        <div class="player-fallback"><p>{playerView.text}</p></div>
      {:else}
        <div class="player-fallback"><p>Preparing player…</p></div>
      {/if}
    </div>
  </div>
{/if}

<style>
  .player-overlay {
    position: fixed;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 50;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.9);
    padding: 0;
    cursor: pointer;
  }

  .player-overlay.desktop {
    justify-content: flex-start;
    align-items: stretch;
    right: var(--player-sidebar-width, 460px);
    padding: 0;
    background: linear-gradient(135deg, rgba(4, 7, 22, 0.95), rgba(15, 23, 42, 0.65));
    backdrop-filter: blur(14px);
  }

  .player-shell {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    cursor: default;
    display: flex;
    flex-direction: column;
  }

  .player-shell.desktop {
    flex: 1 1 auto;
    width: calc(100vw - var(--player-sidebar-width, 460px));
    max-width: calc(100vw - var(--player-sidebar-width, 460px));
    height: 100vh;
    border-radius: 0;
    box-shadow: none;
    overflow: hidden;
  }

  .player-shell :global(media-player) {
    flex: 1 1 auto;
  }

  .player-close {
    position: absolute;
    top: 1rem;
    right: 1rem;
    z-index: 10;
    background: rgba(0, 0, 0, 0.55);
    color: #fff;
    padding: 0.5rem;
    border-radius: 9999px;
    transition: background-color 0.2s ease;
  }

  .player-close:hover {
    background: rgba(0, 0, 0, 0.8);
  }

  .player-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: #d1d5db;
    text-align: center;
    padding: 2rem;
    background: linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95));
  }

  @media (max-width: 767px) {
    .player-overlay {
      padding: 0;
    }

    .player-close {
      top: 1.25rem;
      right: 1.25rem;
    }
  }
</style>
