import assert from 'node:assert/strict';
import test from 'node:test';
import type { ContentItem, Movie, Series } from '../../src/lib/tv/types';
import {
	buildPeopleIndex,
	discoverCatalog,
	matchesCatalogFilters,
	mediaResourceUri,
	normalizeSpotSearchResults,
	paginateWithCursor,
	searchRelevanceScore,
	toMediaDetail,
	toMediaSummary
} from '../../src/lib/server/mcp/catalog-utils';

const movie: Movie = {
	id: 1,
	slug: 'rooftop-lines',
	type: 'movie',
	title: 'Rooftop Lines',
	description: 'A technical rooftop film from Amsterdam.',
	year: '2024',
	duration: '32m',
	videoId: 'abcdefghijk',
	streamUrl: 'https://private.example/video.m3u8',
	creators: ['Alex Camera'],
	starring: ['Sam Traceur'],
	averageRating: 8.4,
	ratingCount: 12,
	facets: {
		type: 'session',
		movement: ['technical', 'flow'],
		environment: 'rooftops',
		contentWarnings: ['strong-language']
	},
	tracks: [
		{
			startAtSeconds: 60,
			startTimecode: '1:00',
			source: 'manual',
			song: { id: 7, title: 'Skyline', artist: 'The Movers' }
		}
	]
};

const series: Series = {
	id: 2,
	slug: 'street-stories',
	type: 'series',
	title: 'Street Stories',
	description: 'A documentary series about European parkour communities.',
	creators: ['Alex Camera'],
	starring: ['Jamie Flow'],
	seasons: [{ id: 10, seasonNumber: 1 }],
	episodeCount: 8,
	facets: { type: 'documentary', environment: 'street', movement: ['flow'] }
};

const catalog: ContentItem[] = [movie, series];

test('safe detail contains public metadata but never raw stream fields', () => {
	const detail = toMediaDetail(movie, { maxTracks: 20, maxSeasons: 20 }).item;
	assert.equal(detail.description, movie.description);
	assert.equal(detail.resourceUri, 'jumpflix://catalog/movie/rooftop-lines');
	assert.equal('streamUrl' in detail, false);
	assert.equal('videoId' in detail, false);
	assert.equal('vimeoId' in detail, false);
	assert.deepEqual(detail.contentWarnings, ['strong-language']);
});

test('summary and resource URI preserve canonical catalog identity', () => {
	const summary = toMediaSummary(series);
	assert.equal(summary.url, 'https://www.jumpflix.tv/series/street-stories');
	assert.equal(summary.episodeCount, 8);
	assert.equal(mediaResourceUri(series), 'jumpflix://catalog/series/street-stories');
});

test('advanced filters combine availability, people, duration, year, warnings, and facets', () => {
	assert.equal(
		matchesCatalogFilters(movie, {
			creator: 'Alex Camera',
			athlete: 'Sam Traceur',
			yearMin: 2020,
			durationMaxMinutes: 40,
			minimumRating: 8,
			contentWarnings: ['strong-language'],
			facets: { environment: ['rooftops'], movement: ['technical'] }
		}),
		true
	);
	assert.equal(
		matchesCatalogFilters(movie, { excludeContentWarnings: ['strong-language'] }),
		false
	);
	assert.equal(matchesCatalogFilters(series, { durationMaxMinutes: 40 }), false);
});

test('relevance ranking favors an exact title over descriptive matches', () => {
	assert.ok(searchRelevanceScore(movie, 'Rooftop Lines') > searchRelevanceScore(series, 'parkour'));
	assert.ok(searchRelevanceScore(movie, 'The Movers') > 0);
});

test('cursor pagination is opaque, resumable, and rejects malformed cursors', () => {
	const first = paginateWithCursor([1, 2, 3, 4, 5], {
		page: 1,
		pageSize: 2,
		maxPageSize: 10
	});
	assert.deepEqual(first.items, [1, 2]);
	assert.equal(first.hasMore, true);
	assert.ok(first.nextCursor);

	const second = paginateWithCursor([1, 2, 3, 4, 5], {
		page: 1,
		pageSize: 2,
		cursor: first.nextCursor!,
		maxPageSize: 10
	});
	assert.deepEqual(second.items, [3, 4]);
	assert.throws(
		() =>
			paginateWithCursor([1], { page: 1, pageSize: 1, cursor: 'not-a-cursor', maxPageSize: 10 }),
		/Invalid pagination cursor/
	);
});

test('discovery excludes seed titles and explains deterministic matches', () => {
	const results = discoverCatalog(catalog, {
		seedSlugs: ['street-stories'],
		limit: 10
	});
	assert.equal(results.length, 1);
	assert.equal(results[0].item.slug, 'rooftop-lines');
	assert.ok(
		results[0].reasons.some((reason) => reason.includes('flow') || reason.includes('Alex Camera'))
	);
});

test('people index merges creator and athlete roles without duplicate media counts', () => {
	const people = buildPeopleIndex([
		movie,
		{ ...series, creators: ['Sam Traceur'], starring: ['Sam Traceur'] }
	]);
	const sam = people.find((person) => person.slug === 'sam-traceur');
	assert.deepEqual(sam?.roles, { creator: true, athlete: true });
	assert.equal(sam?.mediaCount, 2);
});

test('spot search payloads are normalized into stable public resources', () => {
	const spots = normalizeSpotSearchResults({
		data: {
			spots: [{ id: 'spot-1', name: 'Central Plaza', latitude: 52.37, longitude: 4.89 }]
		}
	});
	assert.deepEqual(spots, [
		{
			id: 'spot-1',
			name: 'Central Plaza',
			lat: 52.37,
			lng: 4.89,
			resourceUri: 'jumpflix://spots/spot-1'
		}
	]);
});
