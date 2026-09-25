<script lang="ts">
	import { serializeJsonLd } from '$lib/seo';
	let { value }: { value: unknown } = $props();
</script>

<svelte:head>
	{@html `<script type="application/ld+json">${serializeJsonLd(value)}</script>`}
</svelte:head>
