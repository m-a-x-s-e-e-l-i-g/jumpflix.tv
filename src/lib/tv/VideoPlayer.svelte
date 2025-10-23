<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { MediaPlayerElement } from 'vidstack/elements';

  export let src: string | null = null;
  export let title: string | null = null;
  export let poster: string | null = null;
  export let keySeed: string | number = '';
  export let autoPlay = false;

  let mounted = false;
  let playerEl: MediaPlayerElement | null = null;

  const YOUTUBE_SHORT = /^youtube\/([^\s]+.*)$/i;
  const VIMEO_SHORT = /^vimeo\/([^\s]+.*)$/i;
  const YOUTUBE_DOMAIN = /^(?:https?:\/\/)?(?:(?:www|m)\.)?(?:youtube\.com|youtu\.be|youtube-nocookie\.com)/i;
  const VIMEO_DOMAIN = /^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com/i;
  const HAS_PROTOCOL = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

  onMount(() => {
    mounted = true;
    return () => {
      try {
        playerEl?.destroy?.();
      } catch {
        /* no-op */
      }
    };
  });

  function ensureProtocol(url: string) {
    if (HAS_PROTOCOL.test(url)) return url;
    if (url.startsWith('//')) return `https:${url}`;
    return `https://${url.replace(/^\/+/u, '')}`;
  }

  function normalizeYouTube(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (YOUTUBE_DOMAIN.test(trimmed) || HAS_PROTOCOL.test(trimmed) || trimmed.startsWith('//')) {
      return ensureProtocol(trimmed);
    }
    const [idPart, queryPart] = trimmed.split('?');
    const videoId = idPart.trim();
    if (!videoId) return undefined;
    try {
      const params = queryPart ? new URLSearchParams(queryPart) : null;
      const query = params?.toString() ?? '';
      return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}${query ? `&${query}` : ''}`;
    } catch {
      return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    }
  }

  function normalizeVimeo(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return undefined;
    if (VIMEO_DOMAIN.test(trimmed) || HAS_PROTOCOL.test(trimmed) || trimmed.startsWith('//')) {
      return ensureProtocol(trimmed);
    }
    const [idPart, queryPart] = trimmed.split('?');
    const videoId = idPart.replace(/^\/+/u, '').trim();
    if (!videoId) return undefined;
    const suffix = queryPart ? `?${queryPart}` : '';
    return `https://vimeo.com/${videoId}${suffix}`;
  }

  // Accept short-hand provider prefixes and return full URLs Vidstack can recognise.
  function normalizeSource(raw: string | null) {
    if (!raw) return undefined;
    const trimmed = raw.trim();
    if (!trimmed) return undefined;

    const ytMatch = trimmed.match(YOUTUBE_SHORT);
    if (ytMatch) {
      return normalizeYouTube(ytMatch[1]);
    }

    const vimeoMatch = trimmed.match(VIMEO_SHORT);
    if (vimeoMatch) {
      return normalizeVimeo(vimeoMatch[1]);
    }

    if (YOUTUBE_DOMAIN.test(trimmed)) {
      return ensureProtocol(trimmed);
    }

    if (VIMEO_DOMAIN.test(trimmed)) {
      return ensureProtocol(trimmed);
    }

    return trimmed;
  }

  $: resolvedSrc = normalizeSource(src);
  $: resolvedPoster = poster ?? undefined;
  $: playerTitle = title ?? undefined;
  $: shouldRender = mounted && browser && !!resolvedSrc;
</script>

{#if shouldRender}
  {#key `${keySeed}:${resolvedSrc}`}
    <media-player
      bind:this={playerEl}
      class="vidstack-player"
      src={resolvedSrc}
      title={playerTitle}
      poster={resolvedPoster}
      playsinline
      load="idle"
      autoplay={autoPlay ? true : undefined}
    >
      <media-provider></media-provider>
      <media-video-layout colorScheme="system"></media-video-layout>
    </media-player>
  {/key}
{:else}
  <div class="player-loader" role="status" aria-live="polite">
    <span>Loading player…</span>
  </div>
{/if}

<style>
  .vidstack-player {
    inline-size: 100%;
    block-size: 100%;
    background: #000;
  }

  .player-loader {
    inline-size: 100%;
    block-size: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background: #020617;
    color: #cbd5f5;
    font-size: 0.95rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
</style>
