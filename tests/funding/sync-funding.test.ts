import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { createClient } from '@supabase/supabase-js';
import {
	fetchOpenAICostRows,
	getOpenAICostsStartTime,
	main,
	syncImportedCosts
} from '../../scripts/sync-funding';
import type { Database } from '../../src/lib/supabase/types';

function env(t: TestContext, values: Record<string, string | undefined>) {
	for (const [key, value] of Object.entries(values)) {
		const original = process.env[key];
		if (value === undefined) delete process.env[key];
		else process.env[key] = value;
		t.after(() => {
			if (original === undefined) delete process.env[key];
			else process.env[key] = original;
		});
	}
}

function lookbackError(date = '2030-01-01') {
	return Response.json(
		{
			error: {
				code: 'reporting_lookback_exceeded',
				message: `Usage and cost data are available for the past year. Earliest supported start date: ${date} (UTC).`
			}
		},
		{ status: 400 }
	);
}

function bucket(date: string) {
	return {
		start_time: Date.parse(date) / 1000,
		results: [{ amount: { value: 1.25, currency: 'usd' } }]
	};
}

test('old, missing and invalid start dates clamp to the rolling UTC window', (t) => {
	for (const start of [undefined, '2024-01-01', 'invalid']) {
		env(t, { OPENAI_COSTS_START_DATE: start });
		assert.equal(
			getOpenAICostsStartTime(new Date('2026-10-08T23:59:59Z')),
			Date.parse('2025-10-08T00:00:00Z') / 1000
		);
	}
});

test('a configured start inside the reporting window is respected', (t) => {
	env(t, { OPENAI_COSTS_START_DATE: '2026-04-01' });
	assert.equal(
		getOpenAICostsStartTime(new Date('2026-10-08T03:00:00Z')),
		Date.parse('2026-04-01T00:00:00Z') / 1000
	);
});

test('365-day cutoff handles leap years and UTC date boundaries', (t) => {
	env(t, { OPENAI_COSTS_START_DATE: '2020-01-01' });
	assert.equal(
		getOpenAICostsStartTime(new Date('2024-03-01T00:00:00Z')),
		Date.parse('2023-03-02T00:00:00Z') / 1000
	);
	assert.equal(
		getOpenAICostsStartTime(new Date('2026-10-08T01:00:00+02:00')),
		Date.parse('2025-10-07T00:00:00Z') / 1000
	);
});

test('a missing OpenAI key skips import without making a request', async (t) => {
	env(t, { OPENAI_ADMIN_KEY: undefined });
	const fetchMock = t.mock.method(globalThis, 'fetch', async () => {
		throw new Error('unexpected fetch');
	});
	assert.equal(await fetchOpenAICostRows(), null);
	assert.equal(fetchMock.mock.callCount(), 0);
});

test('lookback retry restarts pagination and returns the accepted reconciliation boundary', async (t) => {
	env(t, { OPENAI_ADMIN_KEY: 'test-key', OPENAI_COSTS_START_DATE: '2024-01-01' });
	const requests: URL[] = [];
	t.mock.method(globalThis, 'fetch', async (input: URL) => {
		requests.push(new URL(input));
		switch (requests.length) {
			case 1:
				return Response.json({
					data: [bucket('2026-01-01')],
					has_more: true,
					next_page: 'old-page'
				});
			case 2:
				return lookbackError();
			case 3:
				return Response.json({
					data: [bucket('2030-01-01')],
					has_more: true,
					next_page: 'new-page'
				});
			case 4:
				return Response.json({ data: [bucket('2030-01-02')], has_more: false });
			default:
				throw new Error('unexpected extra request');
		}
	});
	const result = await fetchOpenAICostRows();
	assert.equal(result?.reconcileFrom, '2030-01-01T00:00:00.000Z');
	assert.deepEqual(
		result?.rows.map((row) => row.occurred_at),
		['2030-01-01T00:00:00.000Z', '2030-01-02T00:00:00.000Z']
	);
	assert.equal(requests[1].searchParams.get('page'), 'old-page');
	assert.equal(requests[2].searchParams.has('page'), false);
	assert.equal(requests[3].searchParams.get('page'), 'new-page');
	assert.equal(
		requests[2].searchParams.get('start_time'),
		requests[3].searchParams.get('start_time')
	);
});

