<script lang="ts">
  // TvPage is rendered in layout; we only set head tags here
  export let data: { item: any; initialEpisodeNumber: number; initialSeasonNumber: number | null };
  const item = data?.item;
  const ep = data?.initialEpisodeNumber;
  const season = data?.initialSeasonNumber ?? null;
</script>
<!-- Content rendered in layout -->
