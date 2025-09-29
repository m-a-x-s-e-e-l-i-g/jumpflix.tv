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
  $: title = item ? `${decode(item.title)} (${item.year}) — Watch Parkour Film on JUMPFLIX` : 'Movie — JUMPFLIX';
  $: desc = item?.description ? decode(item.description) : 'Watch parkour films and documentaries on JUMPFLIX.';
  $: image = item?.thumbnail ? (item.thumbnail.startsWith('http') ? item.thumbnail : `https://www.jumpflix.tv${item.thumbnail}`) : 'https://www.jumpflix.tv/images/jumpflix-dark.webp';
  $: url = item ? `${origin}${getUrlForItem(item)}` : origin;
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
</svelte:head>

<!-- Content rendered in layout -->
