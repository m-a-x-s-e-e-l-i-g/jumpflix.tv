<script lang="ts">
	import EpisodeSeo from '$lib/components/EpisodeSeo.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
</script>

<EpisodeSeo {data} />
