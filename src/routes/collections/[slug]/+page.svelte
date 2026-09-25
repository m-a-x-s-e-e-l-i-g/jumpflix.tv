<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	import { localizeHref } from '$lib/paraglide/runtime';
	import LanguageAlternates from '$lib/components/LanguageAlternates.svelte';
	import { env } from '$env/dynamic/public';
	import { getFeedBySlug } from '$lib/tv/feeds';
	import { getUrlForItem } from '$lib/tv/slug';
	import JsonLd from '$lib/components/JsonLd.svelte';
	import type { PageData } from './$types';
	let { data }: { data: PageData } = $props();
	const feed = $derived(getFeedBySlug(data.collectionSlug)!);
	const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
	const url = $derived(origin + localizeHref(`/collections/${feed.slug}`));
	const title = $derived(`${feed.title()} — ${m.tv_collectionSeoSuffix()} | JUMPFLIX`);
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={feed.introduction()} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={feed.introduction()} />
	<meta property="og:url" content={url} />
	<meta property="og:image" content={`${origin}/images/jumpflix.webp`} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={feed.introduction()} />
</svelte:head>

<JsonLd
	value={{
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		name: feed.title(),
		description: feed.introduction(),
		url,
		mainEntity: {
			'@type': 'ItemList',
			itemListOrder: 'https://schema.org/ItemListUnordered',
			numberOfItems: data.content.length,
			itemListElement: data.content.map((item) => ({
				'@type': 'ListItem',
				name: item.title,
				url: origin + getUrlForItem(item)
			}))
		}
	}}
/>

<LanguageAlternates path={`/collections/${feed.slug}`} />
