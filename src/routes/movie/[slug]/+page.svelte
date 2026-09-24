<script lang="ts">
	import { getUrlForItem } from '$lib/tv/slug';
	import { YOUTUBE_ID_PATTERN, resolveMoviePlaybackSource } from '$lib/tv/playback-source';
	import { env } from '$env/dynamic/public';
	import { decode } from 'html-entities';
	import { verifiedDate } from '$lib/seo';
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
		return json.replace(/</g, '\\u003c');
	};

	let jsonLdMovie = '';
	let jsonLdVideo = '';
	let jsonLdBreadcrumb = '';

	$: jsonLdMovie = item
		? jsonLd({
				'@context': 'https://schema.org',
				'@type': 'Movie',
				name: decode(item.title ?? ''),
				description: desc,
				image,
				url,
				actor: toPeople(item.starring),
				creator: toPeople(item.creators)
			})
		: '';

	$: moviePlaybackSource = item ? resolveMoviePlaybackSource(item) : null;
	$: jsonLdEmbedUrl =
		moviePlaybackSource?.kind === 'youtube' &&
		YOUTUBE_ID_PATTERN.test(String(item?.videoId ?? '').trim())
			? `https://www.youtube.com/embed/${String(item.videoId).trim()}`
			: moviePlaybackSource?.kind === 'vimeo' && String(item?.vimeoId ?? '').trim()
				? `https://player.vimeo.com/video/${encodeURIComponent(String(item.vimeoId).trim())}`
				: undefined;

	// Only emit video rich-result markup when its required publication date is known.
	// A film's release year does not establish the video's upload date.
	$: uploadDate = verifiedDate(item?.publishedAt);
	$: jsonLdVideo =
		item && moviePlaybackSource && uploadDate
			? jsonLd({
					'@context': 'https://schema.org',
					'@type': 'VideoObject',
					name: decode(item.title ?? ''),
					description: desc,
					thumbnailUrl: [image],
					uploadDate,
					contentUrl:
						moviePlaybackSource?.kind === 'hls' || moviePlaybackSource?.kind === 'direct'
							? moviePlaybackSource.src
							: undefined,
					embedUrl: jsonLdEmbedUrl,
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
