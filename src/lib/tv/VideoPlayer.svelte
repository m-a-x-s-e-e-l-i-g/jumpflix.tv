<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import type { MediaPlayerElement } from 'vidstack/elements';
  import PlayIcon from 'lucide-svelte/icons/play';
  import PauseIcon from 'lucide-svelte/icons/pause';
  import RotateCcwIcon from 'lucide-svelte/icons/rotate-ccw';
  import VolumeXIcon from 'lucide-svelte/icons/volume-x';
  import Volume2Icon from 'lucide-svelte/icons/volume-2';
  import Maximize2Icon from 'lucide-svelte/icons/maximize-2';
  import Minimize2Icon from 'lucide-svelte/icons/minimize-2';
  import SkipBackIcon from 'lucide-svelte/icons/skip-back';
  import SkipForwardIcon from 'lucide-svelte/icons/skip-forward';

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
      <media-provider data-no-controls></media-provider>

  <media-controls class="player-controls">
        <div class="controls-surface">
          <media-controls-group class="controls-group scrub">
            <media-time-slider class="time-slider" aria-label={title ? `Scrub through ${title}` : 'Scrub through video'}>
              <media-slider-preview class="slider-preview">
                <media-slider-value class="slider-value"></media-slider-value>
              </media-slider-preview>
            </media-time-slider>
          </media-controls-group>

          <div class="controls-row">
            <media-controls-group class="controls-group left">
              <media-play-button class="control-button" aria-label="Toggle playback">
                <span class="icon icon-play"><PlayIcon /></span>
                <span class="icon icon-pause"><PauseIcon /></span>
                <span class="icon icon-replay"><RotateCcwIcon /></span>
              </media-play-button>

              <media-seek-button
                class="control-button"
                seconds={-10}
                aria-label="Jump back 10 seconds"
              >
                <span class="icon"><SkipBackIcon /></span>
                <span class="badge">10s</span>
              </media-seek-button>

              <media-seek-button
                class="control-button"
                seconds={10}
                aria-label="Jump forward 10 seconds"
              >
                <span class="icon"><SkipForwardIcon /></span>
                <span class="badge">10s</span>
              </media-seek-button>

              <div class="time-display" aria-hidden="true">
                <media-time type="current" class="time-value"></media-time>
                <span class="time-divider">/</span>
                <media-time type="duration" class="time-value"></media-time>
              </div>
            </media-controls-group>

            <media-controls-group class="controls-group right">
              <media-mute-button class="control-button" aria-label="Toggle mute">
                <span class="icon icon-muted"><VolumeXIcon /></span>
                <span class="icon icon-unmuted"><Volume2Icon /></span>
              </media-mute-button>

              <media-volume-slider class="volume-slider" aria-label="Adjust volume">
                <media-slider-preview class="slider-preview">
                  <media-slider-value class="slider-value"></media-slider-value>
                </media-slider-preview>
              </media-volume-slider>

              <media-fullscreen-button class="control-button" aria-label="Toggle fullscreen">
                <span class="icon icon-enter"><Maximize2Icon /></span>
                <span class="icon icon-exit"><Minimize2Icon /></span>
              </media-fullscreen-button>
            </media-controls-group>
          </div>
        </div>
      </media-controls>
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

   
  .player-controls {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    padding: clamp(0.75rem, 2vw, 1.5rem);
    opacity: 1;
    pointer-events: auto;
    transition: opacity 160ms ease-in-out;
    z-index: 2;
  }

  .player-controls::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(7, 15, 35, 0.05) 0%, rgba(7, 15, 35, 0.85) 100%);
    opacity: 0.85;
    transition: opacity 180ms ease-in-out;
    pointer-events: none;
  }

  .player-controls:not([data-visible]) {
    opacity: 1;
  }

  .controls-surface {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: clamp(0.75rem, 2vw, 1.25rem);
    width: 100%;
    z-index: 1;
  }

  .controls-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
    gap: clamp(0.75rem, 2vw, 1.5rem);
    flex-wrap: wrap;
  }

  .controls-group {
    display: flex;
    align-items: center;
    gap: clamp(0.65rem, 1.4vw, 1.25rem);
    pointer-events: auto;
  }

  .controls-group.scrub {
    pointer-events: auto;
  }

  .controls-group.left {
    flex: 1 1 auto;
    min-width: 0;
  }

  .controls-group.right {
    justify-content: flex-end;
    flex: 0 0 auto;
  }

  .control-button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.35rem;
    inline-size: clamp(2.5rem, 3.2vw, 2.9rem);
    block-size: clamp(2.5rem, 3.2vw, 2.9rem);
    border-radius: 0.85rem;
    border: 1px solid rgba(126, 160, 255, 0.25);
    background: rgba(10, 16, 40, 0.65);
    color: #f8fafc;
    transition:
      background 140ms ease,
      transform 140ms ease,
      border-color 140ms ease,
      color 140ms ease;
    cursor: pointer;
    box-shadow: 0 10px 30px rgba(10, 16, 40, 0.35);
  }

  .control-button:hover,
  .control-button:focus-visible {
    background: rgba(46, 120, 255, 0.55);
    border-color: rgba(180, 217, 255, 0.75);
    transform: translateY(-1px);
  }

  .control-button:focus-visible {
    outline: none;
    box-shadow:
      0 0 0 2px rgba(24, 36, 84, 0.9),
      0 0 0 4px rgba(104, 183, 255, 0.6);
  }

  .control-button .icon {
    display: none;
    align-items: center;
    justify-content: center;
  }

  :global(.control-button svg) {
    inline-size: 1.35rem;
    block-size: 1.35rem;
  }

  :global(media-play-button.control-button[data-paused] .icon-play),
  :global(media-play-button.control-button[data-ended] .icon-replay) {
    display: inline-flex;
  }

  :global(media-play-button.control-button:not([data-paused]):not([data-ended]) .icon-pause) {
    display: inline-flex;
  }

  :global(media-mute-button.control-button[data-muted] .icon-muted) {
    display: inline-flex;
  }

  :global(media-mute-button.control-button:not([data-muted]) .icon-unmuted) {
    display: inline-flex;
  }

  :global(media-fullscreen-button.control-button[data-active] .icon-exit) {
    display: inline-flex;
  }

  :global(media-fullscreen-button.control-button:not([data-active]) .icon-enter) {
    display: inline-flex;
  }

  .control-button .badge {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.1rem 0.45rem;
    border-radius: 999px;
    font-size: 0.65rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    background: rgba(15, 23, 42, 0.85);
    border: 1px solid rgba(226, 232, 240, 0.18);
  }

  .time-display {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    font-variant-numeric: tabular-nums;
    font-size: clamp(0.85rem, 1.3vw, 1rem);
    color: rgba(226, 232, 240, 0.9);
  }

  .time-divider {
    opacity: 0.65;
  }

  .time-value {
    min-width: 2.75ch;
    text-align: center;
  }

  :global(media-time-slider.time-slider) {
    width: 100%;
    display: block;
    --media-slider-track-height: 6px;
    --media-slider-thumb-size: 16px;
  }

  :global(media-time-slider.time-slider [part~='track']) {
    background: rgba(148, 163, 215, 0.28);
    height: var(--media-slider-track-height);
    border-radius: 999px;
    overflow: hidden;
  }

  :global(media-time-slider.time-slider [part~='track-progress']) {
    background: rgba(255, 255, 255, 0.28);
  }

  :global(media-time-slider.time-slider [part~='track-fill']) {
    background: linear-gradient(90deg, #60a5fa 0%, #c084fc 100%);
  }

  :global(media-time-slider.time-slider [part='thumb']) {
    width: var(--media-slider-thumb-size);
    height: var(--media-slider-thumb-size);
    border-radius: 999px;
    background: #ffffff;
    border: 1px solid rgba(15, 23, 42, 0.4);
    box-shadow: 0 0 0 6px rgba(96, 165, 250, 0.18);
  }

  :global(media-slider-preview.slider-preview) {
    background: rgba(15, 23, 42, 0.9);
    border-radius: 0.5rem;
    border: 1px solid rgba(148, 163, 184, 0.4);
    padding: 0.25rem 0.6rem;
    box-shadow: 0 12px 24px rgba(10, 16, 36, 0.35);
  }

  :global(media-slider-value.slider-value) {
    font-size: 0.75rem;
    font-variant-numeric: tabular-nums;
    color: #f8fafc;
  }

  :global(media-volume-slider.volume-slider) {
    --media-slider-height: 48px;
    --media-slider-track-height: 5px;
    --media-slider-thumb-size: 14px;
    --media-slider-track-bg: rgba(148, 163, 215, 0.3);
    --media-slider-track-fill-bg: linear-gradient(90deg, #facc15 0%, #f97316 100%);
    --media-slider-thumb-bg: #ffffff;
    --media-slider-thumb-border: 1px solid rgba(15, 23, 42, 0.35);
    inline-size: clamp(110px, 12vw, 160px);
  }

  :global(media-volume-slider.volume-slider [part~='track']) {
    background: rgba(148, 163, 215, 0.25);
    height: var(--media-slider-track-height);
    border-radius: 999px;
    overflow: hidden;
  }

  :global(media-volume-slider.volume-slider [part~='track-progress']) {
    background: rgba(255, 255, 255, 0.2);
  }

  :global(media-volume-slider.volume-slider [part~='track-fill']) {
    background: linear-gradient(90deg, #facc15 0%, #f97316 100%);
  }

  :global(media-volume-slider.volume-slider [part='thumb']) {
    width: var(--media-slider-thumb-size);
    height: var(--media-slider-thumb-size);
    border-radius: 999px;
    background: #ffffff;
    border: 1px solid rgba(15, 23, 42, 0.35);
    box-shadow: 0 0 0 5px rgba(250, 204, 21, 0.18);
  }

  @media (max-width: 840px) {
    .controls-row {
      align-items: flex-start;
    }

    .controls-group.right {
      flex: 1 1 100%;
      justify-content: flex-start;
      gap: clamp(0.5rem, 2vw, 0.9rem);
    }

    :global(media-volume-slider.volume-slider) {
      inline-size: clamp(90px, 30vw, 140px);
    }
  }

  @media (max-width: 640px) {
    .vidstack-player {
      aspect-ratio: 16 / 9;
    }

    .player-controls {
      padding: 0.65rem;
    }

    .controls-group.left {
      gap: 0.55rem;
    }

    .control-button {
      inline-size: 2.55rem;
      block-size: 2.55rem;
      border-radius: 0.75rem;
    }

    .control-button .badge {
      display: none;
    }

    :global(media-volume-slider.volume-slider) {
      display: none;
    }
  }
</style>
