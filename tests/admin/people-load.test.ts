import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer, type ViteDevServer } from 'vite';
import type { KnownPerson } from '../../src/lib/server/person-profiles';

let server: ViteDevServer;
type LoadResult = {
	people: {
		all: (KnownPerson & { mentions: number; variants: string[] })[];
		potentialMatches: unknown[];
		lookAlikeMatches: { left: KnownPerson; right: KnownPerson }[];
	};
};
let load: (input: ReturnType<typeof event>) => Promise<LoadResult>;
let instagramLoad: (input: ReturnType<typeof event>) => Promise<{
	instagramCredits: unknown[];
	missingInstagramPeople: { slug: string }[];
}>;
let quickAdd: (input: ReturnType<typeof event> & { request: Request }) => Promise<unknown>;
const originalFetch = globalThis.fetch;
const admin = { id: 'people-loader-test', email: 'people-loader-test@example.com' };
const testEnv = {
	ADMIN_EMAILS: admin.email,
	ADMIN_USER_IDS: admin.id,
	PUBLIC_SUPABASE_URL: 'https://people-loader-test.invalid',
	PUBLIC_SUPABASE_ANON_KEY: 'test-key',
	SUPABASE_SERVICE_ROLE_KEY: 'test-key'
};
const originalEnv = Object.fromEntries(Object.keys(testEnv).map((key) => [key, process.env[key]]));
const event = (user: typeof admin | null = admin) => ({
	locals: { safeGetSession: async () => ({ user }) }
});
function hasStatus(error: unknown, status: number) {
	return (
		typeof error === 'object' && error !== null && 'status' in error && error.status === status
	);
}

before(async () => {
	Object.assign(process.env, testEnv);
	server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
	({ load } = await server.ssrLoadModule('/src/routes/admin/people/+page.server.ts'));
	const instagram = await server.ssrLoadModule('/src/routes/admin/instagram/+page.server.ts');
	instagramLoad = instagram.load;
	quickAdd = instagram.actions.quickAdd;
});

after(async () => {
	globalThis.fetch = originalFetch;
	for (const [key, value] of Object.entries(originalEnv)) {
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
	}
	await server?.close();
});

test('people loader selects only credits and includes rows beyond the API page limit', async () => {
	const urls: URL[] = [];
	globalThis.fetch = async (input) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		urls.push(url);
		assert.equal(url.pathname, '/rest/v1/media_items');
		assert.equal(url.searchParams.get('select'), 'creators,starring');
		assert.equal(url.searchParams.get('order'), 'id.asc');
		assert.equal(url.searchParams.get('limit'), '1000');
		const offset = Number(url.searchParams.get('offset'));
		assert.equal(offset, (urls.length - 1) * 1000);
		const rows =
			offset === 0
				? Array.from({ length: 1000 }, () => ({ creators: ['José Smith'], starring: null }))
				: [{ creators: ['Jose Smith'], starring: ['Jose Smith Jr', 'Only On Second Page'] }];
		return Response.json(rows);
	};
	const result = await load(event());
	assert.equal(urls.length, 2);
	const jose = result.people.all.find((p) => p.slug === 'jose-smith');
	assert.ok(jose);
	assert.equal(jose.mentions, 1001);
	assert.deepEqual(jose.variants, ['José Smith', 'Jose Smith']);
	assert.equal(result.people.potentialMatches.length, 1);
	assert.ok(result.people.all.some((p) => p.slug === 'only-on-second-page'));
	assert.ok(result.people.lookAlikeMatches.some((p) => p.right.slug === 'jose-smith-jr'));
});

test('people loader rejects unauthorized requests before fetching credits', async () => {
	globalThis.fetch = async () => {
		throw new Error('Unauthorized database request');
	};
	await assert.rejects(load(event(null)), (error: unknown) => hasStatus(error, 403));
	await assert.rejects(load(event({ id: 'other', email: 'other@example.com' })), (error: unknown) =>
		hasStatus(error, 403)
	);
});

test('people loader returns a retriable error when a later credits page fails', async () => {
	let calls = 0;
	globalThis.fetch = async () => {
		calls++;
		return calls === 1
			? Response.json(
					Array.from({ length: 1000 }, () => ({ creators: ['A Person'], starring: [] }))
				)
			: Response.json({ message: 'Database temporarily unavailable' }, { status: 503 });
	};
	await assert.rejects(load(event()), (error: unknown) => hasStatus(error, 503));
	assert.equal(calls, 2);
});

test('Instagram loads credit context and profiles without songs, episodes or ratings', async () => {
	globalThis.fetch = async (input) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		if (url.pathname === '/rest/v1/media_items') {
			assert.equal(url.searchParams.get('select'), 'slug,title,type,creators,starring');
			return Response.json([
				{
					slug: 'a-film',
					title: 'A Film',
					type: 'movie',
					creators: ['Linked Creator'],
					starring: ['Sam Jones']
				}
			]);
		}
		assert.equal(url.pathname, '/rest/v1/person_profiles');
		return Response.json([
			{ slug: 'linked-creator', name: 'Linked Creator', instagram_handles: ['creatorpk'] }
		]);
	};
	const result = await instagramLoad(event());
	assert.equal(result.instagramCredits.length, 1);
	assert.deepEqual(
		result.missingInstagramPeople.map((person) => person.slug),
		['sam-jones']
	);
});

test('approval saves the selected handle and preserves existing handles', async () => {
	let writes = 0;
	globalThis.fetch = async (input, init) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		if (url.pathname === '/rest/v1/media_items') {
			assert.equal(url.searchParams.get('select'), 'creators,starring');
			return Response.json([{ creators: [], starring: ['Sam Jones'] }]);
		}
		assert.equal(url.pathname, '/rest/v1/person_profiles');
		if (init?.method === 'POST') {
			writes++;
			assert.deepEqual(JSON.parse(String(init.body)), [
				{ slug: 'sam-jones', name: 'Sam Jones', instagram_handles: ['existinghandle', 'samjones'] }
			]);
			return new Response(null, { status: 201 });
		}
		return Response.json({
			slug: 'sam-jones',
			name: 'Sam Jones',
			instagram_handles: ['existinghandle']
		});
	};
	const body = new FormData();
	body.set('slug', 'sam-jones');
	body.set('instagram_handle', '@SamJones');
	const request = new Request('https://jumpflix.example/admin/instagram?/quickAdd', {
		method: 'POST',
		body
	});
	await quickAdd({ ...event(), request });
	assert.equal(writes, 1);
});

test('Instagram includes saved profiles beyond the first API page', async () => {
	let profilePages = 0;
	globalThis.fetch = async (input) => {
		const url = new URL(input instanceof Request ? input.url : String(input));
		if (url.pathname === '/rest/v1/media_items') {
			return Response.json([
				{ slug: 'a-film', title: 'A Film', type: 'movie', creators: [], starring: ['Sam Jones'] }
			]);
		}
		assert.equal(url.pathname, '/rest/v1/person_profiles');
		assert.equal(Number(url.searchParams.get('offset')), profilePages++ * 1000);
		return Response.json(
			profilePages === 1
				? Array.from({ length: 1000 }, (_, i) => ({
						slug: `person-${i}`,
						name: `Person ${i}`,
						instagram_handles: [`handle${i}`]
					}))
				: [{ slug: 'sam-jones', name: 'Sam Jones', instagram_handles: ['samjones'] }]
		);
	};
	const result = await instagramLoad(event());
	assert.equal(profilePages, 2);
	assert.deepEqual(result.missingInstagramPeople, []);
});
