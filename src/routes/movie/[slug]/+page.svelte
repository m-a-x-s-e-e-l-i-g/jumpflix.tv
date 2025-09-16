<script lang="ts">
  import TvPage from '$lib/tv/TvPage.svelte';
  export let data: { item: any };
</script>

<TvPage initialItem={data?.item ?? null} />
