<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import ContentCard from '$lib/tv/ContentCard.svelte';
	import SidebarDetails from '$lib/tv/SidebarDetails.svelte';
	import PlayerModal from '$lib/tv/PlayerModal.svelte';
	import MobileDetailsOverlay from '$lib/tv/MobileDetailsOverlay.svelte';
	import {
		visibleContent,
		visibleKeys,
		sortedAllContent,
		searchQuery,
		showPaid,
		sortBy,
		selectedContent,
		showPlayer,
		showDetailsPanel,
		selectedIndex,
		selectContent,
		openContent,
		closePlayer,
		closeDetailsPanel,
		selectedEpisode,
		openEpisode,
		selectEpisode
	} from '$lib/tv/store';
	import { loadedThumbnails } from '$lib/tv/store';
	import Switch from '$lib/components/ui/Switch.svelte';
	import { sortLabels } from '$lib/tv/utils';
	import type { ContentItem } from '$lib/tv/types';
	import { browser } from '$app/environment';
	import * as m from '$lib/paraglide/messages';
	import { Image } from '@unpic/svelte';
	import { dev } from '$app/environment';
	import { goto } from '$app/navigation';
	import { getUrlForItem, getEpisodeUrl } from '$lib/tv/slug';

	export let initialItem: ContentItem | null = null;
	export let initialEpisodeNumber: number | null = null;
	export let initialSeasonNumber: number | null = null;

	let isMobile = false;
	let gridEl: HTMLElement;
	// Track how selection was changed to decide if URL should sync
	let lastSelectionSource: 'keyboard' | 'click' | 'programmatic' = 'programmatic';
	let currentPath = '';
	let pageTitle: string | null = null;

	// ————————————————————————————————————————————————————————————————
	// Small helpers to deduplicate selection/navigation logic
	function buildItemUrl(
		item: ContentItem,
		opts?: { epId?: string; episodeNumber?: number; seasonNumber?: number }
	) {
		const base = getUrlForItem(item);
		// Prefer pretty episode URL when possible
		const path =
			item.type === 'series' && typeof opts?.episodeNumber === 'number'
				? getEpisodeUrl(item as any, {
						episodeNumber: Math.max(1, Math.floor(opts!.episodeNumber!)),
						seasonNumber: opts?.seasonNumber
					})
				: base;
		// Build query params. IMPORTANT: Do NOT carry forward the search query (`q`).
		// We intentionally keep the URL clean of the search query on any update.
		const params = new URLSearchParams();
		if (item.type === 'series' && !opts?.episodeNumber && opts?.epId) params.set('ep', opts.epId);
		const query = params.toString();
		return `${path}${query ? `?${query}` : ''}`;
	}
	function nav(url: string, opts?: { replace?: boolean }) {
		// Use SvelteKit's navigation for consistent URL updates and store sync.
		goto(url, { replaceState: !!opts?.replace, noScroll: true, keepFocus: true });
	}
	function setMobileDetails(open: boolean) {
		if (!browser) return;
		showDetailsPanel.set(open);
		const cls = 'overflow-hidden';
		if (open) document.documentElement.classList.add(cls);
		else if (!$showPlayer) document.documentElement.classList.remove(cls);
	}

	// Select incoming initial item/episode reactively (supports layout-provided changes on navigation)
	$: if (browser) {
		if (initialItem) {
			selectContent(initialItem);
			if (window.innerWidth < 768) {
				setMobileDetails(true);
			}
			// Apply initial episode/season for series when provided
			if ((initialItem as any).type === 'series') {
				if (typeof initialEpisodeNumber === 'number' && Number.isFinite(initialEpisodeNumber)) {
					const n = Math.max(1, Math.floor(initialEpisodeNumber));
					selectEpisode({ id: `pos:${n}`, title: `Episode ${n}`, position: n } as any);
				}
			}
		}
	}

	function handleSelect(item: ContentItem) {
		// Clicking selects and syncs URL (navigation), but avoids scroll/focus jumps
		lastSelectionSource = 'click';
		selectContent(item);
		if (browser) nav(buildItemUrl(item));
		if (browser && isMobile) setMobileDetails(true);
	}
	function handleOpenContent(item: ContentItem) {
		if (browser && isMobile) setMobileDetails(false);
		// Ensure URL matches opened content
		if (browser) nav(buildItemUrl(item));
		openContent(item);
	}

	// Opening an episode from the details panel opens the player and updates URL
	function handleOpenEpisode(
		videoId: string,
		title: string,
		episodeNumber?: number,
		seasonNumber?: number
	) {
		if (browser && isMobile) setMobileDetails(false);
		// Update URL to include the selected episode for series
		if (browser && $selectedContent && $selectedContent.type === 'series') {
			const url = episodeNumber
				? buildItemUrl($selectedContent, { episodeNumber, seasonNumber: seasonNumber ?? undefined })
				: buildItemUrl($selectedContent, { epId: videoId });
			if (url !== currentPath) nav(url);
		}
		openEpisode({ id: videoId, title, position: episodeNumber });
	}

	// Selecting an episode from the details panel updates selection and URL, but does not open the player
	function handleSelectEpisode(
		videoId: string,
		title: string,
		episodeNumber?: number,
		seasonNumber?: number
	) {
		selectEpisode({ id: videoId, title, position: episodeNumber });
		if (browser && $selectedContent) {
			const url =
				$selectedContent.type === 'series' && episodeNumber
					? buildItemUrl($selectedContent, {
							episodeNumber,
							seasonNumber: seasonNumber ?? undefined
						})
					: buildItemUrl($selectedContent, { epId: videoId });
			if (url !== currentPath) nav(url, { replace: true });
		}
	}
	$: if (browser) {
		if (isMobile && $showDetailsPanel) document.documentElement.classList.add('overflow-hidden');
		else if (!$showPlayer) document.documentElement.classList.remove('overflow-hidden');
	}
	function openExternalContent(content: ContentItem) {
		if (content?.externalUrl) window.open(content.externalUrl, '_blank', 'noopener');
	}

	// Extract season/episode from pretty URLs like /series/<slug>/seasons/1/episodes/7
	function extractSeasonEpisodeFromPath(path: string): { season?: number; episode?: number } {
		const m = path.match(/\/seasons\/(\d+)\/episodes\/(\d+)/);
		if (m) {
			const season = Math.max(1, parseInt(m[1] || '1', 10));
			const episode = Math.max(1, parseInt(m[2] || '1', 10));
			return { season, episode };
		}
		return {};
	}

	// Build a descriptive page title based on the selected content (optionally with S/E)
	function buildPageTitle(item: ContentItem, opts?: { season?: number; episode?: number }): string {
		if (item.type === 'movie') {
			const year = (item as any).year ? ` (${(item as any).year})` : '';
			return `${item.title}${year} — Watch Parkour Film on JUMPFLIX`;
		}
		const s = opts?.season;
		const e = opts?.episode;
		if (typeof e === 'number') {
			const sStr = typeof s === 'number' ? `s${String(s).padStart(2, '0')}` : '';
			const eStr = `e${String(e).padStart(2, '0')}`;
			const code = sStr ? `${sStr}${eStr}` : eStr;
			return `${item.title} ${code} — Watch Parkour Series on JUMPFLIX`;
		}
		return `${item.title} — Watch Parkour Series on JUMPFLIX`;
	}

	// Compute number of columns in the grid based on current layout
	let columns = 1;
	function computeColumns(): number {
		if (!gridEl) return 1;
		const children = Array.from(gridEl.children) as HTMLElement[];
		if (!children.length) return 1;
		// Only consider visible elements (display != none)
		const visibleEls = children.filter((el) => el.offsetParent !== null);
		if (!visibleEls.length) return 1;
		const firstTop = visibleEls[0].offsetTop;
		let count = 0;
		for (const el of visibleEls) {
			if (Math.abs(el.offsetTop - firstTop) < 2) count++;
			else break;
		}
		return count || 1;
	}
	$: if (browser) {
		columns = computeColumns();
	}
	function isTypingTarget(target: EventTarget | null) {
		if (!(target instanceof HTMLElement)) return false;
		const tag = target.tagName;
		if (target.isContentEditable) return true;
		if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag)) return true;
		const role = target.getAttribute('role');
		if (role && ['textbox', 'combobox'].includes(role)) return true;
		return false;
	}

	// Map visible list index to DOM index among all items (skipping hidden ones)
	function getDomIndexForVisibleIndex(vIdx: number) {
		const visibleKeyArray = $visibleContent.map((it) => `${it.type}:${it.id}`);
		const targetKey = visibleKeyArray[vIdx];
		if (!targetKey) return -1;
		const all = $sortedAllContent;
		return all.findIndex((it) => `${it.type}:${it.id}` === targetKey);
	}

	// Ensure the selected item is visible in the grid (if not, scroll it into view)
	function scrollSelectedIntoView(idx: number) {
		if (!gridEl) return;
		const domIdx = getDomIndexForVisibleIndex(idx);
		if (domIdx < 0) return;
		const el = gridEl.children[domIdx] as HTMLElement | undefined;
		if (!el) return;
		// Defer to next frame to ensure DOM has settled before measuring/scrolling
		requestAnimationFrame(() => {
			try {
				const margin = 16; // keep a bit of space from the viewport edges
				const rect = el.getBoundingClientRect();
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				const outsideTop = rect.top < margin;
				const outsideBottom = rect.bottom > vh - margin;
				const outsideLeft = rect.left < margin;
				const outsideRight = rect.right > vw - margin;
				if (outsideTop || outsideBottom || outsideLeft || outsideRight) {
					el.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
				}
			} catch {}
		});
	}

	// Set selection by index in the visible list
	function setIndex(idx: number) {
		const list = $visibleContent;
		if (!list.length) return;
		const clamped = Math.max(0, Math.min(list.length - 1, idx));
		selectedIndex.set(clamped);
		selectedContent.set(list[clamped]);
		scrollSelectedIntoView(clamped);
	}

	// Handle keyboard navigation and actions
	function handleKeydown(event: KeyboardEvent) {
		if ($showPlayer && event.key === 'Escape') {
			closePlayer();
			return;
		}
		if (event.key === 'Escape' && document.fullscreenElement) {
			document.exitFullscreen();
			closePlayer();
			return;
		}
		if (isTypingTarget(event.target)) return;
		if ($showPlayer) return;
		const list = $visibleContent;
		if (!list.length) return;
		const idx = $selectedIndex;
		const current = $selectedContent;
		switch (event.key) {
			case 'ArrowRight':
				event.preventDefault();
				lastSelectionSource = 'keyboard';
				setIndex(idx + 1);
				break;
			case 'ArrowLeft':
				event.preventDefault();
				lastSelectionSource = 'keyboard';
				setIndex(idx - 1);
				break;
			case 'ArrowDown':
				event.preventDefault();
				lastSelectionSource = 'keyboard';
				setIndex(idx + columns);
				break;
			case 'ArrowUp':
				event.preventDefault();
				lastSelectionSource = 'keyboard';
				setIndex(idx - columns);
				break;
			case 'Enter':
				if (current) {
					event.preventDefault();
					lastSelectionSource = 'keyboard';
					openContent(current);
				}
				break;
		}
	}

	onMount(() => {
		// Initialize the currentPath from the page store and subscribe for changes
		currentPath = `${get(page).url.pathname}${get(page).url.search}`;
		const unsubPage = page.subscribe((p) => {
			currentPath = `${p.url.pathname}${p.url.search}`;
		});

		// Initialize search from URL param (?q=...)
		const q = get(page).url.searchParams.get('q') ?? '';
		if (q) searchQuery.set(q);

		// Initialize episode from pretty path: initialEpisodeNumber (preferred)
		if (initialItem && (initialItem as any).type === 'series') {
			if (initialEpisodeNumber && Number.isFinite(initialEpisodeNumber)) {
				const n = Math.max(1, Math.floor(initialEpisodeNumber));
				selectEpisode({ id: `pos:${n}`, title: `Episode ${n}`, position: n } as any);
			}
		}

		function updateIsMobile() {
			isMobile = window.innerWidth < 768;
			if (!isMobile) showDetailsPanel.set(false);
		}
		updateIsMobile();
		columns = computeColumns();
		const resizeHandler = () => {
			updateIsMobile();
			columns = computeColumns();
		};
		window.addEventListener('resize', resizeHandler);
		document.addEventListener('keydown', handleKeydown);
		document.addEventListener('fullscreenchange', () => {
			if (!document.fullscreenElement) closePlayer();
		});

		return () => {
			document.removeEventListener('keydown', handleKeydown);
			window.removeEventListener('resize', resizeHandler);
			unsubPage();
		};
	});

	// Keep the URL in sync with the currently selected content.
	$: if (browser && $selectedContent) {
		// Always keep the document title in sync with the selection (include S/E if available)
		const fromPath = extractSeasonEpisodeFromPath(currentPath);
		const episodeHint =
			$selectedEpisode?.position && Number.isFinite($selectedEpisode.position)
				? Math.max(1, Math.floor($selectedEpisode.position))
				: fromPath.episode;
		const seasonHint =
			fromPath.season ??
			(typeof initialSeasonNumber === 'number'
				? Math.max(1, Math.floor(initialSeasonNumber))
				: undefined);
		pageTitle = buildPageTitle($selectedContent, { season: seasonHint, episode: episodeHint });

		// Only sync URL when not on a specific episode of a series
		const shouldSyncBaseUrl = !($selectedContent.type === 'series' && $selectedEpisode);
		if (shouldSyncBaseUrl) {
			const target = buildItemUrl($selectedContent);
			const current = currentPath;
			if (current !== target) {
				if (lastSelectionSource === 'keyboard') {
					// Avoid navigation to preserve focus; just update the URL
					window.history.replaceState({}, '', target);
					currentPath = target; // keep our local path in sync
				} else {
					// Use SvelteKit navigation so +layout/+page loads run and <svelte:head> updates
					nav(target, { replace: true });
					// Optimistically sync local path to avoid transient mismatch
					currentPath = target;
				}
			}
		}
	}

	// Prioritize first visible posters above the fold even when hidden items remain mounted
	$: priorityKeys = new Set(
		($visibleContent || []).slice(0, Math.max(columns * 2, 8)).map((it) => `${it.type}:${it.id}`)
	);
