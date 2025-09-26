<script lang="ts">
  // TvPage is rendered in layout; we only set head tags here
  import { env } from '$env/dynamic/public';
  import { getEpisodeUrl, getUrlForItem } from '$lib/tv/slug';
  export let data: { item: any; initialEpisodeNumber: number; initialSeasonNumber: number | null };
  const item = data?.item;
  const ep = data?.initialEpisodeNumber;
  const season = data?.initialSeasonNumber ?? null;

  // Derived SEO fields
  const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
  $: s = typeof season === 'number' && season >= 1 ? season : 1;
  $: e = typeof ep === 'number' && ep >= 1 ? ep : 1;
  $: code = `s${String(s).padStart(2, '0')}e${String(e).padStart(2, '0')}`;
  $: title = item ? `${item.title} ${code} — Watch Parkour Series on JUMPFLIX` : 'Series Episode — JUMPFLIX';
  $: desc = item?.description
    ? `${item.description} (Episode ${e}${s ? `, Season ${s}` : ''})`
    : `Watch ${item?.title ? `${item.title} ${code}` : 'this parkour series episode'} on JUMPFLIX.`;
  $: image = item?.thumbnail
    ? (item.thumbnail.startsWith('http') ? item.thumbnail : `https://www.jumpflix.tv${item.thumbnail}`)
    : 'https://www.jumpflix.tv/images/jumpflix-dark.webp';
  $: url = item ? `${origin}${getEpisodeUrl(item, { episodeNumber: e, seasonNumber: s })}` : origin;
  // Structured data (TVEpisode). We build it reactively so desc/image/url updates propagate.
  $: structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TVEpisode',
    name: item ? `${item.title} ${code}` : 'Series Episode',
    partOfSeries: item
      ? { '@type': 'TVSeries', name: item.title, url: origin + getEpisodeUrl(item, { episodeNumber: 1, seasonNumber: 1 }) }
      : undefined,
    episodeNumber: e,
    seasonNumber: s,
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

  <!-- JSON-LD for TVEpisode (must use {@html} to avoid HTML-escaping quotes) -->
  <script type="application/ld+json">{@html JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>
</svelte:head>
