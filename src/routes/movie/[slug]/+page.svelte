<script lang="ts">
  import TvPage from '$lib/tv/TvPage.svelte';
  import { getUrlForItem } from '$lib/tv/slug';
  import { env } from '$env/dynamic/public';
  export let data: { item: any };
  const item = data?.item;
  const title = item ? `${item.title} (${item.year}) — Watch Parkour Film on JUMPFLIX` : 'Movie — JUMPFLIX';
  const desc = item?.description || 'Watch parkour films and documentaries on JUMPFLIX.';
  const image = item?.thumbnail ? (item.thumbnail.startsWith('http') ? item.thumbnail : `https://www.jumpflix.tv${item.thumbnail}`) : 'https://www.jumpflix.tv/images/jumpflix-dark.webp';
  const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
  const url = item ? `${origin}${getUrlForItem(item)}` : origin;
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
  <!-- JSON-LD Movie -->
  {#if item}
    <script type="application/ld+json">
      {JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Movie',
        name: item.title,
        datePublished: item.year,
        description: desc,
        image,
        url,
        actor: (item.starring || []).map((name: string) => ({ '@type': 'Person', name })),
        creator: (item.creators || []).map((name: string) => ({ '@type': 'Person', name }))
      })}
    </script>
    {#if item.videoId || item.vimeoId}
      <script type="application/ld+json">
        {JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: item.title,
          description: desc,
          thumbnailUrl: [image],
          uploadDate: item.year ? `${item.year}-01-01` : undefined,
          embedUrl: item.videoId
            ? `https://www.youtube.com/embed/${item.videoId}`
            : (item.vimeoId ? `https://player.vimeo.com/video/${item.vimeoId}` : undefined),
          url
        })}
      </script>
    {/if}
    <script type="application/ld+json">
      {JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: origin },
          { '@type': 'ListItem', position: 2, name: item.title, item: url }
        ]
      })}
    </script>
  {/if}
</svelte:head>

<TvPage initialItem={item ?? null} />
