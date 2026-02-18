<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { fade, scale } from 'svelte/transition';
	import { browser } from '$app/environment';
	import type { ContentItem, Episode } from './types';
	import VideoPlayer from '$lib/tv/VideoPlayer.svelte';
	export let show = false;
	export let selected: ContentItem | null = null;
	export let selectedEpisode: Episode | null = null;
	export let close: () => void;
	let playerContainer: HTMLElement | null = null;
	let currentPlaybackKey: string | null = null;
	let playingContent: ContentItem | null = null;
	let playingEpisode: Episode | null = null;
	const dispatch = createEventDispatcher<{
		playbackCompleted: {
			mediaId: string | null;
			mediaType: 'movie' | 'series' | 'episode';
			content: ContentItem | null;
			episode: Episode | null;
		};
	}>();
	type PlayerView =
		| {
				kind: 'video';
				src: string;
				title: string;
				poster?: string | null;
				autoPlay: boolean;
				key: string;
		  }
		| { kind: 'message'; text: string };

	const sanitizeTitle = (value?: string | null) => (value?.trim() ? value.trim() : 'Now Playing');

	function handlePlaybackCompleted(
		event: CustomEvent<{ mediaId: string | null; mediaType: 'movie' | 'series' | 'episode' }>
	) {
		dispatch('playbackCompleted', {
			mediaId: event.detail?.mediaId ?? null,
			mediaType: event.detail?.mediaType ?? 'movie',
			content: playingContent ?? selected ?? null,
			episode: playingEpisode ?? selectedEpisode ?? null
		});
		close?.();
	}

	onMount(() => {
		if (!browser) return () => {};
		return () => {};
	});

	$: playerView = (() => {
		if (!show || !selected) return null;

		const poster = selectedEpisode?.thumbnail ?? (selected as any)?.thumbnail ?? null;
		const baseKey = `${selected.type}:${selected.id ?? 'unknown'}`;
		const deriveVideoView = (src: string, title: string, keySuffix: string, autoPlay = true) =>
			({
				kind: 'video',
				src,
				title: sanitizeTitle(title),
				poster,
				autoPlay,
				key: `${baseKey}:${keySuffix}`
			}) satisfies PlayerView;

		if (selectedEpisode) {
			const episodeId = selectedEpisode.id;
			if (!episodeId) {
				return { kind: 'message', text: 'Episode data is still loading…' } satisfies PlayerView;
			}
			if (episodeId.startsWith?.('pos:')) {
				return { kind: 'message', text: 'Fetching episode details…' } satisfies PlayerView;
			}
			// Check if episode has an external URL (for paid content on external providers)
			if (selectedEpisode.externalUrl) {
				return {
					kind: 'message',
					text: `This episode is only available on its external provider.`
				} satisfies PlayerView;
			}
			// Only try to play if there's a video ID (not just a database ID)
			if (!episodeId.match(/^\d+$/)) {
				return deriveVideoView(
					`youtube/${episodeId}`,
					selectedEpisode.title ?? selected.title,
					`ep:${episodeId}`
				);
			}
			return {
				kind: 'message',
				text: 'This episode is not available for inline playback.'
			} satisfies PlayerView;
		}

		if (selected.type === 'movie') {
			const movie: any = selected;
			if (movie.videoId) {
				return deriveVideoView(
					`youtube/${movie.videoId}`,
					movie.title ?? selected.title,
					`yt:${movie.videoId}`
				);
			}
			if (movie.vimeoId) {
				return deriveVideoView(
					`vimeo/${movie.vimeoId}`,
					movie.title ?? selected.title,
					`vimeo:${movie.vimeoId}`
				);
			}
			return {
				kind: 'message',
				text: 'This movie is only available on its external provider.'
			} satisfies PlayerView;
		}

		if (selected.type === 'series') {
			return { kind: 'message', text: 'Select an episode to start watching.' } satisfies PlayerView;
		}

		return {
			kind: 'message',
			text: 'This content is not available for inline playback yet.'
		} satisfies PlayerView;
	})();

	// Track which piece of content actually started playback so completion events
	// can reference the correct movie even if sidebar selection changes mid-stream.
	$: {
		if (!show) {
			currentPlaybackKey = null;
			playingContent = null;
			playingEpisode = null;
		} else if (playerView?.kind === 'video') {
			if (playerView.key !== currentPlaybackKey) {
				currentPlaybackKey = playerView.key;
				playingContent = selected ?? null;
				playingEpisode = selectedEpisode ?? null;
			}
		}
	}
</script>

{#if show && selected}
	<div
		bind:this={playerContainer}
		class="player-overlay"
		transition:fade={{ duration: 300 }}
		on:click={close}
		role="dialog"
		aria-modal="true"
		tabindex="0"
		on:keydown={(e) => {
			if (e.key === 'Escape' && !document.fullscreenElement) {
				close();
			}
		}}
	>
		<div
			class="player-shell"
			transition:scale={{ duration: 300 }}
			on:click|stopPropagation
			role="presentation"
		>
			{#if playerView?.kind === 'video'}
				<VideoPlayer
					src={playerView.src}
					title={playerView.title}
					poster={playerView.poster ?? null}
					keySeed={playerView.key}
					autoPlay={playerView.autoPlay}
					onClose={close}
					on:playbackCompleted={handlePlaybackCompleted}
				/>
			{:else if playerView?.kind === 'message'}
				<div class="player-fallback"><p>{playerView.text}</p></div>
			{:else}
				<div class="player-fallback"><p>Preparing player…</p></div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.player-overlay {
		position: fixed;
		inset: 0;
		z-index: 50;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, rgba(4, 7, 22, 0.94), rgba(7, 10, 20, 0.98));
		padding: 0;
		cursor: pointer;
	}

	.player-shell {
		position: relative;
		width: 100%;
		height: 100%;
		background: #000;
		cursor: default;
		display: flex;
		flex-direction: column;
	}

	.player-shell :global(media-player) {
		flex: 1 1 auto;
	}

	.player-fallback {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		height: 100%;
		color: #d1d5db;
		text-align: center;
		padding: 2rem;
		background: linear-gradient(135deg, rgba(30, 41, 59, 0.85), rgba(15, 23, 42, 0.95));
	}

	@media (max-width: 767px) {
		.player-overlay {
			padding: 0;
		}
	}
</style>
