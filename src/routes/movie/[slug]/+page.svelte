<script lang="ts">
  import { getUrlForItem } from '$lib/tv/slug';
  import { env } from '$env/dynamic/public';
  import { decode } from 'html-entities';

  export let data: { item: any };

  const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
  let item: any;
  let title: string;
  let desc: string;
  let image: string;
  let url: string;

  $: item = data?.item;
  $: title = item ? `${decode(item.title)} (${item.year}) — Watch Parkour Film on JUMPFLIX` : 'Movie — JUMPFLIX';
  $: desc = item?.description ? decode(item.description) : 'Watch parkour films and documentaries on JUMPFLIX.';
  $: image = item?.thumbnail ? (item.thumbnail.startsWith('http') ? item.thumbnail : `https://www.jumpflix.tv${item.thumbnail}`) : 'https://www.jumpflix.tv/images/jumpflix.webp';
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

  $: jsonLdVideo = item && (item.videoId || item.vimeoId)
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

  $: creators = Array.isArray(item?.creators) ? item.creators.map((n: string) => decode(n).trim()).filter(Boolean) : [];
  $: starring = Array.isArray(item?.starring) ? item.starring.map((n: string) => decode(n).trim()).filter(Boolean) : [];
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
          {#if item.year}
            <div class="seo-meta-pair">
              <dt>Year</dt>
              <dd>{item.year}</dd>
            </div>
          {/if}
          {#if item.duration}
            <div class="seo-meta-pair">
              <dt>Duration</dt>
              <dd>{item.duration}</dd>
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
