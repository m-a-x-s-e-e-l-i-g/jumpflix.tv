import assert from 'node:assert/strict';
import test from 'node:test';
import {
	buildMovieVideoSchema,
	movieVideoSource,
	storedVideoDate
} from '../../src/lib/tv/video-discovery';
import {
	fetchMovieVideoMetadata,
	youtubeUploadDate,
	vimeoUploadDate
} from '../../src/lib/server/video-metadata';
import { verifiedDate } from '../../src/lib/seo';
import type { Movie } from '../../src/lib/tv/types';

const movie: Movie = {
	id: 1,
	slug: 'jump-london-2003',
	type: 'movie',
	title: 'Jump London',
	year: '2003',
	videoId: 'l8fSXGP9wvQ',
	thumbnail: '/images/posters/jump-london-2003.webp',
	duration: '49m'
};
const upload = '2012-09-02T12:23:24.000Z'; // Verified read-only provider sample, 2026-10-07.
const html = (id: string, dates: object) =>
	`var ytInitialPlayerResponse = ${JSON.stringify({
		videoDetails: { videoId: id, title: 'Braces { and escaped "quotes" }' },
		microformat: { playerMicroformatRenderer: dates }
	})}; var next = {};`;

test('provider upload date is imported, rather than release year or publish fallback', async () => {
	const metadata = await fetchMovieVideoMetadata(
		movie,
		async () => new Response(html(movie.videoId!, { uploadDate: upload }))
	);
	assert.deepEqual(metadata, { sourceKey: `youtube/${movie.videoId}`, publishedAt: upload });
	assert.equal(
		youtubeUploadDate(html('2TJurAP9l-Q', { uploadDate: upload }), movie.videoId!),
		undefined
	);
	assert.equal(
		youtubeUploadDate(html(movie.videoId!, { publishDate: '2003-01-01' }), movie.videoId!),
		undefined
	);
	assert.equal(youtubeUploadDate('unavailable or consent page', movie.videoId!), undefined);
});

test('Vimeo dates require the matching video and preserve its calendar date', () => {
	assert.equal(
		vimeoUploadDate({ video_id: 12345, upload_date: '2020-09-21 11:30:20' }, '12345'),
		'2020-09-21T00:00:00.000Z'
	);
	assert.equal(vimeoUploadDate({ video_id: 54321, upload_date: '2020-09-21' }, '12345'), undefined);
	for (const invalid of ['2020', '2024-02-30', '2020-99-21', 'nonsense'])
		assert.equal(verifiedDate(invalid), undefined);
});

test('source-bound metadata stops emitting a date after the playback source changes', () => {
	const metadata = { sourceKey: `youtube/${movie.videoId}`, publishedAt: upload };
	assert.equal(storedVideoDate(movie, metadata), upload);
	assert.equal(storedVideoDate({ ...movie, videoId: '2TJurAP9l-Q' }, metadata), undefined);
	assert.equal(
		storedVideoDate({ ...movie, streamUrl: 'https://example.com/new.m3u8' }, metadata),
		undefined
	);
	assert.equal(storedVideoDate(movie, { ...metadata, publishedAt: '2003' }), undefined);
});

test('VideoObject links the visible source to the canonical film and verified upload date', () => {
	const schema = buildMovieVideoSchema(
		{ ...movie, publishedAt: upload },
		'https://www.jumpflix.tv'
	);
	assert.equal(schema?.uploadDate, upload);
	assert.equal(schema?.embedUrl, movieVideoSource(movie)?.embedUrl);
	assert.equal(schema?.['@id'], 'https://www.jumpflix.tv/movie/jump-london-2003#video');
	assert.equal(schema?.about['@id'], 'https://www.jumpflix.tv/movie/jump-london-2003#movie');
	assert.equal(schema?.duration, 'PT49M');
	assert.equal(buildMovieVideoSchema(movie, 'https://www.jumpflix.tv'), null);
	assert.equal(
		buildMovieVideoSchema(
			{ ...movie, publishedAt: upload, thumbnail: undefined },
			'https://www.jumpflix.tv'
		),
		null
	);
});

test('paid, unavailable and invalid sources expose neither player nor VideoObject', () => {
	for (const item of [
		{ ...movie, paid: true },
		{ ...movie, availabilityStatus: 'unavailable' as const },
		{ ...movie, videoId: 'invalid' },
		{ ...movie, streamUrl: 'javascript:alert(1)' }
	]) {
		assert.equal(movieVideoSource(item), null);
		assert.equal(
			buildMovieVideoSchema({ ...item, publishedAt: upload }, 'https://www.jumpflix.tv'),
			null
		);
	}
});

test('provider IDs, unlisted Vimeo hashes and direct HLS sources keep their actual URLs', () => {
	assert.equal(
		movieVideoSource({ ...movie, videoId: 'https://youtu.be/l8fSXGP9wvQ' })?.embedUrl,
		'https://www.youtube.com/embed/l8fSXGP9wvQ'
	);
	assert.equal(
		movieVideoSource({ ...movie, videoId: undefined, vimeoId: '12345/abcdef' })?.embedUrl,
		'https://player.vimeo.com/video/12345?h=abcdef'
	);
	const stream = { ...movie, streamUrl: 'https://example.com/film.m3u8', publishedAt: upload };
	assert.equal(
		buildMovieVideoSchema(stream, 'https://www.jumpflix.tv')?.contentUrl,
		stream.streamUrl
	);
	assert.equal(buildMovieVideoSchema(stream, 'https://www.jumpflix.tv')?.embedUrl, undefined);
});
