<script lang="ts">
	import { localizeHref, getLocale } from '$lib/paraglide/runtime';
	let { path }: { path: string } = $props();
	const languages = [
		{ code: 'en', name: 'English' },
		{ code: 'nl', name: 'Nederlands' },
		{ code: 'ja', name: '日本語' }
	] as const;
</script>

<svelte:head>
	{#each languages as language}
		<link
			rel="alternate"
			hreflang={language.code}
			href={'https://www.jumpflix.tv' + localizeHref(path, { locale: language.code })}
		/>
	{/each}
	<link
		rel="alternate"
		hreflang="x-default"
		href={'https://www.jumpflix.tv' + localizeHref(path, { locale: 'en' })}
	/>
</svelte:head>

<nav
	aria-label="Languages"
	class="flex justify-center gap-5 px-6 py-6 text-sm text-muted-foreground"
>
	{#each languages as language}
		<a
			href={localizeHref(path, { locale: language.code })}
			hreflang={language.code}
			lang={language.code}
			aria-current={getLocale() === language.code ? 'page' : undefined}
			data-sveltekit-reload
			class="hover:text-foreground">{language.name}</a
		>
	{/each}
</nav>
