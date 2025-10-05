<script lang="ts">
	// TvPage is rendered in layout; we only set head tags here
	import { env } from '$env/dynamic/public';
	import { getEpisodeUrl, getUrlForItem } from '$lib/tv/slug';
	import { decode } from 'html-entities';
	export let data: { item: any; initialEpisodeNumber: number };
	const item = data?.item;
	const ep = data?.initialEpisodeNumber;
	// Back-compat route implies season 1
	const season = 1;

	// Derived SEO fields
	const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
	$: e = typeof ep === 'number' && ep >= 1 ? ep : 1;
	$: code = `s${String(season).padStart(2, '0')}e${String(e).padStart(2, '0')}`;
	$: title = item
		? `${decode(item.title)} ${code} — Watch Parkour Series on JUMPFLIX`
		: 'Series Episode — JUMPFLIX';
	$: desc = item?.description
		? `${decode(item.description)} (Episode ${e}, Season ${season})`
		: `Watch ${item?.title ? `${item.title} ${code}` : 'this parkour series episode'} on JUMPFLIX.`;
	$: image = item?.thumbnail
		? item.thumbnail.startsWith('http')
			? item.thumbnail
			: `https://www.jumpflix.tv${item.thumbnail}`
		: 'https://www.jumpflix.tv/images/jumpflix.webp';
	$: url = item
		? `${origin}${getEpisodeUrl(item, { episodeNumber: e, seasonNumber: season })}`
		: origin;
	// Structured data (TVEpisode) for legacy route (assumed season 1)
	$: structuredData = {
		'@context': 'https://schema.org',
		'@type': 'TVEpisode',
		name: item ? `${decode(item.title)} ${code}` : 'Series Episode',
		partOfSeries: item
			? { '@type': 'TVSeries', name: decode(item.title), url: origin + getUrlForItem(item) }
			: undefined,
		episodeNumber: e,
		seasonNumber: season,
		description: desc,
		url
	};
</script>

<!-- Content rendered in layout -->

<svelte:head>
	<title>{title}</title>
	<meta name="description" content={desc} />
	<link rel="canonical" href={url} />
	<!-- Social -->
	<meta property="og:type" content="video.episode" />
	<meta property="og:title" content={title} />
	<meta property="og:description" content={desc} />
	<meta property="og:image" content={image} />
	<meta property="og:url" content={url} />
	<meta name="twitter:title" content={title} />
	<meta name="twitter:description" content={desc} />
	<meta name="twitter:image" content={image} />

	<!-- JSON-LD for TVEpisode (use {@html} to prevent HTML escaping) -->
	<script type="application/ld+json">
{@html JSON.stringify(structuredData).replace(/</g, '\\u003c')}
	</script>
</svelte:head>
