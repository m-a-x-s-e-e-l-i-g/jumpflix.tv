<script lang="ts">
	import DetailRoute from '$lib/tv/DetailRoute.svelte';
	import EpisodeSeo from '$lib/components/EpisodeSeo.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<EpisodeSeo {data} />

<DetailRoute />
