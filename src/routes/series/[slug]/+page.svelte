<script lang="ts">
	import { getUrlForItem } from '$lib/tv/slug';
	import { env } from '$env/dynamic/public';
	import { decode } from 'html-entities';
	// TvPage is rendered in layout; we only set head tags here
	export let data: { item: any; episodes: any[] };
	// Derived state (reactive)
	const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
	let item: any;
	let title: string;
	let desc: string;
	let image: string;
	let url: string;

	$: item = data?.item;
	$: title = item ? `${item.title} — Parkour Series on JUMPFLIX` : 'Series — JUMPFLIX';
	const normalizeDesc = (value?: string) => value?.replace(/\s+/g, ' ').trim() ?? '';
	const clipDesc = (value: string, max = 160) => {
		if (!value) return '';
		if (value.length <= max) return value;
		const clipped = value.slice(0, Math.max(0, max - 1));
		return `${clipped.replace(/\s+\S*$/, '').trim()}…`;
	};
	const fallbackDesc = 'Curated parkour series on JUMPFLIX.';
	$: desc =
		clipDesc(normalizeDesc(item?.description ? decode(item.description) : ''), 160) || fallbackDesc;
	$: if (desc.length < 25) desc = fallbackDesc;
	$: image = item?.thumbnail
		? item.thumbnail.startsWith('http')
			? item.thumbnail
			: `https://www.jumpflix.tv${item.thumbnail}`
		: 'https://www.jumpflix.tv/images/jumpflix.webp';
	$: url = item ? `${origin}${getUrlForItem(item)}` : origin;
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={url} />
	<!-- Social -->
	<meta property="og:type" content="website" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={desc} />
	<meta property="og:image" content={image} />
	<meta property="og:url" content={url} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={desc} />
	<meta name="twitter:image" content={image} />
</svelte:head>

<!-- Content rendered in layout -->
