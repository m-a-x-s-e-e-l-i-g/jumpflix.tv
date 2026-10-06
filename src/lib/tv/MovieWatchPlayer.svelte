<script lang="ts">
	import { onMount } from 'svelte';
	import { movieVideoSource } from './video-discovery';
	import type { Movie } from './types';

	export let movie: Movie;
	let video: HTMLVideoElement;
	let failed = false;
	$: source = movieVideoSource(movie);

	onMount(() => {
		if (source?.kind !== 'hls' || !video || video.canPlayType('application/vnd.apple.mpegurl'))
			return;
		let disposed = false;
		let hls: import('hls.js').default | undefined;
		const src = source.src;
		void import('hls.js')
			.then(({ default: Hls }) => {
				if (disposed) return;
				if (!Hls.isSupported()) {
					failed = true;
					return;
				}
				hls = new Hls({ autoStartLoad: false });
				hls.on(Hls.Events.ERROR, (_event, data) => {
					if (data.fatal) failed = true;
				});
				hls.loadSource(src);
				hls.attachMedia(video);
				// Manifest/provider is discoverable immediately; segments start when the viewer plays.
				video.addEventListener('play', startLoad);
				if (!video.paused) startLoad();
			})
			.catch(() => {
				if (!disposed) failed = true;
			});
		function startLoad() {
			hls?.startLoad();
		}
		return () => {
			disposed = true;
			video?.removeEventListener('play', startLoad);
			hls?.destroy();
		};
	});
</script>

{#if source}
	<div class="movie-watch-player" data-movie-watch-player>
		{#if source.embedUrl}
			<iframe
				src={source.embedUrl}
				title={movie.title}
				loading="eager"
				allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
				allowfullscreen
			></iframe>
		{:else}
			<!-- svelte-ignore a11y_media_has_caption -->
			<video
				bind:this={video}
				controls
				playsinline
				preload="none"
				poster={movie.thumbnail}
				aria-label={movie.title}
			>
				<source
					src={source.src}
					type={source.kind === 'hls' ? 'application/vnd.apple.mpegurl' : undefined}
				/>
			</video>
		{/if}
	</div>
	{#if failed}<p class="player-fallback">Use Play now below to open the JUMPFLIX player.</p>{/if}
{/if}

<style>
	.movie-watch-player {
		width: 100%;
		max-width: 960px;
		aspect-ratio: 16 / 9;
		background: #000;
		overflow: hidden;
		border-radius: 0.75rem;
	}
	iframe,
	video {
		display: block;
		width: 100%;
		height: 100%;
		border: 0;
	}
	.player-fallback {
		color: #9ca3af;
		font-size: 0.875rem;
	}
</style>
