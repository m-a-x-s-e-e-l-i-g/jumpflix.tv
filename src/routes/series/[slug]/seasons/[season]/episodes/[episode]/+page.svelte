<script lang="ts">
  import { env } from '$env/dynamic/public';
  import { getEpisodeUrl, getUrlForItem } from '$lib/tv/slug';
  import { decode } from 'html-entities';
  export let data: { item: any; initialEpisodeNumber: number; initialSeasonNumber: number | null };
  const item = data?.item;
  const ep = data?.initialEpisodeNumber;
  const season = data?.initialSeasonNumber ?? null;

  const origin = (env.PUBLIC_SITE_URL || 'https://www.jumpflix.tv').replace(/\/$/, '');
  $: s = typeof season === 'number' && season >= 1 ? season : 1;
  $: e = typeof ep === 'number' && ep >= 1 ? ep : 1;
  $: code = `s${String(s).padStart(2, '0')}e${String(e).padStart(2, '0')}`;
  $: title = item ? `${decode(item.title)} ${code} — Watch Parkour Series on JUMPFLIX` : 'Series Episode — JUMPFLIX';
  $: desc = item?.description
    ? `${decode(item.description)} (Episode ${e}${s ? `, Season ${s}` : ''})`
    : `Watch ${item?.title ? `${item.title} ${code}` : 'this parkour series episode'} on JUMPFLIX.`;
  $: image = item?.thumbnail
    ? (item.thumbnail.startsWith('http') ? item.thumbnail : `https://www.jumpflix.tv${item.thumbnail}`)
    : 'https://www.jumpflix.tv/images/jumpflix.webp';
  $: url = item ? `${origin}${getEpisodeUrl(item, { episodeNumber: e, seasonNumber: s })}` : origin;
  $: seriesUrl = item ? `${origin}${getUrlForItem(item)}` : origin;
  $: structuredData = {
    '@context': 'https://schema.org',
    '@type': 'TVEpisode',
    name: item ? `${decode(item.title)} ${code}` : 'Series Episode',
    partOfSeries: item
      ? { '@type': 'TVSeries', name: decode(item.title), url: origin + getUrlForItem(item) }
      : undefined,
    episodeNumber: e,
    seasonNumber: s,
    description: desc,
    url
  };
</script>

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

  <script type="application/ld+json">{@html JSON.stringify(structuredData).replace(/</g, '\\u003c')}</script>
</svelte:head>

{#if item}
  <article class="seo-content" aria-label="{decode(item.title ?? '')} {code}">
    <nav aria-label="Breadcrumb" class="seo-breadcrumb">
      <ol>
        <li><a href="/">Home</a></li>
        <li><a href={seriesUrl}>{decode(item.title ?? '')}</a></li>
        <li aria-current="page">Season {s}, Episode {e}</li>
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
        <h1>{decode(item.title ?? '')} — {code}</h1>
        <dl>
          <div class="seo-meta-pair">
            <dt>Season</dt>
            <dd>{s}</dd>
          </div>
          <div class="seo-meta-pair">
            <dt>Episode</dt>
            <dd>{e}</dd>
          </div>
        </dl>
        {#if desc}
          <p class="seo-description">{desc}</p>
        {/if}
      </div>
    </div>
  </article>
{/if}
