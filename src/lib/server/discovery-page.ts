import { serializeJsonLd } from '../seo';
import { DISCOVERY_DESCRIPTION, DISCOVERY_TITLE, type DiscoveryCatalog } from './discovery-catalog';

function html(value: string | number) {
	return String(value)
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function metadata(item: DiscoveryCatalog['items'][number]) {
	return [item.type === 'series' ? 'Series' : item.year, item.duration, item.access]
		.filter(Boolean)
		.map((value) => html(value!))
		.join(' · ');
}

const css = `
:root {
	color-scheme: light;
	--paper: oklch(0.968 0.012 83);
	--ink: oklch(0.26 0.024 45);
	--muted: oklch(0.48 0.024 45);
	--line: oklch(0.83 0.022 75);
	--red: oklch(0.47 0.16 29);
}
* {
	box-sizing: border-box;
}
html {
	scroll-padding-top: 24px;
}
body {
	margin: 0;
	background: var(--paper);
	color: var(--ink);
	font:
		16px/1.65 'Public Sans',
		sans-serif;
}
a {
	color: inherit;
	text-underline-offset: 4px;
}
a:hover {
	color: var(--red);
}
a:focus-visible,
summary:focus-visible {
	outline: 2px solid var(--red);
	outline-offset: 5px;
}
p {
	max-width: 65ch;
	margin: 0 0 1rem;
}
h1,
h2,
h3 {
	font-family: 'Merriweather', serif;
	font-weight: 500;
	line-height: 1.18;
	letter-spacing: -0.025em;
}
h1 {
	max-width: 14ch;
	font-size: clamp(2.5rem, 6vw, 4.5rem);
	margin: 24px 0;
}
h2 {
	font-size: clamp(1.65rem, 3vw, 2.2rem);
	margin: 0 0 24px;
}
h3 {
	font-size: 1.15rem;
	margin: 0 0 8px;
}
.wrap {
	max-width: 1120px;
	margin: auto;
	padding: 0 32px;
}
.skip {
	position: absolute;
	top: -100px;
	left: 16px;
	background: var(--paper);
	padding: 12px;
	z-index: 1;
}
.skip:focus {
	top: 8px;
}
header {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 24px;
	padding: 24px 0;
	border-bottom: 1px solid var(--line);
}
.brand {
	font-weight: 800;
	letter-spacing: 0.1em;
	text-decoration: none;
	border-bottom: 3px solid var(--red);
}
nav {
	display: flex;
	flex-wrap: wrap;
	gap: 24px;
	font-size: 0.875rem;
}
nav a {
	text-decoration: none;
}
.hero {
	padding: 64px 0 40px;
}
.eyebrow,
.section-label {
	color: var(--red);
	font-size: 0.7rem;
	font-weight: 700;
	letter-spacing: 0.16em;
	text-transform: uppercase;
}
.dek {
	font-size: 1.15rem;
	color: var(--muted);
}
.actions {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 24px;
	margin: 24px 0;
}
.button {
	background: var(--ink);
	color: var(--paper);
	padding: 12px 20px;
	text-decoration: none;
	font-weight: 600;
	font-size: 0.9rem;
}
.button:hover {
	background: var(--red);
	color: var(--paper);
}
.small {
	font-size: 0.8rem;
	color: var(--muted);
}
.figures {
	display: grid;
	grid-template-columns: repeat(4, 1fr);
	gap: 24px;
	margin: 0;
	padding: 28px 0;
	border-top: 1px solid var(--line);
	border-bottom: 1px solid var(--line);
}
.figures div {
	display: flex;
	flex-direction: column-reverse;
}
.figures dt {
	font-size: 0.8rem;
	color: var(--muted);
}
.figures dd {
	font-family: 'Merriweather', serif;
	font-size: clamp(1.8rem, 4vw, 2.5rem);
	margin: 0;
}
.catalog-note {
	margin-top: 12px;
}
.section {
	display: grid;
	grid-template-columns: 140px minmax(0, 1fr);
	gap: 32px;
	padding: 48px 0;
	border-bottom: 1px solid var(--line);
}
.section-label {
	padding-top: 8px;
}
.collection-list,
.recent-list {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	gap: 0 32px;
}
.collection,
.recent {
	padding: 24px 0;
	border-top: 1px solid var(--line);
}
.collection h3 a,
.recent h3 a {
	text-decoration: none;
}
.collection p,
.recent p {
	font-size: 0.9rem;
	color: var(--muted);
	margin-bottom: 12px;
}
.count,
.meta {
	font-size: 0.75rem;
	color: var(--muted);
}
.people {
	list-style: none;
	padding: 0;
	margin: 0;
	columns: 2;
	column-gap: 32px;
}
.people li {
	break-inside: avoid;
	display: flex;
	justify-content: space-between;
	gap: 16px;
	padding: 10px 0;
	border-bottom: 1px solid var(--line);
}
.people a {
	text-decoration: none;
	overflow-wrap: anywhere;
}
.people span {
	white-space: nowrap;
}
.directory {
	display: grid;
	grid-template-columns: repeat(2, minmax(0, 1fr));
	list-style: none;
	padding: 0;
	gap: 0 32px;
	margin: 20px 0 0;
}
.directory li {
	border-bottom: 1px solid var(--line);
	min-width: 0;
}
.directory a {
	display: block;
	text-decoration: none;
	padding: 12px 0;
}
.directory .title {
	display: block;
	font-weight: 600;
	font-size: 0.9rem;
	overflow-wrap: anywhere;
}
.directory .meta {
	display: block;
}
summary {
	cursor: pointer;
	font-size: 1.05rem;
	font-weight: 600;
	padding: 12px 0;
}
.faq h3 {
	font-size: 1rem;
	margin-top: 24px;
}
.faq p {
	font-size: 0.95rem;
	color: var(--muted);
}
footer {
	display: flex;
	justify-content: space-between;
	flex-wrap: wrap;
	gap: 24px;
	padding: 32px 0 48px;
	font-size: 0.8rem;
	color: var(--muted);
}
footer p {
	margin: 0;
}
footer a {
	margin-right: 16px;
}
@media (max-width: 680px) {
	.wrap {
		padding: 0 20px;
	}
	header {
		align-items: flex-start;
		gap: 16px;
	}
	nav {
		gap: 12px;
		justify-content: flex-end;
		font-size: 0.75rem;
	}
	.hero {
		padding: 40px 0 28px;
	}
	.figures {
		grid-template-columns: repeat(2, 1fr);
		gap: 20px;
	}
	.section {
		grid-template-columns: 1fr;
		gap: 16px;
		padding: 32px 0;
	}
	.collection-list,
	.recent-list,
	.directory {
		grid-template-columns: 1fr;
	}
	.people {
		columns: 1;
	}
	.dek {
		font-size: 1rem;
	}
}
`;

export function renderDiscoveryPage(catalog: DiscoveryCatalog, checkedAt: string | null) {
	const { origin, stats } = catalog;
	const schema = {
		'@context': 'https://schema.org',
		'@type': 'CollectionPage',
		'@id': `${origin}/discover#guide`,
		url: `${origin}/discover`,
		name: DISCOVERY_TITLE,
		description: DISCOVERY_DESCRIPTION,
		inLanguage: 'en',
		isPartOf: { '@id': `${origin}/#website` },
		about: [
			{ '@type': 'Thing', name: 'Parkour cinema' },
			{ '@type': 'Thing', name: 'Freerunning films' }
		],
		mainEntity: {
			'@type': 'ItemList',
			itemListOrder: 'https://schema.org/ItemListOrderAscending',
			numberOfItems: stats.titles,
			itemListElement: catalog.items.map((item, index) => ({
				'@type': 'ListItem',
				position: index + 1,
				name: item.title,
				url: item.url
			}))
		}
	};
	return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${html(DISCOVERY_TITLE)}</title><meta name="description" content="${html(DISCOVERY_DESCRIPTION)}">
<link rel="canonical" href="${html(origin)}/discover"><link rel="icon" href="/favicon.ico">
<link rel="alternate" type="text/plain" href="${html(origin)}/llms-full.txt" title="JUMPFLIX catalog as text">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Merriweather:wght@400;500&amp;family=Public+Sans:wght@400;600;700;800&amp;display=optional">
<meta property="og:type" content="website"><meta property="og:title" content="${html(DISCOVERY_TITLE)}">
<meta property="og:description" content="${html(DISCOVERY_DESCRIPTION)}"><meta property="og:url" content="${html(origin)}/discover">
<meta property="og:image" content="${html(origin)}/images/jumpflix.webp"><meta name="twitter:card" content="summary_large_image">
<style>${css}</style><script type="application/ld+json">${serializeJsonLd(schema)}</script>
</head><body><a class="skip" href="#main">Skip to film guide</a><div class="wrap">
<header><a class="brand" href="${html(origin)}/">JUMPFLIX</a><nav aria-label="Main navigation"><a href="#collections">Collections</a><a href="#titles">Title index</a><a href="${html(origin)}/">Open catalog ↗</a></nav></header>
<main id="main"><section class="hero" aria-labelledby="guide-title"><div class="eyebrow">The film guide</div>
<h1 id="guide-title">A field guide to parkour cinema.</h1>
<p class="dek">Parkour and freerunning films, documentaries, series and classic edits. A community-curated archive of movement, stories and the people behind them.</p>
<div class="actions"><a class="button" href="${html(origin)}/">Find something to watch</a><a href="#collections">Explore the collections</a></div>
<p class="small">Browse without an account. Official viewing sources. Creators credited.</p></section>
<dl class="figures"><div><dt>Films &amp; videos</dt><dd>${stats.films}</dd></div><div><dt>Series</dt><dd>${stats.series}</dd></div><div><dt>Tagged documentaries</dt><dd>${stats.documentaries}</dd></div><div><dt>Credited people &amp; crews</dt><dd>${stats.people}</dd></div></dl>
<p class="small catalog-note">${stats.titles} catalog titles · ${stats.free} listed as free · ${stats.paid} paid · ${stats.unavailable} unavailable.${stats.firstYear ? ` Known film release years: ${html(stats.firstYear)}–${html(stats.lastYear!)}.` : ''}${checkedAt ? ` Snapshot checked <time datetime="${html(checkedAt)}">${html(checkedAt.slice(0, 10))}</time>.` : ''}</p>
<section id="collections" class="section" aria-labelledby="collections-title"><div class="section-label">01 / Find your way</div><div><h2 id="collections-title">Start with a collection.</h2>
<div class="collection-list">${catalog.collections.map((collection) => `<article class="collection"><h3><a href="${html(collection.url)}">${html(collection.title)}</a></h3><p>${html(collection.description)}</p><span class="count">${collection.count} titles</span></article>`).join('')}</div></div></section>
${catalog.recent.length ? `<section class="section" aria-labelledby="recent-title"><div class="section-label">02 / Archive additions</div><div><h2 id="recent-title">Recently added to JUMPFLIX.</h2><p class="small">New to the catalog, from any era. These are archive additions, not a ranking.</p><div class="recent-list">${catalog.recent.map((item) => `<article class="recent"><h3><a href="${html(item.url)}">${html(item.title)}</a></h3><p class="meta">${metadata(item)}</p>${item.description ? `<p>${html(item.description.length > 180 ? item.description.slice(0, 177).trimEnd() + '…' : item.description)}</p>` : ''}</article>`).join('')}</div></div></section>` : ''}
<section class="section" aria-labelledby="people-title"><div class="section-label">03 / Behind the films</div><div><h2 id="people-title">People &amp; crews.</h2><p>Follow a creator or athlete through the archive. These names have the most title credits in this catalog; the counts reflect credits, not popularity.</p><ul class="people">${catalog.people
		.slice(0, 12)
		.map(
			(person) =>
				`<li>${person.url ? `<a href="${html(person.url)}">${html(person.name)}</a>` : html(person.name)}<span class="count">${person.titles} ${person.titles === 1 ? 'title' : 'titles'}</span></li>`
		)
		.join('')}</ul></div></section>
<section id="titles" class="section" aria-labelledby="titles-title"><div class="section-label">04 / The full archive</div><div><h2 id="titles-title">Every title, A–Z.</h2><p>Looking for a particular film? Each entry leads to its synopsis, known credits and viewing information.</p><details><summary>Browse all ${stats.titles} titles</summary><ul class="directory">${catalog.items.map((item) => `<li><a href="${html(item.url)}"><span class="title">${html(item.title)}</span><span class="meta">${metadata(item)}</span></a></li>`).join('')}</ul></details></div></section>
<section class="section" aria-labelledby="about-title"><div class="section-label">05 / About the archive</div><div class="faq"><h2 id="about-title">Film culture, kept in view.</h2>
<p>JUMPFLIX brings together parkour and freerunning films that are scattered across the web. The archive includes short edits, feature-length films, documentaries and series. Community submissions are reviewed before they become part of the catalog.</p>
<h3>Where can I watch parkour films?</h3><p>Open a title in JUMPFLIX for its available viewing options. Videos use official sources such as YouTube, Vimeo, creator-approved streams and paid providers. JUMPFLIX respects the creators’ access restrictions.</p>
<h3>Is everything free?</h3><p>No. Free, paid and unavailable entries are labeled separately. Labels reflect the catalog; providers can change availability or apply regional restrictions. Unavailable films stay in the archive for reference.</p>
<h3>Do I need an account?</h3><p>You can browse without signing in. An account adds personal watch history, ratings, reviews and contribution features.</p>
<h3>How do I find documentaries or classic parkour videos?</h3><p>Try <a href="${html(origin)}/collections/documentaries">Documentaries</a> for titles tagged documentary, or <a href="${html(origin)}/collections/oldskool-classics">Oldskool Classics</a> for releases from 2015 and earlier. Use the main catalog to search titles, creators and athletes.</p>
<p><a href="${html(origin)}/about">Read the JUMPFLIX story</a> · <a href="${html(origin)}/video-map">Explore the video map</a></p></div></section>
</main><footer><p>JUMPFLIX · Parkour cinema, curated for the culture.</p><div><a href="${html(origin)}/llms-full.txt">Catalog as text</a><a href="${html(origin)}/privacy-policy">Privacy</a><a href="${html(origin)}/terms-of-service">Terms</a></div></footer>
</div></body></html>`;
}
