<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';
	import { Sheet as SheetRoot, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '$lib/components/ui/sheet';
	import CogIcon from '@lucide/svelte/icons/cog';
	import { getLocale, setLocale } from '$lib/paraglide/runtime.js';
	import { m } from '$lib/paraglide/messages.js';

	let { children } = $props();

	// current locale from Paraglide
	let currentLocale: 'en' | 'nl' = getLocale() as any;
	const langs = [
		{ code: 'en' as const, flag: '🇬🇧', label: 'English' },
		{ code: 'nl' as const, flag: '🇳🇱', label: 'Nederlands' }
	];

	// Listen for system theme changes and update the 'dark' class on <html>
	if (typeof window !== 'undefined' && window.matchMedia) {
		const updateTheme = (e: MediaQueryList | MediaQueryListEvent) => {
			const stored = localStorage.getItem('theme');
			// e.matches is true if dark mode is enabled
			const matches = 'matches' in e ? e.matches : (e as MediaQueryList).matches;
			if (stored === 'dark' || (!stored && matches)) {
				document.documentElement.classList.add('dark');
			} else {
				document.documentElement.classList.remove('dark');
			}
		};
		const mql = window.matchMedia('(prefers-color-scheme: dark)');
		mql.addEventListener('change', updateTheme);
		// Initial check in case theme was changed while page was open
		updateTheme(mql);
	}
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<!-- Top-left settings cog that opens a left-side sheet -->
<SheetRoot>
	<div class="fixed left-4 top-4 z-50">
	<SheetTrigger aria-label={m.settings_open()}>
			<button
				class="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/80 text-foreground shadow-sm backdrop-blur transition hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				<CogIcon class="size-5" />
				<span class="sr-only">{m.settings_open()}</span>
			</button>
		</SheetTrigger>
	</div>

	<SheetContent side="left" class="p-4">
		<SheetHeader>
			<SheetTitle>{m.settings()}</SheetTitle>
		</SheetHeader>

		<div class="mt-2">
			<p class="mb-2 text-sm text-muted-foreground">{m.settings_language()}</p>
			<div class="grid grid-cols-2 gap-2">
				{#each langs as l}
					<button
						class={[
							'flex items-center gap-2 rounded-md border p-3 text-left text-sm transition',
							currentLocale === l.code
								? 'border-primary ring-1 ring-primary'
								: 'border-border hover:bg-muted/60'
						].join(' ')}
						aria-pressed={currentLocale === l.code}
						onclick={() => setLocale(l.code)}
					>
						<span class="text-lg leading-none">{l.flag}</span>
						<span>{l.label}</span>
					</button>
				{/each}
			</div>
		</div>
	</SheetContent>
</SheetRoot>

{@render children?.()}
