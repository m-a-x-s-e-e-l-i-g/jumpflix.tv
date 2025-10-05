<script lang="ts">
	import type { ContentItem } from './types';
	import { isImage } from './utils';
	import { Image } from '@unpic/svelte';
	import { blurhashToCssGradientString } from '@unpic/placeholder';
	import { posterBlurhash } from '$lib/assets/blurhash';
	import { dev } from '$app/environment';
	import { loadedThumbnails, markThumbnailLoaded } from '$lib/tv/store';

	export let item: ContentItem;
	export let isSelected = false;
	export let isMobile = false;
	export let onSelect: (item: ContentItem) => void;
	// Prioritize above-the-fold images for fastest first paint
	export let priority = false;

	let error = false;
	$: blurhash = item.blurhash || (item.thumbnail ? posterBlurhash[item.thumbnail] : undefined);
	$: background = blurhash ? blurhashToCssGradientString(blurhash) : undefined;

	$: altSuffix = item.type === 'movie' ? ' poster' : ' thumbnail';

	// no loading lifecycle needed

	function handleLoaded(e: Event) {
		const target = e.target as HTMLImageElement | null;
		const src = target?.currentSrc || target?.src;
		if (src) markThumbnailLoaded(src);
		loaded = true;
	}

	// Local loaded state for fade-in; also consider globally cached loaded thumbnails
	let loaded = false;
	$: alreadyLoaded = item.thumbnail ? $loadedThumbnails.has(item.thumbnail) : false;
	$: if (alreadyLoaded) loaded = true;
	$: imageOpacityClass = loaded ? 'opacity-100' : 'opacity-0';
	const baseImageClass =
		'relative inset-0 w-full h-full object-cover z-10 transition-opacity duration-500 ease-out';
</script>

<div
	class="group cursor-pointer"
	class:transform={!isMobile}
	class:hover:scale-105={!isMobile}
	class:transition-all={!isMobile}
	class:duration-300={!isMobile}
	class:scale-105={!isMobile && isSelected}
	on:click={() => onSelect(item)}
	on:keydown={(e) => e.key === 'Enter' && onSelect(item)}
	tabindex="0"
	role="button"
>
	<div
		class="relative mb-3 aspect-[2/3] overflow-hidden rounded-xl border border-gray-700/60 bg-[#0f172a] shadow-md transition-all duration-300 dark:border-gray-700 dark:bg-gray-800"
		class:group-hover:ring-4={!isMobile}
		class:group-hover:ring-red-400={!isMobile}
		class:ring-4={!isMobile && isSelected}
		class:ring-red-500={!isMobile && isSelected}
		class:group-hover:border-none={!isMobile}
		class:border-none={!isMobile && isSelected}
		title={item.title}
	>
		<!-- Placeholder layer (always present, sits under the poster) -->
		<div
			class="absolute inset-0"
			style:background-image={background}
			style:background-size="cover"
			style:background-position="center"
		></div>
		<div class="pointer-events-none absolute inset-0 flex items-center justify-center">
			<div class="max-w-[90%] text-center">
				<span
					class="overflow-hidden align-middle text-[12px] font-semibold text-ellipsis whitespace-nowrap text-white drop-shadow-md"
					>{item.title}</span
				>
				{#if item.type === 'movie' && item.year}
					<span class="align-middle text-[12px] text-white/80 drop-shadow-md"> ({item.year})</span>
				{/if}
			</div>
		</div>

		{#if isImage(item.thumbnail) && !error}
			<!-- Poster image overlays the placeholder; no special loading handling -->
			<Image
				src={item.thumbnail}
				alt={item.title + altSuffix}
				loading={priority ? 'eager' : 'lazy'}
				fetchpriority={priority ? 'high' : undefined}
				decoding="async"
				width={230}
				height={345}
				class={`${baseImageClass} ${imageOpacityClass}`}
				cdn={dev ? undefined : 'netlify'}
				layout="constrained"
				onload={handleLoaded}
				onerror={() => {
					error = true;
				}}
			/>
		{/if}

		<div class="absolute top-2 left-2 z-20 flex gap-2">
			{#if item.paid}
				<span class="rounded bg-yellow-500 px-2 py-1 text-[10px] font-bold text-black">PAID</span>
			{/if}
		</div>

		<!-- Bottom-right info: duration for movies, episode count for series -->
		<div
			class="absolute right-2 bottom-2 z-20 rounded-md bg-black/60 px-2 py-1 text-[10px] text-white/90 backdrop-blur"
		>
			{#if item.type === 'movie'}
				{item.duration}
			{:else}
				{(item as any).videoCount || '?'} eps
			{/if}
		</div>
	</div>
</div>
