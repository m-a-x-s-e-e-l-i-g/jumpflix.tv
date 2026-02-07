<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { page } from '$app/stores';
  import { getUrlForItem } from '$lib/tv/slug';
  import { decode } from 'html-entities';
  import type { ContentItem } from '$lib/tv/types';

  let {} = $props();
  const content = $derived((($page?.data as any)?.content ?? []) as ContentItem[]);
  const movies = $derived(content.filter((c) => c.type === 'movie'));
  const series = $derived(content.filter((c) => c.type === 'series'));
</script>

<svelte:head>
  <title>JUMPFLIX — Parkour & Freerunning Films, Docs, and Series</title>
  <meta name="description" content={m.tv_description()} />
  <link rel="canonical" href="https://www.jumpflix.tv/" />
  <!-- Social -->
  <meta property="og:title" content="JUMPFLIX — Parkour & Freerunning Films" />
  <meta property="og:description" content={m.tv_description()} />
  <meta property="og:url" content="https://www.jumpflix.tv/" />
  <meta property="og:image" content="https://www.jumpflix.tv/images/jumpflix.webp" />
  <meta name="twitter:title" content="JUMPFLIX — Parkour & Freerunning Films" />
  <meta name="twitter:description" content={m.tv_description()} />
  <meta name="twitter:image" content="https://www.jumpflix.tv/images/jumpflix.webp" />
  <!-- JSON-LD Website -->
  <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "JUMPFLIX",
      "url": "https://www.jumpflix.tv/",
      "inLanguage": "%paraglide.lang%",
      "potentialAction": {
        "@type": "SearchAction",
        "target": "https://www.jumpflix.tv/?q={search_term_string}",
        "query-input": "required name=search_term_string"
      }
    }
  </script>
</svelte:head>

<section class="seo-content" aria-label="Browse catalog">
  {#if movies.length}
    <h2>Parkour Films</h2>
    <ul class="seo-catalog-list">
      {#each movies as movie}
        <li>
          <a href={getUrlForItem(movie)}>{decode(movie.title)}{movie.year ? ` (${movie.year})` : ''}</a>
        </li>
      {/each}
    </ul>
  {/if}
  {#if series.length}
    <h2>Parkour Series</h2>
    <ul class="seo-catalog-list">
      {#each series as s}
        <li>
          <a href={getUrlForItem(s)}>{decode(s.title)}</a>
        </li>
      {/each}
    </ul>
  {/if}
</section>
