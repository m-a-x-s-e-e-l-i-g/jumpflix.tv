<script lang="ts">
	import { env } from '$env/dynamic/public';
	import { decode } from 'html-entities';
	import JsonLd from './JsonLd.svelte';
	import { verifiedDate } from '$lib/seo';
	import { getEpisodeUrl, getUrlForItem } from '$lib/tv/slug';
	import type { Episode, Series } from '$lib/tv/types';
	let {
		data
	}: {
		data: {
			item: Series;
			episode: Episode;
			initialEpisodeNumber: number;
			initialSeasonNumber: number;
		};
	} = $props();
	const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
	const code = $derived(
		`s${String(data.initialSeasonNumber).padStart(2, '0')}e${String(data.initialEpisodeNumber).padStart(2, '0')}`
	);
	const name = $derived(`${decode(data.episode.title)} — ${decode(data.item.title)} ${code}`);
	const description = $derived(
		decode(
			data.episode.description ||
				data.item.description ||
				`Watch ${data.episode.title} on JUMPFLIX.`
		)
	);
	const image = $derived(
		new URL(data.episode.thumbnail || data.item.thumbnail || '/images/jumpflix.webp', origin).href
	);
	const url = $derived(
		origin +
			getEpisodeUrl(data.item, {
				episodeNumber: data.initialEpisodeNumber,
				seasonNumber: data.initialSeasonNumber
			})
	);
	const publishedAt = $derived(verifiedDate(data.episode.publishedAt));
	const episodeSchema = $derived({
		'@context': 'https://schema.org',
		'@type': 'TVEpisode',
		name,
		description,
		image,
		url,
		episodeNumber: data.initialEpisodeNumber,
		datePublished: publishedAt,
		partOfSeason: { '@type': 'TVSeason', seasonNumber: data.initialSeasonNumber },
		partOfSeries: {
			'@type': 'TVSeries',
			name: decode(data.item.title),
			url: origin + getUrlForItem(data.item)
		}
	});
</script>

<svelte:head>
	<title>{name} — JUMPFLIX</title>
	<meta name="description" content={description.replace(/\s+/g, ' ').slice(0, 160)} />
	<link rel="canonical" href={url} />
	<meta property="og:type" content="video.episode" />
	<meta property="og:title" content={name} />
	<meta property="og:description" content={description} />
	<meta property="og:image" content={image} />
	<meta property="og:url" content={url} />
	<meta name="twitter:title" content={name} />
	<meta name="twitter:description" content={description} />
	<meta name="twitter:image" content={image} />
</svelte:head>

<JsonLd value={episodeSchema} />
{#if publishedAt && /^[a-zA-Z0-9_-]{11}$/.test(data.episode.id)}
	<JsonLd
		value={{
			'@context': 'https://schema.org',
			'@type': 'VideoObject',
			name,
			description,
			thumbnailUrl: [image],
			uploadDate: publishedAt,
			embedUrl: `https://www.youtube.com/embed/${data.episode.id}`,
			url
		}}
	/>
{/if}
