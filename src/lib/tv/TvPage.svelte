<script lang="ts">
	import { getContext, onMount, tick } from 'svelte';
	import { page } from '$app/stores';
	import { get } from 'svelte/store';
	import { toast } from 'svelte-sonner';
	import * as m from '$lib/paraglide/messages';
	import TvHeroSection from '$lib/tv/TvHeroSection.svelte';
	import TvSearchControls from '$lib/tv/TvSearchControls.svelte';
	import TvCatalogGrid from '$lib/tv/TvCatalogGrid.svelte';
	import TvPageBackdrop from '$lib/tv/TvPageBackdrop.svelte';
	import TvDetailPanel from '$lib/tv/TvDetailPanel.svelte';
	import RatingPromptDialog from '$lib/components/RatingPromptDialog.svelte';
	import { getUserRating } from '$lib/ratings';
	import {
		visibleContent,
		searchQuery,
		showPaid,
		showWatched,
		sortBy,
		gridScale,
		selectedContent,
		showPlayer,
		selectedIndex,
		selectContent,
		openContent,
		closePlayer,
		selectedEpisode,
		openEpisode,
		selectEpisode,
		setContent,
		sortedAllContent,
		selectedFacets
	} from '$lib/tv/store';
	import { getLatestWatchProgressByBaseId } from '$lib/tv/watchHistory';
	import type { ContentItem, Episode, Movie } from '$lib/tv/types';
	import { browser } from '$app/environment';
	import { afterNavigate, beforeNavigate, goto } from '$app/navigation';
	import {
		buildItemUrl,
		buildPageTitle,
		extractSeasonEpisodeFromPath,
		openExternalContent
	} from '$lib/tv/helpers/navigation';
	import { computeColumns } from '$lib/tv/helpers/grid';
	import { SCROLL_CONTEXT_KEY, type ScrollSubscription } from '$lib/scroll-context';

	let {
		content = [],
		initialItem = null,
		initialEpisodeNumber = null,
		initialSeasonNumber = null
	} = $props<{
		content?: ContentItem[];
		initialItem?: ContentItem | null;
		initialEpisodeNumber?: number | null;
		initialSeasonNumber?: number | null;
	}>();

	$effect(() => {
		const pageContent = ($page?.data as any)?.content;
		const items = Array.isArray(pageContent) && pageContent.length ? pageContent : content;
		setContent(items ?? []);
	});

	let isMobile = $state(false);
	let gridEl = $state<HTMLElement | null>(null);
	let currentPath = $state('');
	let pageTitle = $state<string | null>(null);
	let logoTilt = $state(0);
	let columns = $state(1);
	let PlayerModalComponent = $state<any>(null);
	let playerModalLoading = $state(false);
	const subscribeToScroll = getContext<ScrollSubscription | undefined>(SCROLL_CONTEXT_KEY);
	let catalogMinHeight = $state(0);
	let ratingDialogOpen = $state(false);
	let ratingDialogMovie = $state<ContentItem | null>(null);
	let ratingRefreshToken = $state(0);
	let ratingDialogCheckToken = 0;
	let lastCatalogScrollY = 0;
	let restoreCatalogScroll = false;

	const isDetailRoute = $derived(
		$page.url.pathname.startsWith('/movie/') || $page.url.pathname.startsWith('/series/')
	);

	const isDetailPathname = (pathname: string) =>
		pathname.startsWith('/movie/') || pathname.startsWith('/series/');

	async function scrollAfterNav(target: number) {
		if (!browser) return;
		await tick();
		const clamped = Math.max(0, target);
		const applyScroll = () => window.scrollTo(0, clamped);
		requestAnimationFrame(() => {
			applyScroll();
			requestAnimationFrame(() => {
				applyScroll();
				setTimeout(() => {
					if (Math.abs(window.scrollY - clamped) > 2) {
						applyScroll();
					}
				}, 0);
			});
		});
	}

	const selectedForDetail = $derived($selectedContent ?? initialItem ?? null);

	let allowExitBack = false;
	let exitConfirmUntil = 0;

	const EXIT_CONFIRM_TIMEOUT_MS = 2000;

	async function loadPlayerModal() {
		if (PlayerModalComponent || playerModalLoading) return;
		playerModalLoading = true;
		const module = await import('$lib/tv/PlayerModal.svelte');
		PlayerModalComponent = module.default as any;
		playerModalLoading = false;
	}

	function isAndroidStandalone() {
		if (!browser) return false;
		const ua = navigator.userAgent?.toLowerCase?.() ?? '';
		const isAndroid = ua.includes('android');
		const isStandalone =
			window.matchMedia?.('(display-mode: standalone)')?.matches ||
			// iOS legacy; harmless on Android
			(navigator as any).standalone === true;
		return isAndroid && Boolean(isStandalone);
	}

	function armOverviewExitTrap() {
		if (!browser) return;
		if (!isAndroidStandalone()) return;
		if (!isMobile) return;
		if (window.location.pathname !== '/') return;
		if (get(showPlayer)) return;

		const state: any = window.history.state;
		if (state?.jf_exitTrap) return;
		window.history.pushState({ ...state, jf_exitTrap: true }, '', window.location.href);
	}

	if (browser) {
		const initialPage = get(page);
		if (initialPage.url.pathname === '/') {
			const initialQuery = initialPage.url.searchParams.get('q');
			// Only sync from URL when `q` is explicitly present.
			// Otherwise, keep the persisted store value (e.g., localStorage) to avoid
			// clearing the query on mobile back navigation.
			if (initialQuery !== null && initialQuery !== get(searchQuery)) {
				searchQuery.set(initialQuery);
			}
		}
	}

	function nav(url: string, opts?: { replace?: boolean }) {
		goto(url, { replaceState: !!opts?.replace, noScroll: true, keepFocus: true });
	}

	$effect(() => {
		if (!initialItem) return;
		selectContent(initialItem);
		if (
			(initialItem as any).type === 'series' &&
			typeof initialEpisodeNumber === 'number' &&
			Number.isFinite(initialEpisodeNumber)
		) {
			const n = Math.max(1, Math.floor(initialEpisodeNumber));
			selectEpisode({ id: `pos:${n}`, title: `Episode ${n}`, position: n } as any);
		}
	});

	$effect(() => {
		if (!browser) return;
		if ($showPlayer) {
			void loadPlayerModal();
		}
	});

	function handleSelect(item: ContentItem) {
		selectContent(item);
		if (browser) nav(buildItemUrl(item));
	}

	function handleOpenContent(item: ContentItem) {
		if (browser) nav(buildItemUrl(item));
		openContent(item);
	}

	function handleOpenEpisode(
		videoId: string,
		title: string,
		episodeNumber?: number,
		seasonNumber?: number
	) {
		if (browser && $selectedContent && $selectedContent.type === 'series') {
			const url = episodeNumber
				? buildItemUrl($selectedContent, { episodeNumber, seasonNumber: seasonNumber ?? undefined })
				: buildItemUrl($selectedContent, { epId: videoId });
			if (url !== currentPath) nav(url);
		}
		openEpisode({ id: videoId, title, position: episodeNumber });
	}

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

	function buildBaseId(item: ContentItem | null): string | null {
		if (!item) return null;
		if (item.type === 'movie' || item.type === 'series') {
			return `${item.type}:${item.id}`;
		}
		return null;
	}

	function findContentByMediaKey(mediaKey: string | null): ContentItem | null {
		if (!mediaKey) return null;
		const segments = mediaKey.split(':');
		if (segments.length < 2) return null;
		const [rawType, rawId] = segments;
		if (rawType !== 'movie' && rawType !== 'series') return null;
		const numericId = Number(rawId);
		if (!Number.isFinite(numericId)) return null;
		const targetId = String(numericId);
		const catalog = get(sortedAllContent);
		if (!Array.isArray(catalog) || !catalog.length) return null;
		return catalog.find((item) => item.type === rawType && String(item.id) === targetId) ?? null;
	}

	async function openRatingDialogIfNeeded(item: ContentItem) {
		if (!browser || ratingDialogOpen) return;
		const currentCheck = ++ratingDialogCheckToken;
		try {
			const existingRating = await getUserRating(item.id);
			if (currentCheck !== ratingDialogCheckToken) return;
			if (existingRating !== null) {
				return;
			}
			ratingDialogMovie = item;
			ratingDialogOpen = true;
		} catch (error) {
			if (currentCheck === ratingDialogCheckToken) {
				console.error('Failed to verify rating status', error);
				ratingDialogMovie = item;
				ratingDialogOpen = true;
			}
		}
	}

	async function maybePromptForMovieRating(item: ContentItem | null) {
		if (!browser || !item || (item.type !== 'movie' && item.type !== 'series')) return;
		if (ratingDialogOpen) return;
		const baseId = buildBaseId(item);
		if (!baseId) return;
		const latest = getLatestWatchProgressByBaseId(baseId);
		if (latest?.isWatched) {
			await openRatingDialogIfNeeded(item);
		}
	}

	function handlePlayerClose() {
		const current = get(selectedContent);
		if (!ratingDialogOpen) {
			void maybePromptForMovieRating(current);
		}
		closePlayer();
	}

	function handlePlaybackCompleted(
		event: CustomEvent<{
			mediaId: string | null;
			mediaType: 'movie' | 'series' | 'episode';
			content: ContentItem | null;
		}>
	) {
		const detail = event.detail;
		let finished = detail?.content ?? null;

		if (
			(!finished || (finished.type !== 'movie' && finished.type !== 'series')) &&
			detail?.mediaId
		) {
			const fallback = findContentByMediaKey(detail.mediaId);
			if (fallback && (fallback.type === 'movie' || fallback.type === 'series')) {
				finished = fallback;
			}
		}

		if (finished && (finished.type === 'movie' || finished.type === 'series')) {
			void openRatingDialogIfNeeded(finished);
		}
	}

	function handleRatingSaved(
		event: CustomEvent<{
			movieId: string | number;
			rating: number | null;
			summary: { averageRating: number; ratingCount: number };
		}>
	) {
		const detail = event.detail;
		if (!detail) return;
		const current = get(selectedContent);
		if (current && String(current.id) === String(detail.movieId)) {
			ratingRefreshToken += 1;
		}
	}

	$effect(() => {
		if (!browser) return;
		columns = computeColumns(gridEl);
	});

	function handleScaleChange(event: Event) {
		const target = event.target as HTMLInputElement;
		const next = Number(target.value);
		if (!Number.isFinite(next)) return;
		gridScale.set(Math.min(1.25, Math.max(0.8, next)));
	}

	onMount(() => {
		currentPath = `${get(page).url.pathname}${get(page).url.search}`;

		// In Android standalone (installed PWA), require double-back to exit on catalog overview.
		const handlePopState = () => {
			if (!browser) return;
			if (!isAndroidStandalone() || !isMobile) return;

			if (allowExitBack) {
				allowExitBack = false;
				return;
			}

			// Double-back to exit on catalog overview
			if (window.location.pathname === '/' && !get(showPlayer)) {
				const now = Date.now();
				if (now > exitConfirmUntil) {
					exitConfirmUntil = now + EXIT_CONFIRM_TIMEOUT_MS;
					toast.message(m.tv_exitConfirm());
					armOverviewExitTrap();
					return;
				}
				exitConfirmUntil = 0;
				allowExitBack = true;
				window.history.back();
				return;
			}

			exitConfirmUntil = 0;
		};

		window.addEventListener('popstate', handlePopState);

		beforeNavigate((nav) => {
			if (!browser || !nav.from || !nav.to) return;
			const fromPath = nav.from.url.pathname;
			const toPath = nav.to.url.pathname;
			if (fromPath === '/' && isDetailPathname(toPath)) {
				lastCatalogScrollY = window.scrollY;
				restoreCatalogScroll = true;
			}
		});

		afterNavigate((nav) => {
			if (!browser || !nav.from || !nav.to) return;
			const fromPath = nav.from.url.pathname;
			const toPath = nav.to.url.pathname;
			if (fromPath === '/' && isDetailPathname(toPath)) {
				void scrollAfterNav(0);
				return;
			}
			if (restoreCatalogScroll && isDetailPathname(fromPath) && toPath === '/') {
				void scrollAfterNav(lastCatalogScrollY);
				restoreCatalogScroll = false;
			}
		});

		// Lock scroll position when content filters change to prevent jumpy behavior
		let lastScrollY = 0;
		let lockScroll = false;
		const unsubVisible = visibleContent.subscribe(() => {
			if (!browser) return;
			// Save current scroll position before content changes
			lastScrollY = window.scrollY;
			lockScroll = true;
			// Restore scroll position after DOM updates
			requestAnimationFrame(() => {
				if (lockScroll) {
					window.scrollTo(0, lastScrollY);
					lockScroll = false;
				}
			});
		});

		const unsubPage = page.subscribe((p) => {
			currentPath = `${p.url.pathname}${p.url.search}`;
			if (p.url.pathname === '/') {
				const nextQuery = p.url.searchParams.get('q');
				// Only sync from URL when `q` is explicitly present.
				if (nextQuery !== null && nextQuery !== get(searchQuery)) {
					searchQuery.set(nextQuery);
				}

				selectedContent.set(null);
				selectedEpisode.set(null);
				selectedIndex.set(0);
				pageTitle = null;

				armOverviewExitTrap();
			}
		});

		if (initialItem && (initialItem as any).type === 'series') {
			if (initialEpisodeNumber && Number.isFinite(initialEpisodeNumber)) {
				const n = Math.max(1, Math.floor(initialEpisodeNumber));
				selectEpisode({ id: `pos:${n}`, title: `Episode ${n}`, position: n } as any);
			}
		}

		const updateCatalogMinHeight = () => {
			if (!browser) return;
			const searchEl = document.getElementById('search');
			const searchHeight = searchEl?.getBoundingClientRect().height ?? 0;
			const viewportHeight = window.innerHeight;
			catalogMinHeight = Math.max(0, viewportHeight - searchHeight);
		};

		const updateIsMobile = () => {
			const nextIsMobile = window.innerWidth < 768;
			isMobile = nextIsMobile;
		};
		updateIsMobile();
		columns = computeColumns(gridEl);
		updateCatalogMinHeight();

		armOverviewExitTrap();

		const searchEl = document.getElementById('search');
		const searchHeightObserver =
			typeof ResizeObserver !== 'undefined'
				? new ResizeObserver(() => updateCatalogMinHeight())
				: null;
		if (searchHeightObserver && searchEl) {
			searchHeightObserver.observe(searchEl);
		}

		const resizeHandler = () => {
			updateIsMobile();
			columns = computeColumns(gridEl);
			updateCatalogMinHeight();
		};
		window.addEventListener('resize', resizeHandler);
		// Removed fullscreenchange listener that was closing player on fullscreen exit

		const maxTilt = 6.5;
		const LOGO_SCROLL_THRESHOLD = 6; // Only retune tilt when scroll shifts enough to matter visually
		let rafId: number | null = null;
		let lastLogoScroll = -1;
		const applyLogoTilt = (raw: number) => {
			const next = Math.min(maxTilt, Math.max(0, raw / 30));
			logoTilt = next;
		};
		const scheduleLogoTilt = (raw: number, force = false) => {
			if (!force && Math.abs(raw - lastLogoScroll) < LOGO_SCROLL_THRESHOLD) {
				return;
			}
			lastLogoScroll = raw;
			if (rafId !== null) cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(() => {
				applyLogoTilt(raw);
				rafId = null;
			});
		};

		const initialScroll = typeof window === 'undefined' ? 0 : window.scrollY;
		lastLogoScroll = initialScroll;
		applyLogoTilt(initialScroll);

		const cleanupScroll = subscribeToScroll
			? subscribeToScroll((value) => scheduleLogoTilt(value))
			: (() => {
					const fallbackScroll = () => {
						scheduleLogoTilt(window.scrollY);
					};
					window.addEventListener('scroll', fallbackScroll, { passive: true });
					fallbackScroll();
					return () => {
						window.removeEventListener('scroll', fallbackScroll);
					};
				})();
		return () => {
			window.removeEventListener('resize', resizeHandler);
			window.removeEventListener('popstate', handlePopState);
			searchHeightObserver?.disconnect();
			cleanupScroll?.();
			if (rafId !== null) cancelAnimationFrame(rafId);
			unsubPage();
			unsubVisible();
		};
	});

	$effect(() => {
		if (!browser || !$selectedContent || currentPath === '/') return;
		const fromPath = extractSeasonEpisodeFromPath(currentPath);
		const hasEpisodeInPath = typeof fromPath.episode === 'number';
		const episodeHint = hasEpisodeInPath ? fromPath.episode : undefined;
		const seasonHint =
			fromPath.season ??
			(typeof initialSeasonNumber === 'number'
				? Math.max(1, Math.floor(initialSeasonNumber))
				: undefined);
		pageTitle = buildPageTitle($selectedContent, { season: seasonHint, episode: episodeHint });

		const shouldSyncBaseUrl = !($selectedContent.type === 'series' && $selectedEpisode);
		if (shouldSyncBaseUrl) {
			const target = buildItemUrl($selectedContent);
			const current = currentPath;
			if (current !== target) {
				nav(target, { replace: true });
				currentPath = target;
			}
		}
	});

	const priorityKeys = $derived(
		new Set(
			($visibleContent || []).slice(0, Math.max(columns * 2, 8)).map((it) => `${it.type}:${it.id}`)
		)
	);
