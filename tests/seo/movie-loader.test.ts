import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import type { Movie } from '../../src/lib/tv/types';

test(
	'detail loader uses source-bound upload metadata without provider requests',
	{ timeout: 90000 },
	async () => {
		const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
		try {
			const movie: Movie = {
				id: 1,
				slug: 'sample',
				type: 'movie',
				title: 'Sample film',
				videoId: 'l8fSXGP9wvQ'
			};
			// Exercise the actual detail loader mapping with a PostgREST fixture, without a database write.
			const service = await vite.ssrLoadModule('/src/lib/server/content-service.ts');
			const originalFetch = globalThis.fetch;
			let videoId = movie.videoId;
			try {
				globalThis.fetch = async (input) => {
					const url = new URL(input instanceof Request ? input.url : String(input));
					assert.ok(
						url.pathname.startsWith('/rest/v1/'),
						'public load never requests provider metadata'
					);
					const rows = url.pathname.endsWith('/media_items')
						? [
								{
									id: 1,
									type: 'movie',
									slug: movie.slug,
									title: movie.title,
									video_id: videoId,
									thumbnail: '/poster.webp',
									video_metadata: {
										sourceKey: 'youtube/l8fSXGP9wvQ',
										publishedAt: '2012-09-02T12:23:24.000Z'
									}
								}
							]
						: [];
					return new Response(JSON.stringify(rows), {
						headers: { 'content-type': 'application/json' }
					});
				};
				const loaded = await service.fetchMovieBySlug(movie.slug);
				assert.equal(loaded.publishedAt, '2012-09-02T12:23:24.000Z');
				videoId = '2TJurAP9l-Q';
				assert.equal((await service.fetchMovieBySlug(movie.slug)).publishedAt, undefined);
			} finally {
				globalThis.fetch = originalFetch;
			}
		} finally {
			await vite.close();
		}
	}
);
