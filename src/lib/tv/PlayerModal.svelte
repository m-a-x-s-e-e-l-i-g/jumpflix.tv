<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import type { ContentItem, Episode } from './types';
	import {
		getPlaylistEmbedUrl,
		getVimeoEmbedUrl,
		getYouTubeEmbedUrl,
		isInlinePlayable
	} from './utils';
	import CastButton from '$lib/components/CastButton.svelte';
	export let show = false;
	export let selected: ContentItem | null = null;
	export let selectedEpisode: Episode | null = null;
	export let close: () => void;
	let playerContainer: HTMLElement;
	export let requestFs: (el: HTMLElement) => void = (el) => el.requestFullscreen?.();
	$: if (show && ((selected && isInlinePlayable(selected)) || selectedEpisode)) {
		setTimeout(() => {
			if (playerContainer) requestFs(playerContainer);
		}, 100);
	}
</script>

{#if show && selected}
	<div
		bind:this={playerContainer}
		class="fixed inset-0 z-50 flex items-center justify-center bg-black"
		transition:fade={{ duration: 300 }}
		on:click={close}
		role="dialog"
		aria-modal="true"
		tabindex="0"
		on:keydown={(e) => e.key === 'Escape' && close()}
	>
		<div
			class="relative h-full w-full bg-black"
			transition:scale={{ duration: 300 }}
			on:click|stopPropagation
			role="presentation"
		>
			<CastButton />
			<button
				on:click={close}
				class="absolute top-4 right-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
				aria-label="Close player"
			>
				<svg class="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M6 18L18 6M6 6l12 12"
					/></svg
				>
			</button>
			{#if selectedEpisode}
				<iframe
					src={getYouTubeEmbedUrl(selectedEpisode.id)}
					title={selectedEpisode.title}
					class="h-full w-full"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe>
			{:else if selected.type === 'movie' && (selected as any).videoId}
				<iframe
					src={getYouTubeEmbedUrl((selected as any).videoId)}
					title={selected.title}
					class="h-full w-full"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe>
			{:else if selected.type === 'movie' && (selected as any).vimeoId}
				<iframe
					src={getVimeoEmbedUrl((selected as any).vimeoId)}
					title={selected.title}
					class="h-full w-full"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe>
			{:else if selected.type === 'series' && (selected as any).playlistId}
				<iframe
					src={getPlaylistEmbedUrl((selected as any).playlistId)}
					title={selected.title}
					class="h-full w-full"
					frameborder="0"
					allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
					allowfullscreen
				></iframe>
			{:else}
				<div class="flex h-full w-full items-center justify-center text-gray-300">
					<p>Not available for inline playback. Opening external provider…</p>
				</div>
			{/if}
		</div>
	</div>
{/if}
