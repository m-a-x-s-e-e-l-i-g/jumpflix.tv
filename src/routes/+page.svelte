<script lang="ts">
  import TvPage from '$lib/tv/TvPage.svelte';
  import * as m from '$lib/paraglide/messages';
</script>

<svelte:head>
  <title>🍿 JUMPFLIX Parkour Freerunning TV 📺</title>
  <meta name="description" content={m.tv_description()} />
</svelte:head>

<TvPage initialItem={null} />
