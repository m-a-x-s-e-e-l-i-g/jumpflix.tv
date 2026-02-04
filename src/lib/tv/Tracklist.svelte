<script lang="ts">
  import type { VideoTrack } from './types';
  import { parseTimecodeToSeconds } from '$lib/utils/timecode';

  export let tracks: VideoTrack[] | null | undefined = undefined;
  export let className = '';

  function formatSecondsToTimecode(totalSeconds: number): string {
    const s = Math.max(0, Math.floor(totalSeconds || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }

  function getTrackStartLabel(track: VideoTrack): string | null {
    const tc = track?.startTimecode;
    if (typeof tc === 'string') {
      const trimmed = tc.trim();
      if (trimmed) {
        const seconds = parseTimecodeToSeconds(trimmed);
        if (seconds === 0) return null;
        return trimmed;
      }
    }

    const offsetSeconds = Number(track?.startOffsetSeconds);
    if (Number.isFinite(offsetSeconds) && offsetSeconds > 0) {
      return formatSecondsToTimecode(offsetSeconds);
    }

    return null;
  }
</script>

{#if Array.isArray(tracks) && tracks.length}
  <div class={`space-y-2 ${className}`.trim()}>
    <span class="text-gray-400 inline-flex items-center gap-1 text-sm">
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
      {#each tracks as t (t.position)}
        {@const startLabel = getTrackStartLabel(t)}
        <li class="flex items-center justify-between gap-3 rounded-lg bg-gray-900/30 border border-gray-700/50 border-l-2 border-l-[#1DB954]/50 px-3 py-2">
          <div class="min-w-0 flex-1">
            {#if startLabel}
              <div class="text-xs text-gray-400 font-mono">{startLabel}</div>
            {/if}
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
