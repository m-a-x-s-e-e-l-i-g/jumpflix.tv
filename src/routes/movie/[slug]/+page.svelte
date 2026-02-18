<script lang="ts">
	import { getUrlForItem } from '$lib/tv/slug';
	import { env } from '$env/dynamic/public';
	import { decode } from 'html-entities';
	// TvPage is rendered in layout; we only set head tags here
	export let data: { item: any };

	// Derived state (reactive) so navigating between slugs updates <svelte:head>
	const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
	let item: any;
	let title: string;
	let desc: string;
	let image: string;
	let url: string;

	$: item = data?.item;
	$: title = item
		? `${decode(item.title)} (${item.year}) — Parkour Film on JUMPFLIX`
		: 'Movie — JUMPFLIX';
	const normalizeDesc = (value?: string) => value?.replace(/\s+/g, ' ').trim() ?? '';
	const clipDesc = (value: string, max = 160) => {
		if (!value) return '';
		if (value.length <= max) return value;
		const clipped = value.slice(0, Math.max(0, max - 1));
		return `${clipped.replace(/\s+\S*$/, '').trim()}…`;
	};
	const fallbackDesc = 'Watch parkour films and documentaries on JUMPFLIX.';
	$: desc =
		clipDesc(normalizeDesc(item?.description ? decode(item.description) : ''), 160) || fallbackDesc;
	$: if (desc.length < 25) desc = fallbackDesc;
	$: image = item?.thumbnail
		? item.thumbnail.startsWith('http')
			? item.thumbnail
			: `https://www.jumpflix.tv${item.thumbnail}`
		: 'https://www.jumpflix.tv/images/jumpflix.webp';
	$: url = item ? `${origin}${getUrlForItem(item)}` : origin;

	const toPeople = (names?: string[]) => {
		if (!Array.isArray(names)) return undefined;
		const people = names
			.map((name) => (typeof name === 'string' ? decode(name).trim() : ''))
			.filter(Boolean)
			.map((name) => ({ '@type': 'Person', name }));
		return people.length ? people : undefined;
	};

	const inferUploadDate = (year?: string) => {
		if (!year) return undefined;
		const clean = year.trim();
		return /^\d{4}$/.test(clean) ? `${clean}-01-01` : undefined;
	};

	const jsonLd = (payload: Record<string, unknown> | null | undefined) => {
		if (!payload) return '';
		const json = JSON.stringify(
			payload,
			(_key, value) => {
				if (value === null || value === undefined) return undefined;
				if (Array.isArray(value) && value.length === 0) return undefined;
				return value;
			},
			2
		);
		return json.replace(/<\/script/gi, '<\\/script');
	};

	let jsonLdMovie = '';
	let jsonLdVideo = '';
	let jsonLdBreadcrumb = '';

	$: jsonLdMovie = item
		? jsonLd({
				'@context': 'https://schema.org',
				'@type': 'Movie',
				name: decode(item.title ?? ''),
				datePublished: inferUploadDate(item.year),
				description: desc,
				image,
				url,
				actor: toPeople(item.starring),
				creator: toPeople(item.creators)
			})
		: '';

	$: jsonLdVideo =
		item && (item.videoId || item.vimeoId)
			? jsonLd({
					'@context': 'https://schema.org',
					'@type': 'VideoObject',
					name: decode(item.title ?? ''),
					description: desc,
					thumbnailUrl: [image],
					uploadDate: inferUploadDate(item.year),
					embedUrl: item.videoId
						? `https://www.youtube.com/embed/${item.videoId}`
						: item.vimeoId
							? `https://player.vimeo.com/video/${item.vimeoId}`
							: undefined,
					url
				})
			: '';

	$: jsonLdBreadcrumb = item
		? jsonLd({
				'@context': 'https://schema.org',
				'@type': 'BreadcrumbList',
				itemListElement: [
					{ '@type': 'ListItem', position: 1, name: 'Home', item: origin },
					{ '@type': 'ListItem', position: 2, name: decode(item.title ?? ''), item: url }
				]
			})
		: '';
</script>

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={url} />
	<!-- Social -->
	<meta property="og:type" content="video.movie" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={desc} />
	<meta property="og:image" content={image} />
	<meta property="og:url" content={url} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={desc} />
	<meta name="twitter:image" content={image} />
	{#if jsonLdMovie}
		{@html `<script type="application/ld+json">${jsonLdMovie}</script>`}
	{/if}
	{#if jsonLdVideo}
		{@html `<script type="application/ld+json">${jsonLdVideo}</script>`}
	{/if}
	{#if jsonLdBreadcrumb}
		{@html `<script type="application/ld+json">${jsonLdBreadcrumb}</script>`}
	{/if}
</svelte:head>

<!-- Content rendered in layout -->
