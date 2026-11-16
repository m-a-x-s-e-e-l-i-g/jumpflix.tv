<script lang="ts">
	import { onMount } from 'svelte';
	import VideoPlayer from '$lib/tv/VideoPlayer.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	type DesktopWindow = Window & { jumpflixPlayerStatus?: (status: string) => void };

	onMount(() => {
		(window as DesktopWindow).jumpflixPlayerStatus?.('hosted-ready');
	});
</script>

<svelte:head>
	<title>{data.title} — JUMPFLIX</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="player-page">
	<VideoPlayer {...data} autoPlay={true} showSpotSuggestion={false} />
</div>

<style>
	.player-page {
		position: fixed;
		inset: 0;
		background: #000;
	}

	.player-page :global(.vidstack-player) {
		width: 100%;
		height: 100%;
	}
</style>
