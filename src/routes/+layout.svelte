<script lang="ts">
	import '../app.css';
	import 'vidstack/player/styles/default/theme.css';
	import 'vidstack/player/styles/default/layouts/video.css';
	import 'vidstack/player';
	import 'vidstack/player/layouts/default';
	import 'vidstack/icons';
	import { onMount, setContext } from 'svelte';
	import type { Action } from 'svelte/action';
	import { page } from '$app/stores';
	import { Sheet as SheetRoot, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
	import CogIcon from '@lucide/svelte/icons/cog';
	import GithubIcon from '@lucide/svelte/icons/github';
	import GlobeIcon from '@lucide/svelte/icons/globe';
	import MonitorIcon from '@lucide/svelte/icons/monitor';
	import SunIcon from '@lucide/svelte/icons/sun';
	import MoonIcon from '@lucide/svelte/icons/moon';
	import { Toaster, toast } from 'svelte-sonner';
	import { getLocale, setLocale } from '$lib/paraglide/runtime.js';
	import { m } from '$lib/paraglide/messages.js';
	import TvPage from '$lib/tv/TvPage.svelte';
	import { showDetailsPanel } from '$lib/tv/store';
	import PWAInstallPrompt from '$lib/components/PWAInstallPrompt.svelte';
	import { SCROLL_CONTEXT_KEY, type ScrollSubscriber, type ScrollSubscription } from '$lib/scroll-context';
	// We'll access the underlying custom element via a store reference set in the prompt component
	let pwaInstallRef: any = null;
    
  
	// data from +layout.ts
	let { children, data } = $props<{ children: any; data: { item: any; initialEpisodeNumber: number | null; initialSeasonNumber: number | null } }>();

    
	let isMobile = $state(false);
	// current locale from Paraglide (reactive state)
	let currentLocale: 'en' | 'nl' = $state(getLocale() as any);
	let sheetOpen = $state(false);
	let reduceMotion = $state(false);
	let systemReduceMotion = $state(false);

	let lastScrollY = 0;
	const scrollSubscribers = new Set<ScrollSubscriber>();

	const subscribeToScroll: ScrollSubscription = (subscriber) => {
		scrollSubscribers.add(subscriber);
		subscriber(reduceMotion ? 0 : lastScrollY);
		return () => {
			scrollSubscribers.delete(subscriber);
		};
	};

	setContext(SCROLL_CONTEXT_KEY, subscribeToScroll);

	function notifyScrollSubscribers(value: number) {
		for (const subscriber of scrollSubscribers) {
			subscriber(value);
		}
	}

	function recomputeReduceMotion() {
		const next = systemReduceMotion;
		if (next === reduceMotion) {
			return;
		}
		reduceMotion = next;
		if (typeof window !== 'undefined') {
			updatePopcornTransforms(reduceMotion ? 0 : window.scrollY, true);
		}
	}
	type ThemePreference = 'system' | 'light' | 'dark';

	const langs = [
		{ code: 'en' as const, flag: '🇬🇧', label: 'English' },
		{ code: 'nl' as const, flag: '🇳🇱', label: 'Nederlands' }
	];

	const themeOptions: { value: ThemePreference; icon: typeof MonitorIcon }[] = [
		{ value: 'system', icon: MonitorIcon },
		{ value: 'light', icon: SunIcon },
		{ value: 'dark', icon: MoonIcon }
	];


	type PopcornSpec = {
		id: number;
		left: number;
		top: number;
		size: number;
		depth: number;
		floatDuration: number;
		floatDelay: number;
		sway: number;
		opacity: number;
		rotateBase: number;
		rotateFactor: number;
	};

	const popcorns: PopcornSpec[] = [
		{ id: 0, left: 6, top: -4, size: 160, depth: 0.12, floatDuration: 26, floatDelay: 0, sway: 24, opacity: 0.52, rotateBase: -6, rotateFactor: 0.016 },
		{ id: 1, left: 78, top: 6, size: 120, depth: 0.18, floatDuration: 24, floatDelay: -6, sway: -18, opacity: 0.48, rotateBase: 8, rotateFactor: -0.02 },
		{ id: 2, left: 52, top: 18, size: 190, depth: 0.32, floatDuration: 30, floatDelay: -12, sway: 28, opacity: 0.4, rotateBase: -12, rotateFactor: 0.014 },
		{ id: 3, left: 18, top: 42, size: 130, depth: 0.46, floatDuration: 28, floatDelay: -3, sway: 16, opacity: 0.36, rotateBase: 5, rotateFactor: -0.018 },
		{ id: 4, left: 64, top: 54, size: 176, depth: 0.26, floatDuration: 32, floatDelay: -15, sway: -22, opacity: 0.42, rotateBase: -3, rotateFactor: 0.017 },
		{ id: 5, left: 88, top: 70, size: 140, depth: 0.38, floatDuration: 22, floatDelay: -9, sway: 14, opacity: 0.35, rotateBase: 10, rotateFactor: -0.015 },
		{ id: 6, left: 34, top: 78, size: 164, depth: 0.22, floatDuration: 27, floatDelay: -5, sway: -20, opacity: 0.44, rotateBase: -8, rotateFactor: 0.019 }
	];
	const mobilePopcorns = popcorns.slice(0, 4);
	const activePopcorns = $derived(isMobile ? mobilePopcorns : popcorns);

	const PARALLAX_STRENGTH = 0.06;
	const SCROLL_UPDATE_THRESHOLD = 6; // Minimum scroll delta (px) before refreshing parallax to cut down style recalculations
	type PopcornEntry = {
		node: HTMLElement;
		spec: PopcornSpec;
		lastTranslate: number;
		lastRotate: number;
	};

	const popcornEntries = new Set<PopcornEntry>();

	function applyPopcornTransform(entry: PopcornEntry, scrollValue: number, motionReduced: boolean) {
		const { node, spec } = entry;
		if (!node) return;
		if (motionReduced) {
			node.style.transform = `translate3d(0, 0, 0) rotate(${spec.rotateBase}deg)`;
			entry.lastTranslate = 0;
			entry.lastRotate = spec.rotateBase;
			return;
		}
		const translateY = scrollValue * spec.depth * PARALLAX_STRENGTH;
		const rotate = spec.rotateBase + scrollValue * spec.rotateFactor;
		if (Math.abs(entry.lastTranslate - translateY) < 0.1 && Math.abs(entry.lastRotate - rotate) < 0.1) {
			return;
		}
		node.style.transform = `translate3d(0, ${translateY}px, 0) rotate(${rotate}deg)`;
		entry.lastTranslate = translateY;
		entry.lastRotate = rotate;
	}

	function updatePopcornTransforms(scrollValue: number, force = false) {
		const effective = reduceMotion ? 0 : scrollValue;
		if (!force && Math.abs(effective - lastScrollY) < SCROLL_UPDATE_THRESHOLD) {
			return;
		}
		lastScrollY = effective;
		for (const entry of popcornEntries) {
			applyPopcornTransform(entry, effective, reduceMotion);
		}
		notifyScrollSubscribers(effective);
	}

	const popcornParallax: Action<HTMLElement, PopcornSpec> = (node, spec) => {
		const entry: PopcornEntry = { node, spec, lastTranslate: 0, lastRotate: spec.rotateBase };
		popcornEntries.add(entry);
		applyPopcornTransform(entry, reduceMotion ? 0 : lastScrollY, reduceMotion);
		return {
			update(newSpec: PopcornSpec) {
				entry.spec = newSpec;
				entry.lastRotate = newSpec.rotateBase;
				applyPopcornTransform(entry, reduceMotion ? 0 : lastScrollY, reduceMotion);
			},
			destroy() {
				popcornEntries.delete(entry);
			}
		};
	};

	const themeCopy: Record<'en' | 'nl', { heading: string; system: string; light: string; dark: string; toast: (label: string) => string }> = {
		en: {
			heading: 'Theme',
			system: 'System',
			light: 'Light',
			dark: 'Dark',
			toast: (label) => `Theme changed to ${label}`
		},
		nl: {
			heading: 'Thema',
			system: 'Systeem',
			light: 'Licht',
			dark: 'Donker',
			toast: (label) => `Thema gewijzigd naar ${label}`
		}
	};

	let themePreference = $state<ThemePreference>('dark');
	let prefersDarkQuery: MediaQueryList | null = null;

	function themeLabel(value: ThemePreference): string {
		const copy = themeCopy[currentLocale] ?? themeCopy.en;
		if (value === 'light') return copy.light;
		if (value === 'dark') return copy.dark;
		return copy.system;
	}

	function themeHeading(): string {
		return (themeCopy[currentLocale] ?? themeCopy.en).heading;
	}

	if (typeof window !== 'undefined') {
		isMobile = window.innerWidth < 768;
		const storedTheme = localStorage.getItem('theme');
		if (storedTheme === 'light' || storedTheme === 'dark' || storedTheme === 'system') {
			themePreference = storedTheme as ThemePreference;
		}
	}

	function addEventListeners(): () => void {
		if (typeof window === 'undefined') return () => {};
		const updateSize = () => { isMobile = window.innerWidth < 768; };
		updateSize();
		window.addEventListener('resize', updateSize);
		return () => { window.removeEventListener('resize', updateSize); };
	}

	function initializeTheme(): () => void {
		if (typeof window === 'undefined') return () => {};
		prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleSystemTheme = (event: MediaQueryListEvent) => {
			if (themePreference === 'system') {
				applyTheme('system', event.matches);
			}
		};
		prefersDarkQuery.addEventListener('change', handleSystemTheme);
		applyTheme(themePreference);
		return () => { prefersDarkQuery?.removeEventListener('change', handleSystemTheme); };
	}

	function setupScrollEffects(): () => void {
		if (typeof window === 'undefined') return () => {};
		const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		let rafId = 0;
		let pendingScroll = window.scrollY;

		const applyScroll = (value: number) => {
			const clamped = Math.max(0, value);
			updatePopcornTransforms(reduceMotion ? 0 : clamped, true);
		};

		const handleScroll = () => {
			if (reduceMotion) return;
			pendingScroll = window.scrollY;
			if (rafId) return;
			rafId = window.requestAnimationFrame(() => {
				updatePopcornTransforms(pendingScroll);
				rafId = 0;
			});
		};

		const handleMotionPreference = (event: MediaQueryListEvent) => {
			systemReduceMotion = event.matches;
			recomputeReduceMotion();
			if (reduceMotion) {
				if (rafId) {
					window.cancelAnimationFrame(rafId);
					rafId = 0;
				}
				updatePopcornTransforms(0, true);
			} else {
				updatePopcornTransforms(window.scrollY, true);
			}
		};

		systemReduceMotion = motionQuery.matches;
		recomputeReduceMotion();
		applyScroll(window.scrollY);

		motionQuery.addEventListener('change', handleMotionPreference);
		window.addEventListener('scroll', handleScroll, { passive: true });

		return () => {
			motionQuery.removeEventListener('change', handleMotionPreference);
			window.removeEventListener('scroll', handleScroll);
			if (rafId) {
				window.cancelAnimationFrame(rafId);
			}
		};
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		const cleanupFns = [addEventListeners(), initializeTheme(), setupScrollEffects()];
		return () => {
			for (const cleanup of cleanupFns) {
				cleanup?.();
			}
		};
	});

	// Switch locale without full page reload for instant UX
	async function changeLocale(code: 'en' | 'nl') {
		// Avoid default reload behavior; update local state to trigger re-render
		await (setLocale as any)(code, { reload: false });
		currentLocale = code;

		// Close settings sheet and show a toast
		sheetOpen = false;
		const lang = langs.find((l) => l.code === code);
		const label = lang?.label ?? code.toUpperCase();
		toast.message(m.settings_languageChanged({ language: label }));
	}

	function resolveDark(pref: ThemePreference, systemMatches?: boolean): boolean {
		if (pref === 'system') {
			if (typeof systemMatches === 'boolean') return systemMatches;
			if (prefersDarkQuery) return prefersDarkQuery.matches;
			if (typeof window !== 'undefined') {
				return window.matchMedia('(prefers-color-scheme: dark)').matches;
			}
			return false;
		}
		return pref === 'dark';
	}

	function updateThemeMeta(isDark: boolean) {
		if (typeof document === 'undefined') return;
		let meta = document.querySelector('meta[name="theme-color"]');
		if (!meta) {
			meta = document.createElement('meta');
			meta.setAttribute('name', 'theme-color');
			document.head.appendChild(meta);
		}
		meta.setAttribute('content', isDark ? '#0b1220' : '#ffffff');
	}

	function applyTheme(pref: ThemePreference, systemMatches?: boolean) {
		if (typeof document === 'undefined') return;
		const isDark = resolveDark(pref, systemMatches);
		document.documentElement.classList.toggle('dark', isDark);
		updateThemeMeta(isDark);
	}

	function changeTheme(pref: ThemePreference) {
		if (themePreference === pref) return;
		themePreference = pref;
		const label = themeLabel(pref);
		const copy = themeCopy[currentLocale] ?? themeCopy.en;
		toast.message(copy.toast(label));
	}

	// Keep the <html lang> attribute in sync
	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.setAttribute('lang', currentLocale);
		}
	});

	$effect(() => {
		const pref = themePreference;
		if (typeof window === 'undefined') return;
		localStorage.setItem('theme', pref);
		applyTheme(pref);
	});

	// Register Service Worker in production for PWA installability
	if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator && !import.meta.env.DEV) {
		window.addEventListener('load', () => {
			navigator.serviceWorker.getRegistration().then((reg) => {
				if (!reg) {
					navigator.serviceWorker.register('/service-worker.js').catch(() => {});
				}
			}).catch(() => {});
		});
	}
