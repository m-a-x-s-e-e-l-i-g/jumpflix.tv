import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import { createServer, type ViteDevServer } from 'vite';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';

let server: ViteDevServer;
let photos: typeof import('../../src/lib/server/person-photos');
let route: any;
let move: (typeof import('../../src/lib/server/person-profiles'))['movePersonProfile'];
const originalFetch = globalThis.fetch;
const admin = { id: 'photo-test-admin', email: 'photo-test@example.com' };
const testEnv = {
	ADMIN_EMAILS: admin.email,
	ADMIN_USER_IDS: admin.id,
	PUBLIC_SUPABASE_URL: 'https://photo-test.invalid',
	PUBLIC_SUPABASE_ANON_KEY: 'test-key',
	SUPABASE_SERVICE_ROLE_KEY: 'test-key'
};
const originalEnv = Object.fromEntries(Object.keys(testEnv).map((key) => [key, process.env[key]]));
const client = () =>
	createClient<Database>('https://photo-test.invalid', 'test-key', {
		auth: { persistSession: false }
	});
const inputUrl = (input: RequestInfo | URL) =>
	new URL(input instanceof Request ? input.url : String(input));
const fixture = () =>
	sharp({ create: { width: 24, height: 40, channels: 3, background: '#708080' } })
		.png()
		.toBuffer();

