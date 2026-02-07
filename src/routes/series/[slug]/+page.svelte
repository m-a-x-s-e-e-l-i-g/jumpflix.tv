<script lang="ts">
  import { getUrlForItem } from '$lib/tv/slug';
  import { env } from '$env/dynamic/public';
  import { decode } from 'html-entities';

  export let data: { item: any, episodes: any[] };

  const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
  let item: any;
  let title: string;
  let desc: string;
  let image: string;
  let url: string;

  $: item = data?.item;
  $: title = item ? `${decode(item.title)} — Parkour Series on JUMPFLIX` : 'Series — JUMPFLIX';
  $: desc = item?.description ? decode(item.description) : 'Curated parkour series on JUMPFLIX.';
  $: image = item?.thumbnail ? (item.thumbnail.startsWith('http') ? item.thumbnail : `https://www.jumpflix.tv${item.thumbnail}`) : 'https://www.jumpflix.tv/images/jumpflix.webp';
  $: url = item ? `${origin}${getUrlForItem(item)}` : origin;

  const toPeople = (names?: string[]) => {
    if (!Array.isArray(names)) return undefined;
    const people = names
      .map((name: string) => (typeof name === 'string' ? decode(name).trim() : ''))
      .filter(Boolean)
      .map((name: string) => ({ '@type': 'Person', name }));
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
    return json.replace(/<\/script/gi, '<\\/script');
  };

  let jsonLdSeries = '';
  let jsonLdBreadcrumb = '';

  $: jsonLdSeries = item
    ? jsonLd({
        '@context': 'https://schema.org',
        '@type': 'TVSeries',
        name: decode(item.title ?? ''),
        description: desc,
        image,
        url,
        numberOfSeasons: Array.isArray(item.seasons) ? item.seasons.length : undefined,
        numberOfEpisodes: item.episodeCount ?? undefined,
        actor: toPeople(item.starring),
        creator: toPeople(item.creators)
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

  $: creators = Array.isArray(item?.creators) ? item.creators.map((n: string) => decode(n).trim()).filter(Boolean) : [];
  $: starring = Array.isArray(item?.starring) ? item.starring.map((n: string) => decode(n).trim()).filter(Boolean) : [];
  $: seasonCount = Array.isArray(item?.seasons) ? item.seasons.length : 0;
  $: episodeCount = item?.episodeCount ?? 0;
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={desc} />
  <link rel="canonical" href={url} />
  <!-- Social -->
  <meta property="og:type" content="video.tv_show" />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={desc} />
  <meta property="og:image" content={image} />
  <meta property="og:url" content={url} />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={desc} />
  <meta name="twitter:image" content={image} />
  {#if jsonLdSeries}
    {@html `<script type="application/ld+json">${jsonLdSeries}</script>`}
  {/if}
  {#if jsonLdBreadcrumb}
    {@html `<script type="application/ld+json">${jsonLdBreadcrumb}</script>`}
  {/if}
</svelte:head>

{#if item}
  <article class="seo-content" aria-label={decode(item.title ?? '')}>
    <nav aria-label="Breadcrumb" class="seo-breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li aria-current="page">{decode(item.title ?? '')}</li>
      </ol>
    </nav>
    <div class="seo-content-inner">
      {#if image}
        <img
          src={image}
          alt="Poster for {decode(item.title ?? '')}"
          class="seo-poster"
          loading="lazy"
          width="300"
          height="450"
        />
      {/if}
      <div class="seo-details">
        <h1>{decode(item.title ?? '')}</h1>
        <dl>
          {#if seasonCount > 0}
            <div class="seo-meta-pair">
              <dt>Seasons</dt>
              <dd>{seasonCount}</dd>
            </div>
          {/if}
          {#if episodeCount > 0}
            <div class="seo-meta-pair">
              <dt>Episodes</dt>
              <dd>{episodeCount}</dd>
            </div>
          {/if}
          {#if creators.length}
            <div class="seo-meta-pair">
              <dt>Created by</dt>
              <dd>{creators.join(', ')}</dd>
            </div>
          {/if}
          {#if starring.length}
            <div class="seo-meta-pair">
              <dt>Starring</dt>
              <dd>{starring.join(', ')}</dd>
            </div>
          {/if}
        </dl>
        {#if desc}
          <p class="seo-description">{desc}</p>
        {/if}
      </div>
    </div>
  </article>
{/if}
