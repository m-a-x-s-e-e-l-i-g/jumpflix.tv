<script lang="ts">
  import SidebarDetails from '$lib/tv/SidebarDetails.svelte';
  import type { ContentItem, Episode } from '$lib/tv/types';

  export let selected: ContentItem | null;
  export let openContent: (content: ContentItem) => void;
  export let openExternal: (content: ContentItem) => void;
  export let onOpenEpisode: (
    videoId: string,
    title: string,
    episodeNumber?: number,
    seasonNumber?: number
  ) => void;
  export let onSelectEpisode: (
    videoId: string,
    title: string,
    episodeNumber?: number,
    seasonNumber?: number
  ) => void;
  export let selectedEpisode: Episode | null = null;
  export let initialSeasonNumber: number | null = null;
  export let isMobile = false;

  const panelClass = 'hidden md:flex w-[460px] px-6 pt-14 pb-6 fixed right-0 top-0 bottom-0 overflow-y-auto flex-col tv-details-panel';
</script>

<div class={panelClass}>
  <SidebarDetails
    {selected}
    {openContent}
    {openExternal}
    {onOpenEpisode}
    {onSelectEpisode}
    {selectedEpisode}
    {isMobile}
    initialSeason={initialSeasonNumber ?? undefined}
  />
</div>

<style>
  .tv-details-panel {
    border-left: 1px solid rgba(71, 85, 105, 0.35);
    background: linear-gradient(185deg, rgba(15, 23, 42, 0.82), rgba(15, 23, 42, 0.58) 55%, rgba(15, 23, 42, 0.38));
    box-shadow: -35px 0 70px -55px rgba(2, 6, 23, 0.7);
  }

  @media (max-width: 1280px) {
    .tv-details-panel {
      width: 420px;
      padding-right: 1.25rem;
      padding-left: 1.25rem;
    }
  }
</style>