</script>

<svelte:head>
	<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
	<link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
	<link rel="shortcut icon" href="/favicon.ico" />
	<meta name="robots" content="index, follow, max-image-preview:large" />
	<meta name="theme-color" media="(prefers-color-scheme: light)" content="#ffffff" />
	<meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0b1220" />
	<!-- PWA: iOS/Apple support -->
	<meta name="apple-mobile-web-app-capable" content="yes" />
	<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
	<meta name="apple-mobile-web-app-title" content="JUMPFLIX" />
	<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
	<!-- Open Graph / Twitter defaults -->
	<meta property="og:site_name" content="JUMPFLIX" />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary_large_image" />
</svelte:head>

<div
	class="popcorn-layer pointer-events-none fixed inset-0 z-[var(--z-index-background-decor)] overflow-hidden"
	aria-hidden="true"
	class:popcorn-hidden={reduceMotion}
>
		{#each activePopcorns as popcorn (popcorn.id)}
		<div
			class="popcorn-item"
			use:popcornParallax={popcorn}
			style:left={`${popcorn.left}%`}
			style:top={`${popcorn.top}vh`}
			style:width={`${popcorn.size}px`}
			style:height={`${popcorn.size}px`}
		>
			<div
				class="popcorn-bob"
				style={`--popcorn-duration:${popcorn.floatDuration}s; --popcorn-delay:${popcorn.floatDelay}s; --popcorn-sway:${popcorn.sway}px;`}
				style:animation-play-state={reduceMotion ? 'paused' : 'running'}
				style:opacity={popcorn.opacity}
			>
				<img src="/images/popcorn.svg" alt="" class="h-full w-full object-contain" draggable="false" />
			</div>
		</div>
	{/each}
</div>

<div class="relative z-[var(--z-index-content)]">
	<!-- Top-left settings cog that opens a left-side sheet -->
	<SheetRoot bind:open={sheetOpen}>
		<div class="absolute left-4 top-4 z-[var(--z-index-settings)]" class:hidden={$showDetailsPanel && isMobile}>
			<SheetTrigger aria-label={m.settings_open()}>
				<button
					class="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/90 text-foreground shadow-sm transition hover:bg-muted/60 hover:-translate-y-0.5 hover:shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<CogIcon class="size-5" />
					<span class="sr-only">{m.settings_open()}</span>
				</button>
			</SheetTrigger>
		</div>

		<SheetContent side="left" class="p-0 flex flex-col h-full">
			<SheetHeader class="px-4 pt-4">
				<SheetTitle>{m.settings()}</SheetTitle>
			</SheetHeader>

			<!-- Scrollable content -->
			<div class="flex-1 overflow-y-auto p-4">
				<p class="mb-2 text-sm text-muted-foreground">{m.settings_language()}</p>
				<div class="grid grid-cols-2 gap-2">
					{#each langs as l}
						<button
							class={`group relative flex items-center gap-3 rounded-xl border border-border bg-background/80 p-3 text-left text-sm transition cursor-pointer hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${currentLocale === l.code ? 'border-primary/60 bg-gradient-to-br from-primary/15 to-primary/5 text-foreground shadow-[0_18px_32px_-16px_rgba(59,130,246,0.55)] ring-2 ring-primary/40' : 'text-muted-foreground'}`}
							aria-pressed={currentLocale === l.code}
							onclick={() => changeLocale(l.code)}
						>
							<span class="text-lg leading-none transition-colors group-hover:text-foreground">{l.flag}</span>
							<span class={`flex-1 font-medium transition-colors ${currentLocale === l.code ? 'text-foreground' : 'group-hover:text-foreground'}`}>{l.label}</span>
						</button>
					{/each}
				</div>
				<div class="mt-6">
					<p class="mb-2 text-sm text-muted-foreground">{themeHeading()}</p>
					<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
						{#each themeOptions as option}
							<button
								class={`group relative flex items-center gap-3 rounded-xl border border-border bg-background/80 p-3 text-sm transition cursor-pointer hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background ${themePreference === option.value ? 'border-primary/60 bg-gradient-to-br from-primary/15 to-primary/5 text-foreground shadow-[0_18px_32px_-16px_rgba(59,130,246,0.55)] ring-2 ring-primary/40' : 'text-muted-foreground'}`}
								aria-pressed={themePreference === option.value}
								onclick={() => changeTheme(option.value)}
							>
								<option.icon class={`size-5 shrink-0 transition-colors ${themePreference === option.value ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} aria-hidden="true" />
								<span class={`flex-1 text-left font-medium leading-tight transition-colors ${themePreference === option.value ? 'text-foreground' : 'text-muted-foreground group-hover:text-foreground'}`}>{themeLabel(option.value)}</span>
							</button>
						{/each}
					</div>
				</div>
				<!-- Project Links -->
				<div class="mt-6">
					<p class="mb-2 text-sm text-muted-foreground">{m.settings_links()}</p>
					<div class="flex flex-col gap-2">
						<a href="https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv" target="_blank" rel="noopener noreferrer" class="group relative flex items-center gap-3 rounded-xl border border-border bg-background/80 p-3 text-sm text-muted-foreground transition hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
							<GithubIcon class="size-4" />
							<span class="font-medium transition-colors group-hover:text-foreground">GitHub</span>
						</a>
						<a href="https://pkfr.nl" target="_blank" rel="noopener noreferrer" class="group relative flex items-center gap-3 rounded-xl border border-border bg-background/80 p-3 text-sm text-muted-foreground transition hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
							<GlobeIcon class="size-4" />
							<span class="font-medium transition-colors group-hover:text-foreground">pkfr.nl — Dutch Parkour Community</span>
						</a>
						<a href="https://maxmade.nl" target="_blank" rel="noopener noreferrer" class="group relative flex items-center gap-3 rounded-xl border border-border bg-background/80 p-3 text-sm text-muted-foreground transition hover:-translate-y-0.5 hover:bg-muted/70 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background">
							<GlobeIcon class="size-4" />
							<span class="font-medium transition-colors group-hover:text-foreground">maxmade.nl — Max Seelig's Portfolio</span>
						</a>
					</div>
				</div>
			</div>

			<!-- Bottom Credits Footer -->
			<div class="border-t border-border text-muted-foreground text-xs flex items-center justify-between md:justify-end gap-3 p-4 bg-background/95">
				<a href="https://maxmade.nl" target="_blank" rel="noopener noreferrer" title="MAXmade - Max Seelig" class="flex items-center gap-2">
					<img src="/images/logo-MAXmade-light.svg" alt="MAXmade - Max Seelig" class="h-5 w-auto block dark:hidden" />
					<img src="/images/logo-MAXmade-dark.svg" alt="MAXmade - Max Seelig" class="h-5 w-auto hidden dark:block" />
				</a>
			</div>
		</SheetContent>
	</SheetRoot>

	{#key currentLocale}
		<!-- Persist TvPage across route changes; children still render for head/meta in pages -->
		{#if $page.error}
			{@render children?.()}
		{:else}
			<TvPage initialItem={data?.item ?? null} initialEpisodeNumber={data?.initialEpisodeNumber ?? null} initialSeasonNumber={data?.initialSeasonNumber ?? null} />
			{@render children?.()}
		{/if}
	{/key}

	<!-- Global toast container -->
	<Toaster richColors position="bottom-center" />

	<!-- Global PWA install prompt (auto-managed, suppressed after dismissal for 2 weeks) -->
	<PWAInstallPrompt />
</div>

<style>
	.popcorn-layer {
		position: fixed;
		inset: 0;
		pointer-events: none;
		overflow: hidden;
		mix-blend-mode: overlay;
		mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.7) 40%, rgba(0, 0, 0, 0.25) 60%, rgba(0, 0, 0, 0) 80%);
		-webkit-mask-image: radial-gradient(circle at center, rgba(0, 0, 0, 1) 0%, rgba(0, 0, 0, 0.7) 40%, rgba(0, 0, 0, 0.25) 60%, rgba(0, 0, 0, 0) 80%);
		contain: layout paint;
		backface-visibility: hidden;
		opacity: 1;
		visibility: visible;
		transition: opacity 220ms ease-in-out, visibility 0s linear 0s;
	}

	.popcorn-layer.popcorn-hidden {
		opacity: 0;
		visibility: hidden;
		transition: opacity 220ms ease-in-out, visibility 0s linear 220ms;
	}

	:global(body.hide-popcorn .popcorn-layer) {
		opacity: 0;
		visibility: hidden;
		transition: opacity 220ms ease-in-out, visibility 0s linear 220ms;
	}

	:global(.dark .popcorn-layer) {
		mix-blend-mode: soft-light;
	}

	.popcorn-item {
		position: absolute;
		will-change: transform;
		transform-origin: center;
	}

	.popcorn-bob {
		display: flex;
		width: 100%;
		height: 100%;
		align-items: center;
		justify-content: center;
		animation: popcornFloat var(--popcorn-duration, 24s) ease-in-out infinite;
		animation-delay: var(--popcorn-delay, 0s);
		will-change: transform;
	}

	.popcorn-bob img {
		filter: drop-shadow(0 14px 24px rgba(10, 13, 24, 0.24));
		user-select: none;
	}

	@keyframes popcornFloat {
		0% {
			transform: translate3d(0, 0, 0);
		}

		50% {
			transform: translate3d(var(--popcorn-sway, 18px), -18px, 0);
		}

		100% {
			transform: translate3d(0, 0, 0);
		}
	}

	@media (max-width: 768px) {
		.popcorn-bob img {
			filter: drop-shadow(0 8px 16px rgba(10, 13, 24, 0.2));
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.popcorn-layer,
		.popcorn-item {
			transform: none !important;
		}

		.popcorn-bob {
			animation: none !important;
			transform: none !important;
		}

		.popcorn-layer {
			opacity: 0;
			visibility: hidden;
		}
	}
</style>