before(async () => {
	Object.assign(process.env, testEnv);
	server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
	photos = (await server.ssrLoadModule('/src/lib/server/person-photos.ts')) as typeof photos;
	route = await server.ssrLoadModule('/src/routes/admin/people/photos/+page.server.ts');
	({ movePersonProfile: move } = await server.ssrLoadModule('/src/lib/server/person-profiles.ts'));
});
after(async () => {
	globalThis.fetch = originalFetch;
	for (const [key, value] of Object.entries(originalEnv)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	await server?.close();
});

test('photos are decoded, square, small WebP; unsupported and oversized images fail', async () => {
	const image = await photos.normalizePhoto(await fixture());
	const metadata = await sharp(image).metadata();
	assert.equal(metadata.format, 'webp');
	assert.equal(metadata.width, 512);
	assert.equal(metadata.height, 512);
	assert.ok(image.length < 1024 * 1024);
	assert.equal(metadata.exif, undefined);
	await assert.rejects(
		photos.normalizePhoto(Buffer.from('<svg></svg>')),
		/could not be read|still JPEG/
	);
	await assert.rejects(
		photos.normalizePhoto(new Uint8Array(photos.MAX_PHOTO_BYTES + 1)),
		/smaller than 5 MB/
	);
});

test('Instagram URL validation rejects local, lookalike and authenticated URLs', () => {
	for (const url of [
		'http://s.cdninstagram.com/a',
		'https://127.0.0.1/a',
		'https://cdninstagram.com.evil.test/a',
		'https://evilcdninstagram.com/a',
		'https://user:pass@s.cdninstagram.com/a',
		'https://s.cdninstagram.com:444/a'
	]) {
		assert.throws(() => photos.instagramImageUrl(url), /unsupported/);
	}
	assert.equal(
		photos.instagramImageUrl('https://s.cdninstagram.com/a').hostname,
		's.cdninstagram.com'
	);
});

test('photo download revalidates redirect targets and bounds streamed bytes', async () => {
	let calls = 0;
	await assert.rejects(
		photos.downloadInstagramPhoto('https://s.cdninstagram.com/photo', async () => {
			calls++;
			return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/secret' } });
		}),
		/unsupported/
	);
	assert.equal(calls, 1);
	await assert.rejects(
		photos.downloadInstagramPhoto(
			'https://s.cdninstagram.com/photo',
			async () => new Response(new Uint8Array(photos.MAX_PHOTO_BYTES + 1))
		),
		/too large/
	);
});

test('official import verifies returned identity, keeps token out of URLs and downloads without authorization', async () => {
	const source = await fixture();
	let calls = 0;
	const result = await photos.importInstagramPhoto(
		'example.athlete',
		{ token: 'secret-test', accountId: '123', version: 'v24.0' },
		async (input, init) => {
			const url = inputUrl(input);
			calls++;
			assert.ok(!url.href.includes('secret-test'));
			if (url.hostname === 'graph.facebook.com') {
				assert.equal(new Headers(init?.headers).get('authorization'), 'Bearer secret-test');
				assert.equal(
					url.searchParams.get('fields'),
					'business_discovery.username(example.athlete){username,profile_picture_url}'
				);
				return Response.json({
					business_discovery: {
						username: 'example.athlete',
						profile_picture_url: 'https://s.cdninstagram.com/photo'
					}
				});
			}
			assert.equal(new Headers(init?.headers).get('authorization'), null);
			return new Response(new Uint8Array(source));
		}
	);
	assert.equal(calls, 2);
	assert.equal((await sharp(result).metadata()).format, 'webp');
	await assert.rejects(
		photos.importInstagramPhoto('example.athlete', {}, async () => {
			throw new Error('Should not fetch');
		}),
		/not configured/
	);
	await assert.rejects(
		photos.importInstagramPhoto(
			'example.athlete',
			{ token: 'x', accountId: '123', version: 'v24.0' },
			async () =>
				Response.json({
					business_discovery: {
						username: 'wrong-account',
						profile_picture_url: 'https://s.cdninstagram.com/photo'
					}
				})
		),
		/No photo available/
	);
});

test('photo save retains handles and removes a new object if the profile write fails', async () => {
	const requests: { method: string; url: URL; body: any }[] = [];
	globalThis.fetch = async (input, init) => {
		const url = inputUrl(input);
		const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
		requests.push({
			method,
			url,
			body: typeof init?.body === 'string' ? JSON.parse(init.body) : null
		});
		if (url.pathname === '/rest/v1/person_profiles')
			return Response.json({ code: '42703', message: 'migration missing' }, { status: 400 });
		return Response.json({ Key: 'test' });
	};
	await assert.rejects(
		photos.savePersonPhoto(
			client(),
			'example-athlete',
			'Example Athlete',
			await photos.normalizePhoto(await fixture()),
			'upload',
			null
		),
		/could not be saved/
	);
	const profileWrite = requests.find(
		(request) => request.url.pathname === '/rest/v1/person_profiles'
	);
	assert.ok(profileWrite);
	assert.equal(profileWrite.body.instagram_handles, undefined);
	assert.match(profileWrite.body.profile_photo_path, /^[0-9a-f-]{36}\.webp$/);
	assert.ok(
		requests.some(
			(request) =>
				request.method === 'DELETE' &&
				request.url.pathname.includes('/storage/v1/object/person-photos')
		)
	);
});

test('person merge moves the source photo but preserves an existing target photo', async () => {
	for (const targetHasPhoto of [false, true]) {
		let saved: any;
		globalThis.fetch = async (input, init) => {
			const method = init?.method ?? 'GET';
			if (method === 'GET')
				return Response.json([
					{
						slug: 'old-name',
						name: 'Old Name',
						instagram_handles: ['old'],
						profile_photo_path: 'source.webp',
						profile_photo_source: 'upload'
					},
					{
						slug: 'new-name',
						name: 'New Name',
						instagram_handles: ['new'],
						profile_photo_path: targetHasPhoto ? 'target.webp' : null
					}
				]);
			if (method === 'POST') saved = JSON.parse(String(init?.body));
			return new Response(null, { status: 204 });
		};
		await move(client(), { fromName: 'Old Name', toName: 'New Name' });
		assert.deepEqual(saved.instagram_handles, ['old', 'new']);
		assert.equal(saved.profile_photo_path, targetHasPhoto ? undefined : 'source.webp');
	}
});

test('admin loader and save reject unauthorized requests before any data access', async () => {
	globalThis.fetch = async () => {
		throw new Error('Unauthorized network access');
	};
	for (const user of [null, { id: 'outsider', email: 'outsider@example.com' }]) {
		const event = {
			locals: { safeGetSession: async () => ({ user }) },
			request: new Request('https://test.invalid', { method: 'POST', body: new FormData() })
		};
		await assert.rejects(route.load(event), (error: any) => error.status === 403);
		await assert.rejects(route.actions.save(event), (error: any) => error.status === 403);
	}
});

test('admin upload saves a known athlete, rejecting a tampered Instagram handle', async () => {
	let writes = 0;
	globalThis.fetch = async (input, init) => {
		const url = inputUrl(input);
		if (url.pathname === '/rest/v1/media_items')
			return Response.json([{ creators: [], starring: ['Example Athlete'] }]);
		if (url.pathname === '/rest/v1/person_profiles' && (init?.method ?? 'GET') === 'GET')
			return Response.json({ instagram_handles: ['saved.handle'] });
		if (url.pathname.includes('/storage/')) return Response.json({ Key: 'photo' });
		if (url.pathname === '/rest/v1/person_profiles') {
			writes++;
			return new Response(null, { status: 204 });
		}
		throw new Error(`Unexpected request ${url.pathname}`);
	};
	const invoke = (form: FormData) =>
		route.actions.save({
			locals: { safeGetSession: async () => ({ user: admin }) },
			request: new Request('https://test.invalid', { method: 'POST', body: form })
		});
	const upload = new FormData();
	upload.set('slug', 'example-athlete');
	upload.set('method', 'upload');
	upload.set(
		'photo',
		new File([new Uint8Array(await fixture())], 'example.png', { type: 'image/png' })
	);
	const saved = await invoke(upload);
	assert.equal(saved.success, true);
	assert.equal(writes, 1);
	const tampered = new FormData();
	tampered.set('slug', 'example-athlete');
	tampered.set('method', 'instagram');
	tampered.set('handle', 'not.saved');
	const rejected = await invoke(tampered);
	assert.equal(rejected.status, 400);
	assert.match(rejected.data.message, /saved Instagram handle/);
	assert.equal(writes, 1);
});

test('missing migration keeps the list readable and blocks saves before storage writes', async () => {
	globalThis.fetch = async (input) => {
		const url = inputUrl(input);
		if (url.pathname === '/rest/v1/media_items')
			return Response.json([{ creators: [], starring: ['Example Athlete'] }]);
		assert.equal(url.pathname, '/rest/v1/person_profiles');
		if (url.searchParams.get('select')?.includes('profile_photo_path'))
			return Response.json({ code: '42703', message: 'column missing' }, { status: 400 });
		return Response.json([
			{ slug: 'example-athlete', name: 'Example Athlete', instagram_handles: ['saved.handle'] }
		]);
	};
	const locals = { safeGetSession: async () => ({ user: admin }) };
	const loaded = await route.load({ locals });
	assert.equal(loaded.migrationReady, false);
	assert.equal(loaded.people[0].photo, null);
	assert.deepEqual(loaded.people[0].handles, ['saved.handle']);
	const form = new FormData();
	form.set('slug', 'example-athlete');
	form.set('method', 'upload');
	const saved = await route.actions.save({
		locals,
		request: new Request('https://test.invalid', { method: 'POST', body: form })
	});
	assert.equal(saved.status, 400);
	assert.match(saved.data.message, /database migration/);
});

test('provider authorization and quota errors stop a batch without exposing upstream details', async () => {
	for (const code of [190, 4]) {
		await assert.rejects(
			photos.importInstagramPhoto(
				'example.athlete',
				{ token: 'secret-token', accountId: '123', version: 'v24.0' },
				async () =>
					Response.json(
						{ error: { code, message: 'Sensitive provider diagnostic' } },
						{ status: 400 }
					)
			),
			(error: any) => error.stopImport === true && !error.message.includes('Sensitive')
		);
	}
});
