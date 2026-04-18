#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import type { Database } from '../src/lib/supabase/types';

dotenv.config({ path: '.env' });

type ProjectCostInsert = Database['public']['Tables']['project_costs']['Insert'];
type ProjectCostRow = Database['public']['Tables']['project_costs']['Row'];

type OpenAICostBucket = {
	start_time?: unknown;
	end_time?: unknown;
	results?: unknown;
};

const OPENAI_COSTS_START_FALLBACK = '2024-01-01';
const OPENAI_SOURCE_SYSTEM = 'openai_api';

function requireEnv(name: string): string {
	const value = String(process.env[name] ?? '').trim();
	if (!value) {
		throw new Error(`Missing required environment variable: ${name}`);
	}
	return value;
}

function optionalEnv(name: string): string | null {
	const value = String(process.env[name] ?? '').trim();
	return value || null;
}

function toAmount(value: unknown): number {
	const parsed = typeof value === 'number' ? value : Number(value);
	return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function toCurrency(value: unknown): string {
	return typeof value === 'string' && value.trim().length === 3
		? value.trim().toUpperCase()
		: 'USD';
}

function toInteger(value: unknown): number | null {
	const parsed = typeof value === 'number' ? value : Number(value);
	if (!Number.isFinite(parsed)) return null;
	return Math.trunc(parsed);
}

function getOpenAICostsStartTime(): number {
	const configured = optionalEnv('OPENAI_COSTS_START_DATE') ?? OPENAI_COSTS_START_FALLBACK;
	const parsed = Date.parse(`${configured}T00:00:00Z`);
	if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
	return Math.floor(Date.parse(`${OPENAI_COSTS_START_FALLBACK}T00:00:00Z`) / 1000);
}

function parseOpenAIBucketRows(bucket: OpenAICostBucket): ProjectCostInsert[] {
	const startTime = toInteger(bucket.start_time);
	if (startTime === null || !Array.isArray(bucket.results)) return [];

	const totals = new Map<string, number>();
	const lineItems = new Set<string>();

	for (const result of bucket.results) {
		const amountValue = toAmount((result as { amount?: { value?: unknown } })?.amount?.value);
		if (amountValue <= 0) continue;

		const currency = toCurrency((result as { amount?: { currency?: unknown } })?.amount?.currency);
		totals.set(currency, toAmount((totals.get(currency) ?? 0) + amountValue));

		const lineItem = (result as { line_item?: unknown })?.line_item;
		if (typeof lineItem === 'string' && lineItem.trim()) {
			lineItems.add(lineItem.trim());
		}
	}

	if (!totals.size) return [];

	const occurredAt = new Date(startTime * 1000).toISOString();
	const endTime = toInteger(bucket.end_time);
	const description = lineItems.size
		? `Imported from the OpenAI billing API (${Array.from(lineItems).slice(0, 3).join(', ')}).`
		: 'Imported from the OpenAI billing API.';

	return Array.from(totals.entries()).map(([currency, amount]) => ({
		title: 'OpenAI API usage',
		description,
		vendor: 'OpenAI',
		category: 'ai',
		amount,
		currency,
		occurred_at: occurredAt,
		coverage: 'direct',
		entry_method: 'api_import',
		source_system: OPENAI_SOURCE_SYSTEM,
		source_reference: `organization/costs:${occurredAt.slice(0, 10)}:${currency}`,
		is_public: true,
		metadata: {
			bucket_start_time: startTime,
			bucket_end_time: endTime,
			line_items: Array.from(lineItems)
		}
	}));
}

async function fetchOpenAICostRows(): Promise<ProjectCostInsert[] | null> {
	const apiKey = optionalEnv('OPENAI_ADMIN_KEY');
	if (!apiKey) {
		console.log('[funding-sync] OPENAI_ADMIN_KEY not configured, skipping OpenAI cost import.');
		return null;
	}

	const headers: Record<string, string> = {
		Authorization: `Bearer ${apiKey}`,
		'Content-Type': 'application/json'
	};

	const rows: ProjectCostInsert[] = [];
	let page: string | null = null;

	do {
		const url = new URL('https://api.openai.com/v1/organization/costs');
		url.searchParams.set('start_time', String(getOpenAICostsStartTime()));
		url.searchParams.set('bucket_width', '1d');
		url.searchParams.set('limit', '180');
		if (page) url.searchParams.set('page', page);

		const response = await fetch(url, { headers });
		if (!response.ok) {
			const detail = await response.text().catch(() => '');
			throw new Error(`OpenAI costs import failed: ${response.status} ${detail || response.statusText}`);
		}

		const payload = (await response.json()) as {
			data?: unknown;
			has_more?: unknown;
			next_page?: unknown;
		};

		const buckets = Array.isArray(payload.data) ? (payload.data as OpenAICostBucket[]) : [];
		rows.push(...buckets.flatMap(parseOpenAIBucketRows));
		page = payload.has_more === true && typeof payload.next_page === 'string' && payload.next_page
			? payload.next_page
			: null;
	} while (page);

	return rows;
}

function equivalentCost(existing: Pick<ProjectCostRow, 'title' | 'description' | 'vendor' | 'category' | 'amount' | 'currency' | 'occurred_at' | 'coverage' | 'entry_method' | 'is_public' | 'metadata'>, incoming: ProjectCostInsert): boolean {
	return (
		existing.title === incoming.title &&
		(existing.description ?? null) === (incoming.description ?? null) &&
		existing.vendor === incoming.vendor &&
		existing.category === incoming.category &&
		Number(existing.amount) === Number(incoming.amount) &&
		existing.currency === incoming.currency &&
		new Date(existing.occurred_at).toISOString() === new Date(String(incoming.occurred_at)).toISOString() &&
		existing.coverage === incoming.coverage &&
		existing.entry_method === incoming.entry_method &&
		existing.is_public === incoming.is_public &&
		JSON.stringify(existing.metadata ?? {}) === JSON.stringify(incoming.metadata ?? {})
	);
}

async function syncImportedCosts(rows: ProjectCostInsert[]) {
	const supabaseUrl = requireEnv('PUBLIC_SUPABASE_URL');
	const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
	const supabase = createClient<Database>(supabaseUrl, serviceKey, {
		auth: { persistSession: false }
	});

	const { data: existingRows, error: existingError } = await supabase
		.from('project_costs')
		.select(
			'id, title, description, vendor, category, amount, currency, occurred_at, coverage, entry_method, is_public, metadata, source_system, source_reference'
		)
		.eq('source_system', OPENAI_SOURCE_SYSTEM);

	if (existingError) {
		throw new Error(existingError.message);
	}

	const existingByRef = new Map(
		(existingRows ?? [])
			.filter((row) => row.source_reference)
			.map((row) => [String(row.source_reference), row])
	);
	const incomingRefs = new Set(rows.map((row) => String(row.source_reference)));

	const inserts = rows.filter((row) => !existingByRef.has(String(row.source_reference)));
	const updates = rows
		.map((row) => ({ existing: existingByRef.get(String(row.source_reference)), incoming: row }))
		.filter((entry): entry is { existing: NonNullable<typeof entry.existing>; incoming: ProjectCostInsert } => Boolean(entry.existing))
		.filter((entry) => !equivalentCost(entry.existing, entry.incoming));
	const staleIds = (existingRows ?? [])
		.filter((row) => row.source_reference && !incomingRefs.has(String(row.source_reference)))
		.map((row) => row.id);

	if (inserts.length) {
		const { error } = await supabase.from('project_costs').insert(inserts);
		if (error) throw new Error(error.message);
	}

	for (const update of updates) {
		const { error } = await supabase
			.from('project_costs')
			.update(update.incoming)
			.eq('id', update.existing.id);
		if (error) throw new Error(error.message);
	}

	if (staleIds.length) {
		const { error } = await supabase.from('project_costs').delete().in('id', staleIds);
		if (error) throw new Error(error.message);
	}

	console.log(
		`[funding-sync] OpenAI costs synced. inserted=${inserts.length} updated=${updates.length} deleted=${staleIds.length}`
	);
	return { inserted: inserts.length, updated: updates.length, deleted: staleIds.length };
}

async function main() {
	const openAiRows = await fetchOpenAICostRows();
	if (openAiRows === null) {
		console.log('[funding-sync] No external funding sources configured.');
		return;
	}
	await syncImportedCosts(openAiRows);
	console.log('[funding-sync] Funding sync completed.');
}

main().catch((error) => {
	console.error('[funding-sync] Sync failed:', error);
	process.exit(1);
});