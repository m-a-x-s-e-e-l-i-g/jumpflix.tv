import assert from 'node:assert/strict';
import test from 'node:test';
import { serializeJsonLd, verifiedDate } from '../../src/lib/seo';
import { findEpisode } from '../../src/lib/tv/episode-selection';
import { buildSitemap } from '../../src/lib/server/sitemap';
import { FEEDS } from '../../src/lib/tv/feeds';
import { matchesFeed } from '../../src/lib/tv/utils';
import type { Movie, Series } from '../../src/lib/tv/types';

const series: Series = {
	id: 1,
	type: 'series',
	slug: 'a-series',
	title: 'A series',
	seasons: [
		{
			seasonNumber: 1,
			episodes: [
				{ id: 'abcdefghijk', title: 'First', position: 1 },
				{ id: 'lmnopqrstuv', title: 'Third', position: 3 }
			]
		},
		{ seasonNumber: 2, episodes: [{ id: 'another', title: 'Season two', position: 1 }] }
	]
};

test('episode lookup validates actual records, not array indices or rounded numbers', () => {
	assert.equal(findEpisode(series, '1', '3')?.episode.title, 'Third');
	assert.equal(findEpisode(series, '2', '1')?.episode.title, 'Season two');
	for (const [season, episode] of [
		['1', '2'],
		['1', '99999'],
		['3', '1'],
		['0', '1'],
		['1', '1.5'],
		['1', '1e0'],
		['1', '-1'],
		['NaN', '1'],
		['01', '1']
	]) {
		assert.equal(findEpisode(series, season, episode), null, `${season}/${episode}`);
	}
});

test('JSON-LD safely round-trips literal HTML without closing its script element', () => {
	const value = {
		name: 'Film </script><script>alert(1)</script>',
		description: '< & > \u2028 \u2029'
	};
	const json = serializeJsonLd(value);
	assert.ok(!json.includes('<'));
	assert.deepEqual(JSON.parse(json), value);
});

test('a release year is not treated as a verified video publication date', () => {
	assert.equal(verifiedDate('2025'), undefined);
	assert.equal(verifiedDate('invalid'), undefined);
	assert.equal(verifiedDate(undefined), undefined);
	assert.equal(verifiedDate('2025-05-13T15:00:00Z'), '2025-05-13T15:00:00.000Z');
});

test('sitemap includes all feed routes, real episodes and undated people without invented lastmod', () => {
	const movie: Movie = {
		id: 2,
		type: 'movie',
		slug: 'a-film',
		title: 'A film',
		creators: ['A Person'],
		facets: { type: 'documentary' }
	};
	const xml = buildSitemap(
		'https://example.com/',
		[movie, series],
		[{ slug: series.slug, seasonNumber: 2, episodeNumber: 1, updatedAt: '2026-09-24T10:00:00Z' }]
	);
	for (const feed of FEEDS) assert.ok(xml.includes(`/collections/${feed.slug}</loc>`));
	assert.ok(xml.includes('/series/a-series/seasons/2/episodes/1</loc>'));
	assert.ok(xml.includes('<url><loc>https://example.com/people/a-person</loc></url>'));
	assert.ok(xml.includes('<url><loc>https://example.com/</loc></url>'));
	assert.ok(!xml.includes('/people/a-person/'));
	assert.ok(xml.includes('/about</loc>') && xml.includes('/video-map</loc>'));
});

test('existing collection membership rules keep their boundaries', () => {
	const movie: Movie = {
		id: 2,
		type: 'movie',
		slug: 'film',
		title: 'Film',
		year: '2015',
		duration: '1h',
		facets: { type: 'documentary', movement: ['big-sends'] }
	};
	assert.equal(matchesFeed(movie, 'documentaries'), true);
	assert.equal(matchesFeed(movie, 'fiction-films'), false);
	assert.equal(matchesFeed(movie, 'movie-night'), true);
	assert.equal(matchesFeed({ ...movie, duration: '59m' }, 'movie-night'), false);
	assert.equal(matchesFeed({ ...movie, duration: '161m' }, 'movie-night'), false);
	assert.equal(matchesFeed(movie, 'oldskool-classics'), true);
	assert.equal(matchesFeed({ ...movie, year: '2016' }, 'oldskool-classics'), false);
	assert.equal(matchesFeed(movie, 'send-it'), true);
	assert.equal(matchesFeed({ ...movie, facets: { type: 'talk' } }, 'educational'), true);
});
