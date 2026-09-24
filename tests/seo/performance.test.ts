import assert from 'node:assert/strict';
import test from 'node:test';
import { ResilientCache } from '../../src/lib/server/resilient-cache';
import { publicCacheHeaders } from '../../src/lib/server/public-cache';
import { toCatalogSummary } from '../../src/lib/tv/catalog-summary';
import { matchesSearch } from '../../src/lib/tv/utils';
import type { Movie } from '../../src/lib/tv/types';
import { metricPage } from '../../src/lib/performance';

test('cache retains good data on failure and retries shortly without extending freshness', async () => {
	let now = 0;
	const cache = new ResilientCache<string[]>(() => now, 15);
	let calls = 0;
	const load = async () => {
		calls++;
		if (calls === 2) throw new Error('offline');
		return [String(calls)];
	};
	assert.deepEqual(await cache.get(load, 100), ['1']);
	now = 101;
	assert.deepEqual(await cache.get(load, 100), ['1']);
	assert.equal(cache.fetchedAt, 0);
	now = 110;
	assert.deepEqual(await cache.get(load, 100), ['1']);
	assert.equal(calls, 2);
	now = 117;
	assert.deepEqual(await cache.get(load, 100), ['3']);
	assert.equal(cache.lastError, null);
});

test('cold failures reject instead of becoming an empty catalog, including synchronous failures', async () => {
	let now = 0;
	const cache = new ResilientCache<string[]>(() => now, 15);
	await assert.rejects(
		cache.get(() => {
			throw new Error('offline');
		})
	);
	assert.equal(cache.value, undefined);
	await assert.rejects(cache.get(async () => ['too soon']));
	now = 16;
	assert.deepEqual(await cache.get(async () => ['recovered']), ['recovered']);
});

test('concurrent loads share a request and invalidation cannot publish an older result', async () => {
	const cache = new ResilientCache<string>();
	let resolve!: (value: string) => void;
	let calls = 0;
	const load = () => {
		calls++;
		return new Promise<string>((r) => (resolve = r));
	};
	const first = cache.get(load);
	const second = cache.get(load);
	await Promise.resolve();
	assert.equal(calls, 1);
	cache.invalidate();
	await cache.get(async () => 'new');
	resolve('old');
	assert.deepEqual(await Promise.all([first, second]), ['old', 'old']);
	assert.equal(cache.value, 'new');
});

test('personalized and degraded responses are never shared-cacheable', () => {
	assert.equal(publicCacheHeaders(true)['Cache-Control'], 'private, no-store');
	assert.equal(publicCacheHeaders(false, true)['Cache-Control'], 'private, no-store');
	assert.match(publicCacheHeaders(false)['Cache-Control'], /s-maxage=300/);
});

test('compact records preserve title, description, people, song and artist search semantics', () => {
	const movie: Movie = {
		id: 1,
		slug: 'film',
		type: 'movie',
		title: 'A film',
		description: 'A rooftop adventure',
		creators: ['A Creator'],
		starring: ['An Athlete'],
		tracks: [
			{
				source: 'manual',
				startAtSeconds: 120,
				song: {
					id: 1,
					spotifyTrackId: 'metadata',
					title: 'Ça plane pour moi',
					artist: 'Plastic Bertrand'
				}
			}
		]
	};
	const compact = toCatalogSummary(movie);
	assert.ok(!('tracks' in compact));
	for (const query of [
		'film',
		'rooftop',
		'Creator',
		'Athlete',
		'ca plane pour moi',
		'bertrand plastic',
		'plane',
		'missing'
	]) {
		assert.equal(matchesSearch(compact, query), matchesSearch(movie, query), query);
	}
});

test('Web Vitals excludes account and private routes', () => {
	assert.equal(metricPage('/nl/collections/documentaries'), 'collection');
	assert.equal(metricPage('/series/example/seasons/2/episodes/3'), 'episode');
	for (const path of ['/admin', '/stats/user-id', '/auth/callback', '/oauth/token', '/api/example'])
		assert.equal(metricPage(path), null);
});
