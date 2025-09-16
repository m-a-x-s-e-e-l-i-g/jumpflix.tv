<script lang="ts">
	import '../app.css';
	import favicon from '$lib/assets/favicon.png';

	let { children } = $props();

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

{@render children?.()}
