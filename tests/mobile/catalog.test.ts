import assert from 'node:assert/strict';
import test from 'node:test';
import {
	catalogPage,
	parseCatalogPagination,
	toMobileItem
} from '../../src/lib/server/mobile-catalog';
import type { Movie, Series } from '../../src/lib/tv/types';

const movie: Movie = {
	id: 7,
	type: 'movie',
	slug: 'the-film',
	title: 'Film &amp; movement',
	thumbnail: '/images/poster.webp',
	videoId: 'abcdefghijk',
	creators: ['A &amp; B']
};

test('public catalog has stable IDs, decoded titles, absolute artwork and official provider URLs', () => {
	const dto = toMobileItem(movie);
	assert.equal(dto.id, 'movie:7');
	assert.equal(dto.title, 'Film & movement');
	assert.deepEqual(dto.creators, ['A & B']);
	assert.equal(dto.thumbnail, 'https://www.jumpflix.tv/images/poster.webp');
	assert.deepEqual(dto.playback, {
		kind: 'youtube',
		url: 'https://www.youtube.com/watch?v=abcdefghijk'
	});
	assert.equal(dto.url, 'https://www.jumpflix.tv/movie/the-film');
});

test('paid and unavailable items never disclose inline streams or playable episodes', () => {
	const paid = toMobileItem({
		...movie,
		paid: true,
		streamUrl: 'https://video.example/secret.m3u8',
		externalUrl: 'https://creator.example/buy'
	});
	assert.deepEqual(paid.playback, { kind: 'external', url: 'https://creator.example/buy' });
	assert.ok(!JSON.stringify(paid).includes('secret'));
	assert.equal(toMobileItem({ ...movie, availabilityStatus: 'unavailable' }).playback, null);
	const series: Series = {
		...movie,
		type: 'series',
		paid: true,
		seasons: [{ seasonNumber: 1, episodes: [{ id: 'abcdefghijk', title: 'One' }] }]
	};
	assert.deepEqual(toMobileItem(series).seasons[0].episodes, []);
	assert.deepEqual(
		toMobileItem({ ...series, paid: false, availabilityStatus: 'unavailable' }).seasons[0].episodes,
		[]
	);
});

test('direct streams, Vimeo and sparse episode positions keep their playback identity', () => {
	assert.equal(
		toMobileItem({ ...movie, videoId: undefined, vimeoId: '1234567' }).playback?.kind,
		'vimeo'
	);
	assert.equal(
		toMobileItem({ ...movie, streamUrl: 'https://video.example/film.m3u8' }).playback?.kind,
		'hls'
	);
	const series: Series = {
		...movie,
		type: 'series',
		seasons: [
			{
				seasonNumber: 2,
				customName: 'Extras',
				episodes: [
					{ id: 'abcdefghijk', title: 'Third', position: 3 },
					{ id: '123', title: 'Unknown source' }
				]
			}
		]
	};
	const season = toMobileItem(series).seasons[0];
	assert.equal(season.number, 2);
	assert.equal(season.episodes[0].position, 3);
	assert.equal(season.episodes[1].playback, null);
});

test('unsafe URLs and unexpected private fields do not cross the public contract', () => {
	const dto = toMobileItem({
		...movie,
		thumbnail: 'javascript:alert(1)',
		streamUrl: 'file:///secret',
		internal_notes: 'PRIVATE',
		user_id: 'PRIVATE'
	} as Movie);
	assert.equal(dto.thumbnail, null);
	assert.equal(dto.playback, null);
	assert.ok(!JSON.stringify(dto).includes('PRIVATE'));
	assert.equal(
		toMobileItem({ ...movie, streamUrl: 'https://user:password@video.example/film.mp4' }).playback,
		null
	);
});

test('pagination is bounded and terminates exactly at the end', () => {
	assert.deepEqual(parseCatalogPagination(new URLSearchParams()), { offset: 0, limit: 100 });
	for (const query of [
		'limit=0',
		'limit=201',
		'offset=-1',
		'offset=1.5',
		'offset=1e2',
		'limit=NaN'
	]) {
		assert.equal(parseCatalogPagination(new URLSearchParams(query)), null, query);
	}
	const items = [movie, { ...movie, id: 8 }, { ...movie, id: 9 }];
	assert.equal(catalogPage(items, 0, 2).nextOffset, 2);
	assert.equal(catalogPage(items, 2, 2).nextOffset, null);
	assert.equal(catalogPage(items, 2, 2).items[0].id, 'movie:9');
	assert.deepEqual(catalogPage(items, 100, 2).items, []);
});
