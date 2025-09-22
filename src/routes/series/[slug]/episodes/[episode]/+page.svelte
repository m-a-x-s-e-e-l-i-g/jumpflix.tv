<script lang="ts">
  // TvPage is rendered in layout; we only set head tags here
  export let data: { item: any; initialEpisodeNumber: number };
  const item = data?.item;
  const ep = data?.initialEpisodeNumber;
</script>
<!-- Content rendered in layout -->
