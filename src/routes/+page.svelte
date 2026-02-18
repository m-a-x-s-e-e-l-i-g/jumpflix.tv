<script lang="ts">
	import * as m from '$lib/paraglide/messages';
	// TvPage is rendered persistently from +layout.svelte
	// This page contributes only head metadata
	let {} = $props();
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

<!-- Content rendered in layout -->