</script>

<svelte:head>
	{#if pageTitle}
		<title>{pageTitle}</title>
	{/if}
</svelte:head>

<div class="tv-page relative isolate min-h-screen overflow-x-hidden bg-background text-foreground">
	<TvPageBackdrop />
	{#if isDetailRoute}
		<TvDetailPanel
			selected={selectedForDetail}
			openContent={handleOpenContent}
			openExternal={openExternalContent}
			onOpenEpisode={handleOpenEpisode}
			onSelectEpisode={handleSelectEpisode}
			selectedEpisode={$selectedEpisode}
			{initialSeasonNumber}
			{ratingRefreshToken}
		/>
	{:else}
		<section class="relative isolate overflow-hidden pt-24 sm:pt-32">
			<div class="hero-overlay" aria-hidden="true"></div>

			<TvHeroSection {logoTilt} />

			<TvSearchControls {searchQuery} {showPaid} {showWatched} {sortBy} {selectedFacets} />

      {#if !isMobile}
        <div class="catalog-toolbar" aria-label="Catalog view controls">
          <label class="catalog-zoom">
            <span>{m.tv_zoom()}</span>
            <input
              type="range"
              min="0.8"
              max="1"
              step="0.1"
              value={$gridScale}
              oninput={handleScaleChange}
            />
          </label>
        </div>
      {/if}
    </section>
    <div class="catalog-section" style:min-height={catalogMinHeight ? `${catalogMinHeight}px` : undefined}>
      <TvCatalogGrid
        bind:gridElement={gridEl}
        visibleContent={$visibleContent}
        selectedContent={$selectedContent}
        {isMobile}
        priorityKeys={priorityKeys}
        gridScale={isMobile ? 1 : $gridScale}
        onSelect={handleSelect}
      />
    </div>
  {/if}
</div>
{#if $showPlayer}
	{#if PlayerModalComponent}
		<PlayerModalComponent
			show={$showPlayer}
			selected={$selectedContent}
			selectedEpisode={$selectedEpisode}
			close={handlePlayerClose}
			on:playbackCompleted={handlePlaybackCompleted}
		/>
	{:else}
		<div class="player-modal-loading" aria-live="polite">Loading player…</div>
	{/if}
{/if}

<RatingPromptDialog
	bind:open={ratingDialogOpen}
	movie={ratingDialogMovie}
	on:ratingSaved={handleRatingSaved}
/>

<style>
	:global(.tv-page) {
		--hero-gradient: linear-gradient(
			160deg,
			rgba(6, 9, 18, 0.98) 10%,
			rgba(10, 14, 26, 0.95) 55%,
			rgba(8, 13, 24, 1) 100%
		);
		--hero-gradient-opacity: 1;
		--hero-glow-one: radial-gradient(circle at center, rgba(229, 9, 20, 0.55), rgba(229, 9, 20, 0));
		--hero-glow-two: radial-gradient(
			circle at center,
			rgba(37, 99, 235, 0.45),
			rgba(37, 99, 235, 0)
		);
		--hero-grid-line-x: rgba(255, 255, 255, 0.06);
		--hero-grid-line-y: rgba(255, 255, 255, 0.04);
		--hero-grid-opacity: 0.4;
		--hero-glow-page-opacity: 0.6;
		--hero-overlay:
			radial-gradient(circle at 30% 18%, rgba(229, 9, 20, 0.26), transparent 60%),
			radial-gradient(circle at 75% 12%, rgba(37, 99, 235, 0.24), transparent 62%),
			linear-gradient(
				180deg,
				rgba(5, 7, 18, 0.16) 0%,
				rgba(5, 7, 18, 0.12) 55%,
				rgba(5, 7, 18, 0) 100%
			);
		--hero-overlay-blend: screen;
		--hero-logo-text-shadow: 0 16px 35px rgba(2, 6, 23, 0.65);
		--hero-title-gradient: linear-gradient(
			120deg,
			rgba(255, 255, 255, 0.98),
			rgba(229, 9, 20, 0.9) 45%,
			rgba(59, 130, 246, 0.85) 90%
		);
		--hero-title-shadow: 0 18px 40px rgba(2, 6, 23, 0.75);
	}

	.hero-overlay {
		position: absolute;
		inset: 0;
		z-index: -5;
		pointer-events: none;
		background: var(--hero-overlay);
		mix-blend-mode: var(--hero-overlay-blend);
		opacity: 0.92;
	}

	.hero-overlay::after {
		content: '';
		position: absolute;
		inset: 0;
		background: linear-gradient(
			185deg,
			rgba(5, 7, 18, 1) 0%,
			rgba(5, 7, 18, 0.35) 62%,
			rgba(5, 7, 18, 0) 100%
		);
		mix-blend-mode: soft-light;
		pointer-events: none;
	}

	.player-modal-loading {
		position: fixed;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgba(5, 7, 18, 0.9);
		color: #e2e8f0;
		font-size: 1rem;
		letter-spacing: 0.02em;
		z-index: 50;
	}

	@media (min-width: 768px) {
		:global(.tv-page .group:hover img) {
			filter: brightness(1.05);
		}

		:global(.tv-page) {
			margin-left: auto;
			margin-right: auto;
		}

		:global(.tv-page .container) {
			max-width: 100%;
			width: 100%;
		}

		:global(.tv-page .tv-main) {
			width: 100%;
		}
	}

	.catalog-toolbar {
		margin-top: 1.25rem;
		display: flex;
		justify-content: flex-end;
		padding: 0 clamp(1.5rem, 3vw, 3.75rem);
	}

	.catalog-zoom {
		display: inline-flex;
		align-items: center;
		gap: 0.75rem;
		border-radius: 999px;
		border: 1px solid rgba(248, 250, 252, 0.2);
		background: rgba(8, 12, 24, 0.65);
		padding: 0.45rem 0.9rem;
		font-size: 0.6rem;
		letter-spacing: 0.18em;
		text-transform: uppercase;
		color: rgba(226, 232, 240, 0.75);
	}

	.catalog-zoom input[type='range'] {
		accent-color: rgba(229, 9, 20, 0.9);
		height: 4px;
		width: 140px;
	}

	:global(.tv-layout main) {
		max-width: 100vw;
		padding: 0 1rem 0 0;
		margin: 1rem auto;
	}
</style>
