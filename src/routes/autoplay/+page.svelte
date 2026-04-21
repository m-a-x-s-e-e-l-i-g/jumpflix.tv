<script lang="ts">
	import VideoPlayer from '$lib/tv/VideoPlayer.svelte';
	import { familySafeOnly } from '$lib/tv/store';
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import type { VideoTrack } from '$lib/tv/types';

	type AutoplayEntry = {
		id: string;
		title: string;
		poster: string | null;
		src: string;
		keySeed: string;
		mediaId: number | null;
		mediaType: 'movie' | 'series';
		familySafe: boolean;
		tracks?: VideoTrack[];
	};

	let { data }: { data: { queue?: AutoplayEntry[] } } = $props();

	function shuffleEntries<T>(items: T[]): T[] {
		const next = [...items];
		for (let i = next.length - 1; i > 0; i -= 1) {
			const j = Math.floor(Math.random() * (i + 1));
			[next[i], next[j]] = [next[j], next[i]];
		}
		return next;
	}

	const initialQueue = Array.isArray(data?.queue) ? data.queue : [];
	let queue = $state(initialQueue);
	let currentIndex = $state(0);
	let playbackNonce = $state(0);
	let autoplayPlayerEl = $state<HTMLDivElement | null>(null);
	const familySafeOnlyEnabled = $derived($familySafeOnly);

	const filteredQueue = $derived(
		familySafeOnlyEnabled ? queue.filter((entry) => entry.familySafe !== false) : queue
	);

	const currentEntry = $derived(filteredQueue[currentIndex] ?? null);
	const playerKeySeed = $derived(
		currentEntry ? `${currentEntry.keySeed}:run:${playbackNonce}` : 'autoplay:empty'
	);

	$effect(() => {
		if (!filteredQueue.length) {
			currentIndex = 0;
			return;
		}

		if (currentIndex >= filteredQueue.length) {
			currentIndex = 0;
		}
	});

	async function restoreFullscreenIfNeeded(shouldRestore: boolean) {
		if (!shouldRestore || !browser) return;
		await tick();
		const player = autoplayPlayerEl?.querySelector('media-player') as
			| (HTMLElement & { requestFullscreen?: () => Promise<void> | void })
			| null;
		if (!player) return;
		try {
			if (typeof player.requestFullscreen === 'function') {
				await player.requestFullscreen();
			}
		} catch {
			// Ignore fullscreen restore failures, e.g. browser policy edge cases.
		}
	}

	async function advancePlayback() {
		if (!filteredQueue.length) return;
		const shouldRestoreFullscreen = browser && Boolean(document.fullscreenElement);

		playbackNonce += 1;
		if (filteredQueue.length === 1) {
			await restoreFullscreenIfNeeded(shouldRestoreFullscreen);
			return;
		}

		if (currentIndex >= filteredQueue.length - 1) {
			queue = shuffleEntries(queue);
			currentIndex = 0;
			await restoreFullscreenIfNeeded(shouldRestoreFullscreen);
			return;
		}

		currentIndex += 1;
		await restoreFullscreenIfNeeded(shouldRestoreFullscreen);
	}
	</script>

<svelte:head>
	<title>Session Autoplay — JUMPFLIX</title>
	<meta
		name="description"
		content="Continuous shuffled playback of JUMPFLIX session videos and episodes."
	/>
	<link rel="canonical" href="https://www.jumpflix.tv/autoplay" />
</svelte:head>

{#if currentEntry}
	<div class="autoplay-page">
		<div class="autoplay-player" bind:this={autoplayPlayerEl}>
			<VideoPlayer
				src={currentEntry.src}
				title={currentEntry.title}
				poster={currentEntry.poster}
				keySeed={playerKeySeed}
				mediaId={currentEntry.mediaId}
				mediaType={currentEntry.mediaType}
				tracks={currentEntry.tracks}
				autoPlay={true}
				onClose={null}
				onSkipNext={advancePlayback}
				showSeekControls={false}
				enableSeekGestures={false}
				showSpotSuggestion={false}
				preservePlayerInstance={true}
				cornerBadge={{
					eyebrow: 'Currently playing',
					title: currentEntry.title,
					poster: currentEntry.poster,
					siteLabel: 'on jumpflix.tv'
				}}
				on:playbackCompleted={advancePlayback}
			/>
		</div>
	</div>
{:else}
	<div class="autoplay-empty">
		<p class="autoplay-empty__eyebrow">Session autoplay</p>
		<h1>No playable session videos found.</h1>
		<p>Try again after adding inline-playable content tagged with the Session facet.</p>
		<a href="/">Back to catalog</a>
	</div>
{/if}

<style>
	.autoplay-page {
		position: fixed;
		inset: 0;
		z-index: 40;
		background:
			radial-gradient(circle at top left, rgba(244, 63, 94, 0.18), transparent 32%),
			radial-gradient(circle at top right, rgba(56, 189, 248, 0.16), transparent 28%),
			#020617;
	}

	.autoplay-player {
		position: absolute;
		inset: 0;
	}

	.autoplay-player :global(.vidstack-player) {
		width: 100%;
		height: 100%;
	}

	.autoplay-empty {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 2rem;
		background:
			radial-gradient(circle at top left, rgba(244, 63, 94, 0.14), transparent 30%),
			radial-gradient(circle at top right, rgba(56, 189, 248, 0.12), transparent 25%),
			#020617;
		color: #f8fafc;
		text-align: center;
	}

	.autoplay-empty :global(a) {
		display: inline-flex;
		margin-top: 1rem;
		padding: 0.75rem 1rem;
		border-radius: 999px;
		border: 1px solid rgba(255, 255, 255, 0.16);
		background: rgba(15, 23, 42, 0.82);
		color: inherit;
		text-decoration: none;
	}

	.autoplay-empty__eyebrow {
		margin: 0 0 0.75rem;
		font-size: 0.8rem;
		font-weight: 700;
		letter-spacing: 0.22em;
		text-transform: uppercase;
		color: rgba(248, 250, 252, 0.65);
	}

	.autoplay-empty h1 {
		margin: 0;
		font-size: clamp(1.8rem, 4vw, 3rem);
	}

	.autoplay-empty p {
		margin: 0.8rem 0 0;
		max-width: 34rem;
		color: rgba(226, 232, 240, 0.8);
	}

</style>