test('empty results after the lookback retry complete without another request', async (t) => {
	env(t, { OPENAI_ADMIN_KEY: 'test-key', OPENAI_COSTS_START_DATE: '2024-01-01' });
	let calls = 0;
	t.mock.method(globalThis, 'fetch', async () => {
		if (++calls === 1) return lookbackError();
		assert.equal(calls, 2);
		return Response.json({ data: [], has_more: false });
	});
	assert.deepEqual(await fetchOpenAICostRows(), {
		rows: [],
		reconcileFrom: '2030-01-01T00:00:00.000Z'
	});
});

test('the lookback retry is bounded and unrelated errors still fail', async (t) => {
	env(t, { OPENAI_ADMIN_KEY: 'test-key', OPENAI_COSTS_START_DATE: '2024-01-01' });
	let calls = 0;
	const fetchMock = t.mock.method(globalThis, 'fetch', async () =>
		lookbackError(++calls === 1 ? '2030-01-01' : '2030-01-02')
	);
	await assert.rejects(fetchOpenAICostRows(), /reporting_lookback_exceeded/);
	assert.equal(calls, 2);
	fetchMock.mock.mockImplementation(async () => new Response('Unauthorized', { status: 401 }));
	await assert.rejects(fetchOpenAICostRows(), /401 Unauthorized/);
	fetchMock.mock.mockImplementation(async () =>
		Response.json(
			{ error: { code: 'reporting_lookback_exceeded', message: 'No cutoff supplied' } },
			{ status: 400 }
		)
	);
	await assert.rejects(fetchOpenAICostRows(), /400/);
});

test('Supabase reconciliation deletes stale costs within the fetched window and keeps archived history', async () => {
	const rows = [
		{ id: 1, source_reference: 'archived', occurred_at: '2024-01-01T00:00:00Z' },
		{ id: 2, source_reference: 'boundary', occurred_at: '2025-10-08T00:00:00Z' },
		{ id: 3, source_reference: 'recent', occurred_at: '2026-10-01T00:00:00Z' }
	];
	const methods: string[] = [];
	const client = createClient<Database>('https://funding.test', 'test-service-key', {
		auth: { persistSession: false },
		global: {
			fetch: async (input, init) => {
				const url = new URL(String(input));
				methods.push(init?.method ?? 'GET');
				assert.equal(url.searchParams.get('source_system') ?? 'eq.openai_api', 'eq.openai_api');
				if (init?.method === 'GET') {
					assert.equal(url.searchParams.get('occurred_at'), 'gte.2025-10-08T00:00:00.000Z');
					return Response.json(
						rows.filter((row) => Date.parse(row.occurred_at) >= Date.parse('2025-10-08'))
					);
				}
				assert.equal(init?.method, 'DELETE');
				assert.equal(url.searchParams.get('id'), 'in.(2,3)');
				return new Response(null, { status: 204 });
			}
		}
	});
	assert.deepEqual(
		await syncImportedCosts(client, 'openai_api', 'OpenAI costs', [], '2025-10-08T00:00:00.000Z'),
		{ inserted: 0, updated: 0, deleted: 2 }
	);
	assert.deepEqual(methods, ['GET', 'DELETE']);
});

test('the complete job syncs OpenAI and Bunny using the OpenAI window only for OpenAI', async (t) => {
	env(t, {
		OPENAI_ADMIN_KEY: 'test-key',
		OPENAI_COSTS_START_DATE: '2024-01-01',
		BUNNYNET_API_KEY: 'test-bunny-key',
		PUBLIC_SUPABASE_URL: 'https://funding.test',
		SUPABASE_SERVICE_ROLE_KEY: 'test-service-key'
	});
	const inserted: string[] = [];
	t.mock.method(globalThis, 'fetch', async (input: string | URL, init?: RequestInit) => {
		const url = new URL(String(input));
		if (url.hostname === 'api.openai.com')
			return Response.json({ data: [bucket(new Date().toISOString())], has_more: false });
		if (url.hostname === 'api.bunny.net')
			return Response.json({ MonthlyChargesStorage: 2.5, Currency: 'EUR' });
		assert.equal(url.hostname, 'funding.test');
		if (init?.method === 'GET') {
			assert.equal(
				url.searchParams.has('occurred_at'),
				url.searchParams.get('source_system') === 'eq.openai_api'
			);
			return Response.json([]);
		}
		assert.equal(init?.method, 'POST');
		const rows = JSON.parse(String(init?.body));
		inserted.push(rows[0].source_system);
		return new Response(null, { status: 201 });
	});
	await main();
	assert.deepEqual(inserted, ['openai_api', 'bunny_billing_api']);
});
