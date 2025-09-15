<script lang="ts">
	import { onMount } from 'svelte';
	import MovieCard from '$lib/tv/MovieCard.svelte';
	import PlaylistCard from '$lib/tv/PlaylistCard.svelte';
	import SidebarDetails from '$lib/tv/SidebarDetails.svelte';
	import PlayerModal from '$lib/tv/PlayerModal.svelte';
	import MobileDetailsOverlay from '$lib/tv/MobileDetailsOverlay.svelte';
	import { visibleContent, searchQuery, showPaid, sortBy, selectedContent, showPlayer, showDetailsPanel, selectedIndex, selectContent, openContent, closePlayer, closeDetailsPanel, loadedThumbnails } from '$lib/tv/store';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { sortLabels } from '$lib/tv/utils';
	import type { ContentItem } from '$lib/tv/types';
	import { browser } from '$app/environment';
	import * as m from '$lib/paraglide/messages';

	let isMobile = false;
	let gridEl: HTMLElement;
	let sidebarEl: HTMLElement;
	let headerHeight = 0;
	let sidebarTop = 0;

	function handleSelect(item: ContentItem) {
		selectContent(item);
		if (browser && isMobile) {
			showDetailsPanel.set(true);
			document.documentElement.classList.add('overflow-hidden');
		}
	}
	function handleOpenContent(item: ContentItem) {
		if (browser && isMobile) {
			showDetailsPanel.set(false);
			document.documentElement.classList.remove('overflow-hidden');
		}
		openContent(item);
	}
	$: if (browser) {
		if (isMobile && $showDetailsPanel) document.documentElement.classList.add('overflow-hidden');
		else if (!$showPlayer) document.documentElement.classList.remove('overflow-hidden');
	}
	function openExternalContent(content: ContentItem) { if (content?.externalUrl) window.open(content.externalUrl, '_blank', 'noopener'); }
	let columns = 1;
	function computeColumns(): number {
		if (!gridEl) return 1; const children = Array.from(gridEl.children) as HTMLElement[]; if (!children.length) return 1; const firstTop = children[0].offsetTop; let count = 0; for (const el of children) { if (Math.abs(el.offsetTop - firstTop) < 2) count++; else break; } return count || 1;
	}
	$: if (browser) { columns = computeColumns(); }
	function isTypingTarget(target: EventTarget | null) { if (!(target instanceof HTMLElement)) return false; const tag = target.tagName; if (target.isContentEditable) return true; if ([ 'INPUT', 'TEXTAREA', 'SELECT', 'BUTTON' ].includes(tag)) return true; const role = target.getAttribute('role'); if (role && ['textbox','combobox','button'].includes(role)) return true; return false; }
	function scrollSelectedIntoView(idx: number) { if (!gridEl) return; const el = gridEl.children[idx] as HTMLElement | undefined; if (el) requestAnimationFrame(() => { try { el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' }); } catch {} }); }
	function setIndex(idx: number) { const list = $visibleContent; if (!list.length) return; const clamped = Math.max(0, Math.min(list.length - 1, idx)); selectedIndex.set(clamped); selectedContent.set(list[clamped]); scrollSelectedIntoView(clamped); }
	function handleKeydown(event: KeyboardEvent) { if ($showPlayer && event.key === 'Escape') { closePlayer(); return; } if (event.key === 'Escape' && document.fullscreenElement) { document.exitFullscreen(); closePlayer(); return; } if (isTypingTarget(event.target)) return; if ($showPlayer) return; const list = $visibleContent; if (!list.length) return; const idx = $selectedIndex; const current = $selectedContent; switch (event.key) { case 'ArrowRight': event.preventDefault(); setIndex(idx + 1); break; case 'ArrowLeft': event.preventDefault(); setIndex(idx - 1); break; case 'ArrowDown': event.preventDefault(); setIndex(idx + columns); break; case 'ArrowUp': event.preventDefault(); setIndex(idx - columns); break; case 'Enter': if (current) { event.preventDefault(); openContent(current); } break; } }
	onMount(() => { function updateIsMobile() { isMobile = window.innerWidth < 768; if (!isMobile) showDetailsPanel.set(false); } function updateHeaderHeight() { const header = document.querySelector('header'); headerHeight = header ? header.offsetHeight : 0; updateSidebarPosition(); } function updateSidebarPosition() { if (!sidebarEl || isMobile) return; const scrollTop = window.pageYOffset || document.documentElement.scrollTop; sidebarTop = scrollTop >= headerHeight ? 0 : headerHeight - scrollTop; sidebarEl.style.top = `${sidebarTop}px`; sidebarEl.style.height = `calc(100vh - ${sidebarTop}px)`; } function handleScroll() { updateSidebarPosition(); } updateIsMobile(); updateHeaderHeight(); columns = computeColumns(); const resizeHandler = () => { updateIsMobile(); updateHeaderHeight(); columns = computeColumns(); }; window.addEventListener('resize', resizeHandler); window.addEventListener('scroll', handleScroll); document.addEventListener('keydown', handleKeydown); document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) closePlayer(); }); return () => { document.removeEventListener('keydown', handleKeydown); window.removeEventListener('resize', resizeHandler); window.removeEventListener('scroll', handleScroll); }; });
</script>

<svelte:head>
	<title>JUMPFLIX Parkour Freerunning TV</title>
	<meta name="description" content={m.tv_description()} />
</svelte:head>

<div class="md:-mx-60 min-h-screen bg-background text-foreground tv-page">
	<div class="container mx-auto px-6 py-0 text-center">
		<div class="my-2 flex justify-center">
			<img src="/images/jumpflix-light.webp" alt="JUMPFLIX parkour tv" class="dark:hidden" style="height: 150px; width: auto; max-height: 150px;" loading="eager" />
			<img src="/images/jumpflix-dark.webp" alt="JUMPFLIX parkour tv" class="hidden dark:block" style="height: 150px; width: auto; max-height: 150px;" loading="eager" />
		</div>
		<p class="text-gray-600 dark:text-gray-300" style="font-size:14px;">{m.tv_description()}</p>
	</div>
	<div class="container mx-auto px-6 pt-4">
		<div class="flex flex-wrap items-center gap-3">
			<!-- Search -->
			<div class="relative flex-1 min-w-[260px] group">
				<span class="absolute inset-y-0 left-4 flex items-center pointer-events-none text-gray-400 group-focus-within:text-blue-600 transition-colors z-10">
					<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"/></svg>
				</span>
				{#if $searchQuery}
					<button type="button" class="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors p-1 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-600 z-10" on:click={() => (searchQuery.set(''))} aria-label="Clear search">
						<svg class="w-4 h-4" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
					</button>
				{/if}
				<input bind:value={$searchQuery} type="text" autocomplete="off" spellcheck="false" placeholder={m.tv_searchPlaceholder()} aria-label="Search content" class="w-full h-10 bg-white/80 dark:bg-gray-800/80 border border-gray-200 dark:border-gray-600 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 text-sm focus:outline-none focus:border-gray-300 dark:focus:border-gray-500 transition hover:border-gray-300 dark:hover:border-gray-500" style="padding-left: 3rem; padding-right: 1rem; border-radius: 0.5rem;" />
			</div>

			<!-- Show paid switch -->
			<label class="flex items-center gap-3 select-none bg-white/80 dark:bg-gray-800/80 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2">
				<span class="text-sm text-gray-700 dark:text-gray-300">{m.tv_showPaid()}</span>
				<Switch bind:checked={$showPaid} ariaLabel={m.tv_showPaid()} />
			</label>

			<!-- Sorting -->
			<div class="min-w-[170px]">
				<select 
					bind:value={$sortBy}
					class="appearance-none w-full border bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition"
				>
					{#each Object.entries(sortLabels) as [value, label]}
						<option {value}>{label}</option>
					{/each}
				</select>
			</div>
		</div>

		<!-- Hidden cache to retain already-loaded thumbnails in DOM (helps some browsers keep them in memory) -->
		<div aria-hidden="true" style="position:fixed; width:0; height:0; overflow:hidden; opacity:0; pointer-events:none;">
			{#each Array.from($loadedThumbnails) as src}
				<img src={src} alt="" loading="eager" />
			{/each}
		</div>
	</div>
	<div>
		<div class="container mx-auto px-6 py-6 pr-4 tv-main mt-4">
			<div bind:this={gridEl} class="grid auto-fit-grid gap-4">
				{#if $visibleContent.length === 0}
					<div class="col-span-full text-center text-gray-400 py-8">No results. Try adjusting filters.</div>
				{:else}
					{#each $visibleContent as item (item.type + ':' + item.id)}
						{#if item.type === 'movie'}
							<MovieCard {item} isSelected={!!($selectedContent && $selectedContent.id === item.id && $selectedContent.type === item.type)} onSelect={handleSelect} />
						{:else}
							<PlaylistCard {item} isSelected={!!($selectedContent && $selectedContent.id === item.id && $selectedContent.type === item.type)} onSelect={handleSelect} />
						{/if}
					{/each}
				{/if}
			</div>
		</div>
		<div bind:this={sidebarEl} class="hidden md:flex w-96 border-l border-gray-200 dark:border-gray-700 p-6 fixed right-0 overflow-hidden flex-col bg-white/70 dark:bg-transparent backdrop-blur-sm" style="top: {sidebarTop}px; height: calc(100vh - {sidebarTop}px);">
			<SidebarDetails selected={$selectedContent} openContent={handleOpenContent} openExternal={openExternalContent} />
		</div>
		<MobileDetailsOverlay show={$showDetailsPanel} {isMobile} selected={$selectedContent} openContent={handleOpenContent} openExternal={openExternalContent} {closeDetailsPanel} />
	</div>
</div>
<PlayerModal show={$showPlayer} selected={$selectedContent} close={closePlayer} />

<style>
	/* Only apply hover effects on non-mobile devices */
	@media (min-width: 768px) {
		.tv-page :global(.group:hover img) { filter: brightness(1.05); }
	}

	.auto-fit-grid {
		--card-max: 220px;
		grid-template-columns: repeat(auto-fill, minmax(180px, var(--card-max)));
		justify-content: center;
		justify-items: center;
	}

	.auto-fit-grid > * {
		width: 100%;
		max-width: var(--card-max);
	}

	/* Mobile responsive grid */
	@media (max-width: 767px) {
		.auto-fit-grid {
			--card-min: 120px;
			--card-max: 165px; /* soft cap for visual balance */
			grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
			justify-content: center;
		}

		.auto-fit-grid > * { max-width: var(--card-max); }
	}

	@media (min-width: 768px) {
		.tv-page {
			margin-left: auto;
			margin-right: auto;
		}

		.tv-page .container {
			max-width: 100%;
			width: 100%;
		}

		.tv-page .tv-main {
			width: 100%;
			padding-right: 1rem;
		}
	}

	:global(.tv-layout main) {
		max-width: 100vw;
		padding: 0 1rem 0 0;
		margin: 1rem auto;
	}
</style>
