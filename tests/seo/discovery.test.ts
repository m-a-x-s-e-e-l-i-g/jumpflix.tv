import assert from 'node:assert/strict';
import test from 'node:test';
import { decode } from 'html-entities';
import { buildDiscoveryCatalog, renderCatalogText } from '../../src/lib/server/discovery-catalog';
import { renderDiscoveryPage } from '../../src/lib/server/discovery-page';
import type { Movie, Series } from '../../src/lib/tv/types';

const film: Movie = {
	id: 1,
	type: 'movie',
	slug: 'test-film',
	title: 'A &amp; B',
	year: '2005',
	duration: '1h 12m',
	description: 'A specific synopsis. '.repeat(30),
	creators: ['A Crew', 'A Crew', ' '],
	starring: ['A Crew', 'An Athlete'],
	createdAt: '2026-10-01T12:00:00Z',
	facets: { type: 'documentary' },
	streamUrl: 'https://example.com/private?token=playback-secret',
	externalUrl: 'https://example.com/private?token=provider-secret',
	tracks: [
		{
			source: 'manual',
			song: { id: 1, title: 'Song', artist: 'Artist', spotifyTrackId: 'private-metadata' }
		}
	]
};
const series: Series = {
	id: 2,
	type: 'series',
	slug: 'test-series',
	title: 'The series',
	paid: true,
	seasons: [
		{
			seasonNumber: 2,
			episodes: [
				{ id: 'one', title: 'First', position: 1 },
				{ id: 'three', title: 'Third', position: 3 },
				{ id: 'unknown', title: 'Unknown' }
			]
		}
	]
};

test('non-Latin credits remain attributed without publishing an unresolvable person link', () => {
	const catalog = buildDiscoveryCatalog(
		[{ ...film, creators: ['日本'], starring: [] }],
		'https://example.com'
	);
	assert.equal(catalog.stats.people, 1);
	assert.equal(catalog.people[0].name, '日本');
	assert.equal(catalog.people[0].url, null);
	assert.ok(renderCatalogText(catalog, null).includes('Creators: 日本'));
	assert.ok(!renderDiscoveryPage(catalog, null).includes('href="https://example.com/people/"'));
});

test('discovery counts catalog labels and distinct per-title credits without inventing years or freshness', () => {
	const catalog = buildDiscoveryCatalog(
		[
			film,
			series,
			{
				...film,
				slug: 'unavailable',
				year: 'unknown',
				createdAt: undefined,
				paid: true,
				availabilityStatus: 'unavailable'
			}
		],
		'https://example.com/'
	);
	assert.deepEqual(catalog.stats, {
		titles: 3,
		films: 2,
		series: 1,
		documentaries: 2,
		free: 1,
		paid: 1,
		unavailable: 1,
		people: 2,
		firstYear: '2005',
		lastYear: '2005'
	});
	assert.equal(catalog.people.find((person) => person.name === 'A Crew')?.titles, 2);
	assert.deepEqual(
		catalog.recent.map((item) => item.url),
		['https://example.com/movie/test-film']
	);
	assert.equal(
		catalog.collections.find((collection) => collection.slug === 'documentaries')?.count,
		2
	);
	assert.equal(
		catalog.collections.find((collection) => collection.slug === 'movie-night')?.count,
		2
	);
});

test('text export preserves full synopses, credit URLs and sparse real episode numbers but excludes playback data', () => {
	const catalog = buildDiscoveryCatalog([series, film], 'https://example.com');
	const text = renderCatalogText(catalog, '2026-10-08T12:00:00Z');
	assert.ok(text.includes(film.description!.trim()));
	assert.ok(text.includes('[A & B](https://example.com/movie/test-film)'));
	assert.ok(text.includes('[A Crew](https://example.com/people/a-crew)'));
	assert.ok(text.includes('/series/test-series/seasons/2/episodes/3'));
	assert.ok(!text.includes('/seasons/2/episodes/2'));
	assert.ok(!text.includes('Unknown'));
	assert.doesNotMatch(text, /playback-secret|provider-secret|private-metadata/);
	assert.doesNotMatch(JSON.stringify(catalog), /streamUrl|externalUrl|spotifyTrackId|tracks/);
});

