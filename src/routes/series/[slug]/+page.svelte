<script lang="ts">
  import TvPage from '$lib/tv/TvPage.svelte';
  import { getUrlForItem } from '$lib/tv/slug';
  import { env } from '$env/dynamic/public';
  export let data: { item: any, episodes: any[] };
  const item = data?.item;
  const title = item ? `${item.title} — Parkour Series on JUMPFLIX` : 'Series — JUMPFLIX';
  const desc = item?.description || 'Curated parkour series on JUMPFLIX.';
  const image = item?.thumbnail ? (item.thumbnail.startsWith('http') ? item.thumbnail : `https://www.jumpflix.tv${item.thumbnail}`) : 'https://www.jumpflix.tv/images/jumpflix-dark.webp';
  const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
  const url = item ? `${origin}${getUrlForItem(item)}` : origin;
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

<TvPage initialItem={item ?? null} />
