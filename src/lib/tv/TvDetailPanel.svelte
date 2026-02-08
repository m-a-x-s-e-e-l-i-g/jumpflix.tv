<script lang="ts">
  import TvDetailsContent from '$lib/tv/TvDetailsContent.svelte';
  import type { ContentItem, Episode } from '$lib/tv/types';

  let {
    selected,
    openContent,
    openExternal,
    onOpenEpisode,
    onSelectEpisode,
    selectedEpisode = null,
    initialSeasonNumber = null,
    ratingRefreshToken = 0
  } = $props<{
    selected: ContentItem | null;
    openContent: (c: ContentItem) => void;
    openExternal: (c: ContentItem) => void;
    onOpenEpisode: (videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) => void;
    onSelectEpisode: (videoId: string, title: string, episodeNumber?: number, seasonNumber?: number) => void;
    selectedEpisode?: Episode | null;
    initialSeasonNumber?: number | null;
    ratingRefreshToken?: number;
  }>();

</script>

<section class="tv-detail-surface">
  <div class="tv-detail-shell">
    <TvDetailsContent
      {selected}
      {openContent}
      {openExternal}
      {onOpenEpisode}
      {onSelectEpisode}
      {selectedEpisode}
      {ratingRefreshToken}
      initialSeason={initialSeasonNumber ?? undefined}
    />
  </div>
</section>

<style>
  .tv-detail-surface {
    position: relative;
    z-index: 5;
  }

  .tv-detail-shell {
    margin: 0;
    max-width: none;
    padding: 2.75rem clamp(1.5rem, 3vw, 3.75rem) 4.5rem;
    display: grid;
    gap: 2rem;
  }

  @media (max-width: 768px) {
    .tv-detail-shell {
      padding: 2rem 1.25rem 3rem;
    }
  }
</style>
