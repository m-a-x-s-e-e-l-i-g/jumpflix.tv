import assert from 'node:assert/strict';
import test from 'node:test';

// Run against a local preview with JUMPFLIX_TEST_URL=http://127.0.0.1:5173.
// Requests are read-only and use records discovered from the site's own HTML/sitemap.
const base = process.env.JUMPFLIX_TEST_URL;
test(
	'server responses expose crawlable catalogs, valid metadata and isolated detail payloads',
	{ skip: !base, timeout: 180000 },
	async () => {
		async function page(path: string) {
			const response = await fetch(new URL(path, base));
			assert.equal(response.status, 200, path);
			const html = await response.text();
			const schemas = [
				...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)
			].map((match) => JSON.parse(match[1]));
			return { html, schemas };
		}
		const home = await page('/');
		assert.ok(!home.html.includes('%paraglide.lang%'));
		const paths = [...home.html.matchAll(/<a\b[^>]*href="(\/(?:movie|series)\/[^"?]+)"/g)].map(
			(match) => match[1]
		);
		assert.ok(paths.length > 24, 'catalog links are present before JavaScript');
		const film = paths.find((path) => path.startsWith('/movie/'))!;
		const series = paths.find((path) => path.startsWith('/series/'))!;
		for (const path of [film, series]) {
			const detail = await page(path);
			for (const schema of detail.schemas) {
				if (schema['@type'] === 'VideoObject') assert.ok(schema.uploadDate);
			}
			assert.ok(
				Buffer.byteLength(detail.html) < Buffer.byteLength(home.html) / 2,
				'detail excludes the catalog'
			);
			const dataResponse = await fetch(new URL(`${path}/__data.json`, base));
			const data = await dataResponse.json();
			for (const node of data.nodes ?? []) {
				if (node?.data?.[0])
					assert.ok(
						!Object.hasOwn(node.data[0], 'content'),
						'no catalog in any serialized detail loader'
					);
			}
		}
		for (const slug of [
			'documentaries',
			'fiction-films',
			'movie-night',
			'oldskool-classics',
			'educational',
			'send-it'
		]) {
			assert.ok(home.html.includes(`/collections/${slug}`));
			const collection = await page(`/collections/${slug}`);
			assert.ok(collection.schemas.some((schema) => schema['@type'] === 'CollectionPage'));
			assert.ok(/<a\b[^>]*href="\/(movie|series)\//.test(collection.html));
		}
		const response = await fetch(new URL('/sitemap.xml', base));
		assert.equal(response.status, 200);
		const xml = await response.text();
		const episodeUrl = [
			...xml.matchAll(/<loc>([^<]+\/seasons\/\d+\/episodes\/\d+)<\/loc>/g)
		][0]?.[1];
		assert.ok(episodeUrl, 'episodes are included in the sitemap');
		const episodePath = new URL(episodeUrl).pathname;
		const episode = await page(episodePath);
		assert.ok(episode.schemas.some((schema) => schema['@type'] === 'TVEpisode'));
		for (const path of [
			episodePath.replace(/\/episodes\/\d+$/, '/episodes/99999'),
			episodePath.replace(/\/seasons\/\d+\//, '/seasons/99999/'),
			episodePath.replace(/\/episodes\/\d+$/, '/episodes/1.5'),
			'/movie/seo-test-missing-film',
			'/collections/not-a-feed'
		]) {
			assert.equal((await fetch(new URL(path, base))).status, 404, path);
		}
	}
);
