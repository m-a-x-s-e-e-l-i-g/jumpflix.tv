<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
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
	// We'll access the underlying custom element via a store reference set in the prompt component
	let pwaInstallRef: any = null;
    
  
	// data from +layout.ts
	let { children, data } = $props<{ children: any; data: { item: any; initialEpisodeNumber: number | null; initialSeasonNumber: number | null } }>();

    
	let isMobile = $state(false);
	// current locale from Paraglide (reactive state)
	let currentLocale: 'en' | 'nl' = $state(getLocale() as any);
	let sheetOpen = $state(false);
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

	let themePreference = $state<ThemePreference>('system');
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
		if (storedTheme === 'light' || storedTheme === 'dark') {
			themePreference = storedTheme;
		}
	}

	onMount(() => {
		if (typeof window === 'undefined') return;
		const update = () => { isMobile = window.innerWidth < 768; };
		update();
		window.addEventListener('resize', update);

		prefersDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const handleSystemTheme = (event: MediaQueryListEvent) => {
			if (themePreference === 'system') {
				applyTheme('system', event.matches);
			}
		};
		prefersDarkQuery.addEventListener('change', handleSystemTheme);
		applyTheme(themePreference);

		return () => {
			window.removeEventListener('resize', update);
			prefersDarkQuery?.removeEventListener('change', handleSystemTheme);
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
		if (pref === 'system') {
			localStorage.removeItem('theme');
		} else {
			localStorage.setItem('theme', pref);
		}
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

<!-- Top-left settings cog that opens a left-side sheet -->
<SheetRoot bind:open={sheetOpen}>
	<div class="absolute left-4 top-4 z-30" class:hidden={$showDetailsPanel && isMobile}>
		<SheetTrigger aria-label={m.settings_open()}>
			<button
				class="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
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
						class="[ 'flex items-center gap-2 rounded-md border border-border p-3 text-left text-sm transition', currentLocale === l.code ? 'bg-muted/40 outline outline-1 outline-primary outline-offset-2' : 'hover:bg-muted/60' ].join(' ')"
						aria-pressed={currentLocale === l.code}
						onclick={() => changeLocale(l.code)}
					>
						<span class="text-lg leading-none">{l.flag}</span>
						<span>{l.label}</span>
					</button>
				{/each}
			</div>
			<div class="mt-6">
				<p class="mb-2 text-sm text-muted-foreground">{themeHeading()}</p>
				<div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
					{#each themeOptions as option}
						<button
							class="[ 'flex items-center gap-2 rounded-md border border-border p-3 text-sm transition', themePreference === option.value ? 'bg-muted/40 outline outline-1 outline-primary outline-offset-2' : 'hover:bg-muted/60' ].join(' ')"
							aria-pressed={themePreference === option.value}
							onclick={() => changeTheme(option.value)}
						>
							<option.icon class="size-4" />
							<span>{themeLabel(option.value)}</span>
						</button>
					{/each}
				</div>
			</div>
			<!-- Project Links -->
			<div class="mt-6">
				<p class="mb-2 text-sm text-muted-foreground">{m.settings_links()}</p>
				<div class="flex flex-col gap-2">
					<a href="https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/60 transition">
						<GithubIcon class="size-4" />
						<span class="text-sm text-foreground">GitHub</span>
					</a>
					<a href="https://pkfr.nl" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/60 transition">
						<GlobeIcon class="size-4" />
						<span class="text-sm text-foreground">pkfr.nl — Dutch Parkour Community</span>
					</a>
					<a href="https://maxmade.nl" target="_blank" rel="noopener noreferrer" class="flex items-center gap-3 rounded-md border border-border p-3 hover:bg-muted/60 transition">
						<GlobeIcon class="size-4" />
						<span class="text-sm text-foreground">maxmade.nl — Max Seelig's Portfolio</span>
					</a>
				</div>
			</div>
		</div>

		<!-- Bottom Credits Footer -->
		<div class="border-t border-border text-muted-foreground text-xs flex items-center justify-between md:justify-end gap-3 p-4 bg-background/90 backdrop-blur">
			<a href="https://maxmade.nl" target="_blank" rel="noopener noreferrer" title="MAXmade - Max Seelig" class="flex items-center gap-2">
				<img src="/images/logo-MAXmade-light.svg" alt="MAXmade - Max Seelig" class="h-5 w-auto block dark:hidden" />
				<img src="/images/logo-MAXmade-dark.svg" alt="MAXmade - Max Seelig" class="h-5 w-auto hidden dark:block" />
			</a>
		</div>
	</SheetContent>
</SheetRoot>

{#key currentLocale}
	<!-- Persist TvPage across route changes; children still render for head/meta in pages -->
	<TvPage initialItem={data?.item ?? null} initialEpisodeNumber={data?.initialEpisodeNumber ?? null} initialSeasonNumber={data?.initialSeasonNumber ?? null} />
	{@render children?.()}
{/key}

<!-- Global toast container -->
<Toaster richColors position="bottom-center" />

<!-- Global PWA install prompt (auto-managed, suppressed after dismissal for 2 weeks) -->
<PWAInstallPrompt />
