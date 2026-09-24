<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import { getLocale, localizeHref } from '$lib/paraglide/runtime';
	import LanguageAlternates from '$lib/components/LanguageAlternates.svelte';
	const canonical = () => 'https://www.jumpflix.tv' + localizeHref('/');
	// TvPage is rendered persistently from +layout.svelte
	// This page contributes only head metadata
	let {} = $props();
</script>

<svelte:head>
	<title>{m.tv_homeSeoTitle()}</title>
	<meta name="description" content={m.tv_description()} />
	<link rel="canonical" href={canonical()} />
	<!-- Social -->
	<meta property="og:title" content={m.tv_homeSeoTitle()} />
	<meta property="og:description" content={m.tv_description()} />
	<meta property="og:url" content={canonical()} />
	<meta property="og:image" content="https://www.jumpflix.tv/images/jumpflix.webp" />
	<meta name="twitter:title" content={m.tv_homeSeoTitle()} />
	<meta name="twitter:description" content={m.tv_description()} />
	<meta name="twitter:image" content="https://www.jumpflix.tv/images/jumpflix.webp" />
</svelte:head>

<!-- Content rendered in layout -->

<JsonLd
	value={{
		'@context': 'https://schema.org',
		'@type': 'WebSite',
		name: 'JUMPFLIX',
		url: canonical(),
		inLanguage: getLocale(),
		potentialAction: {
			'@type': 'SearchAction',
			target: canonical() + '?q={search_term_string}',
			'query-input': 'required name=search_term_string'
		}
	}}
/>

<LanguageAlternates path="/" />
