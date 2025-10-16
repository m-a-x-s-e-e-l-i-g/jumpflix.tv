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
</script>

<div class="hidden md:flex w-[460px] border-l border-slate-200/70 dark:border-gray-700/50 px-6 pt-14 pb-6 fixed right-0 top-0 bottom-0 overflow-hidden flex-col bg-gradient-to-b from-white/90 via-white/75 to-white/55 dark:from-[#0f172a]/60 dark:via-[#0f172a]/35 dark:to-[#0f172a]/20 backdrop-blur-xl">
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