test('public HTML safely renders hostile text, has no executable scripts and exposes the complete title index', () => {
	const hostile: Movie = {
		...film,
		title: 'A </script><script>alert(1)</script>',
		description: '&lt;img src=x onerror=alert(1)&gt; [a](b)',
		creators: ['A " onclick="alert(1)']
	};
	const catalog = buildDiscoveryCatalog([hostile, series], 'https://example.com');
	const page = renderDiscoveryPage(catalog, null);
	const scripts = [...page.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/g)];
	assert.equal(scripts.length, 1);
	assert.match(scripts[0][1], /type="application\/ld\+json"/);
	const schema = JSON.parse(scripts[0][2]);
	assert.equal(schema.mainEntity.numberOfItems, 2);
	assert.deepEqual(
		schema.mainEntity.itemListElement.map((item: any) => item.name),
		catalog.items.map((item) => item.title)
	);
	for (const item of catalog.items) assert.ok(page.includes(`href="${item.url}"`));
	assert.doesNotMatch(
		page,
		/<img src=x|<script>alert|__sveltekit|googletagmanager|<iframe|playback-secret/
	);
	assert.doesNotMatch(renderCatalogText(catalog, null), /\[a\]\(b\)/);
});

const base = process.env.JUMPFLIX_TEST_URL;
test(
	'live discovery is compact, public, linked, English and identical for bots and people',
	{ skip: !base, timeout: 90000 },
	async () => {
		const response = await fetch(new URL('/discover', base));
		assert.equal(response.status, 200);
		assert.match(response.headers.get('content-type') ?? '', /text\/html/);
		assert.match(response.headers.get('cache-control') ?? '', /s-maxage=300/);
		assert.equal(response.headers.get('content-language'), 'en');
		const html = await response.text();
		const bot = await fetch(new URL('/discover', base), {
			headers: {
				'User-Agent': 'OAI-SearchBot',
				'Accept-Language': 'nl',
				Cookie: 'PARAGLIDE_LOCALE=ja'
			}
		});
		assert.equal(bot.status, 200);
		assert.equal(await bot.text(), html);
		assert.match(html, /<html lang="en">/);
		assert.match(html, /rel="canonical" href="https:\/\/www\.jumpflix\.tv\/discover"/);
		const schema = JSON.parse(html.match(/type="application\/ld\+json">([\s\S]*?)<\/script>/)![1]);
		assert.ok(schema.mainEntity.numberOfItems > 24);
		for (const item of schema.mainEntity.itemListElement) {
			assert.ok(decode(html).includes(`href="${item.url}"`));
		}
		const home = await (await fetch(new URL('/', base))).text();
		assert.match(home, /href="\/discover"/);
		assert.ok(
			Buffer.byteLength(html) < Buffer.byteLength(home) * 0.25,
			'guide HTML is less than a quarter of catalog HTML'
		);
		const textResponse = await fetch(new URL('/llms-full.txt', base));
		assert.equal(textResponse.status, 200);
		assert.match(textResponse.headers.get('content-type') ?? '', /text\/plain/);
		const text = await textResponse.text();
		for (const item of schema.mainEntity.itemListElement) assert.ok(text.includes(item.url));
		assert.doesNotMatch(text, /streamUrl|access_token|refresh_token/);
		const sitemap = await (await fetch(new URL('/sitemap.xml', base))).text();
		assert.ok(sitemap.includes('/discover</loc>'));
		// Resolve a film, series and credited person through their actual local routes.
		const links = [
			...html.matchAll(/href="(https:\/\/www\.jumpflix\.tv\/(?:movie|series|people)\/[^"#?]+)"/g)
		].map((match) => new URL(match[1]).pathname);
		for (const prefix of ['/movie/', '/series/', '/people/']) {
			const path = links.find((link) => link.startsWith(prefix));
			assert.ok(path, prefix);
			assert.equal((await fetch(new URL(path, base))).status, 200, path);
		}
	}
);