</script>

<svelte:head>
	{#if pageTitle}
		<title>{pageTitle}</title>
	{/if}
</svelte:head>

<div class="tv-page min-h-screen overflow-x-hidden bg-background text-foreground md:pr-[460px]">
	<div class="container mx-auto px-6 pt-10 text-center">
		<div class="mb-4 flex justify-center">
			<a href="/" aria-label="Go to homepage" data-sveltekit-reload>
				<Image
					src="/images/jumpflix.webp"
					alt="JUMPFLIX parkour tv"
					width={300}
					height={264}
					cdn={dev ? undefined : 'netlify'}
					loading="eager"
					fetchpriority="high"
					decoding="async"
				/>
			</a>
		</div>
		<p class="mx-auto max-w-3xl font-sans text-sm tracking-wide text-gray-400 dark:text-gray-300">
			{m.tv_description()}
		</p>
	</div>
	<div class="container mx-auto px-6 pt-6">
		<div class="flex flex-wrap items-center gap-4">
			<!-- Search -->
			<form class="group relative min-w-[300px] flex-1">
				<span
					class="pointer-events-none absolute inset-y-0 left-4 z-10 flex items-center text-gray-500 transition-colors group-focus-within:text-blue-600 dark:group-focus-within:text-blue-400"
				>
					<svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"
						><path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M21 21l-4.35-4.35M10 18a8 8 0 100-16 8 8 0 000 16z"
						/></svg
					>
				</span>
				{#if $searchQuery}
					<button
						type="button"
						class="absolute inset-y-0 right-3 z-10 flex items-center rounded-md p-1 text-gray-400 transition-colors hover:text-gray-600 focus:ring-2 focus:ring-blue-600 focus:outline-none dark:hover:text-gray-200"
						on:click={() => {
							searchQuery.set('');
						}}
						aria-label="Clear search"
					>
						<svg
							class="h-4 w-4"
							viewBox="0 0 24 24"
							stroke="currentColor"
							fill="none"
							stroke-width="2"
							><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
						>
					</button>
				{/if}
				<input
					bind:value={$searchQuery}
					type="text"
					autocomplete="off"
					spellcheck="false"
					placeholder={m.tv_searchPlaceholder()}
					aria-label="Search content"
					class="h-12 w-full rounded-xl border border-gray-300 bg-white/80 pr-10 text-sm text-gray-900 placeholder-gray-500 backdrop-blur-sm transition focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200 dark:placeholder-gray-400 dark:focus:border-blue-500/70"
					style="padding-left: 3rem;"
				/>
				<!-- Hidden submit to allow pressing Enter in the input to apply URL update without live-sync -->
				<button type="submit" class="hidden" aria-hidden="true" tabindex="-1"></button>
			</form>

			<!-- Show paid switch -->
			<label
				class="flex items-center gap-3 rounded-xl border border-gray-300 bg-white/80 px-4 py-3 backdrop-blur-sm select-none dark:border-gray-700 dark:bg-gray-900/60"
			>
				<span class="text-xs tracking-wide text-gray-700 uppercase dark:text-gray-300"
					>{m.tv_showPaid()}</span
				>
				<Switch bind:checked={$showPaid} ariaLabel={m.tv_showPaid()} />
			</label>

			<!-- Sorting -->
			<div class="relative min-w-[170px]">
				<select
					bind:value={$sortBy}
					class="w-full appearance-none rounded-xl border border-gray-300 bg-white/80 px-4 py-3 pr-10 text-sm text-gray-900 backdrop-blur-sm transition focus:border-gray-400 focus:outline-none dark:border-gray-700 dark:bg-gray-900/60 dark:text-gray-200 dark:focus:border-blue-500/70"
				>
					{#each Object.entries(sortLabels) as [value, label]}
						<option {value}>{label}</option>
					{/each}
				</select>
				<span
					class="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2 text-gray-500 dark:text-gray-400"
					>▾</span
				>
			</div>
		</div>
	</div>
	<div>
		<div class="tv-main container mx-auto mt-2 px-6 py-10">
			<div bind:this={gridEl} class="auto-fit-grid grid gap-6">
				{#if $visibleContent.length === 0}
					<div class="col-span-full py-8 text-center text-gray-400">{m.tv_noResults()}</div>
				{:else}
					{#each $sortedAllContent as item, i (item.type + ':' + item.id)}
						<div class:hidden={!$visibleKeys.has(item.type + ':' + item.id)} class="w-full">
							<ContentCard
								{item}
								isSelected={!!(
									$selectedContent &&
									$selectedContent.id === item.id &&
									$selectedContent.type === item.type
								)}
								onSelect={handleSelect}
								{isMobile}
								priority={priorityKeys.has(item.type + ':' + item.id)}
							/>
						</div>
					{/each}
				{/if}
			</div>
		</div>
		<div
			class="fixed top-0 right-0 bottom-0 hidden w-[460px] flex-col overflow-hidden border-l border-gray-700/50 bg-gradient-to-b from-[#0f172a]/60 to-[#0f172a]/20 px-6 pt-14 pb-6 backdrop-blur-xl md:flex dark:from-gray-900/60 dark:to-gray-900/20"
		>
			<SidebarDetails
				selected={$selectedContent}
				openContent={handleOpenContent}
				openExternal={openExternalContent}
				onOpenEpisode={handleOpenEpisode}
				onSelectEpisode={handleSelectEpisode}
				selectedEpisode={$selectedEpisode}
				initialSeason={initialSeasonNumber ?? undefined}
				{isMobile}
			/>
		</div>
		<MobileDetailsOverlay
			show={$showDetailsPanel}
			{isMobile}
			selected={$selectedContent}
			openContent={handleOpenContent}
			openExternal={openExternalContent}
			onOpenEpisode={handleOpenEpisode}
			onSelectEpisode={handleSelectEpisode}
			selectedEpisode={$selectedEpisode}
			{closeDetailsPanel}
			initialSeason={initialSeasonNumber ?? undefined}
		/>
	</div>
</div>
<PlayerModal
	show={$showPlayer}
	selected={$selectedContent}
	selectedEpisode={$selectedEpisode}
	close={closePlayer}
/>

<style>
	/* Only apply hover effects on non-mobile devices */
	@media (min-width: 768px) {
		.tv-page :global(.group:hover img) {
			filter: brightness(1.05);
		}
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
	@media (max-width: 767px) {
		.auto-fit-grid {
			--card-min: 120px;
			--card-max: 165px;
			grid-template-columns: repeat(auto-fill, minmax(var(--card-min), 1fr));
			justify-content: center;
		}
		.auto-fit-grid > * {
			max-width: var(--card-max);
		}
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
		}
	}
	:global(.tv-layout main) {
		max-width: 100vw;
		padding: 0 1rem 0 0;
		margin: 1rem auto;
	}
	.auto-fit-grid :global([role='button'][tabindex='0']:focus:not(:focus-visible)) {
		outline: none;
		box-shadow: none;
	}
	.auto-fit-grid :global([role='button'][tabindex='0']:focus-visible) {
		outline: none;
		border: none;
	}
</style>
