#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import type { Database, Json } from '../src/lib/supabase/types';

dotenv.config({ path: '.env' });

type ProjectCostInsert = Database['public']['Tables']['project_costs']['Insert'];
type ProjectCostRow = Database['public']['Tables']['project_costs']['Row'];

type OpenAICostBucket = {
	start_time?: unknown;
	end_time?: unknown;
	results?: unknown;
};

type BunnyBillingRecord = Record<string, unknown>;

type ExternalFundingSource = {
	sourceSystem: string;
	displayName: string;
	rows: ProjectCostInsert[] | null;
};

const OPENAI_COSTS_START_FALLBACK = '2024-01-01';
const OPENAI_SOURCE_SYSTEM = 'openai_api';
const BUNNY_SOURCE_SYSTEM = 'bunny_billing_api';

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

function firstString(...values: unknown[]): string | null {
	for (const value of values) {
		if (typeof value === 'string' && value.trim()) {
			return value.trim();
		}
	}
	return null;
}

function firstFiniteNumber(...values: unknown[]): number | null {
	for (const value of values) {
		const parsed = typeof value === 'number' ? value : Number(value);
		if (Number.isFinite(parsed)) {
			return Math.round(parsed * 100) / 100;
		}
	}
	return null;
}

function normalizeIsoDate(value: unknown): string | null {
	if (typeof value !== 'string' || !value.trim()) return null;
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) return null;
	return new Date(parsed).toISOString();
}

function pickBunnyCategory(record: BunnyBillingRecord): ProjectCostInsert['category'] {
	const haystack = [
		firstString(record['Type']),
		firstString(record['Category']),
		firstString(record['Description']),
		firstString(record['ProductName']),
		firstString(record['ServiceType'])
	]
		.filter(Boolean)
		.join(' ')
		.toLowerCase();

	if (haystack.includes('stream') || haystack.includes('video') || haystack.includes('cdn')) {
		return 'video';
	}
	if (haystack.includes('storage') || haystack.includes('volume')) {
		return 'database';
	}
	return 'other';
}

function extractBunnyRecords(payload: unknown): BunnyBillingRecord[] {
	if (Array.isArray(payload)) {
		return payload.filter((entry): entry is BunnyBillingRecord => Boolean(entry) && typeof entry === 'object');
	}

	if (!payload || typeof payload !== 'object') {
		throw new Error('Bunny billing response was not an object or array.');
	}

	const container = payload as Record<string, unknown>;
	const candidates = [
		container['Items'],
		container['Data'],
		container['Results'],
		container['Records'],
		container['Invoices'],
		container['BillingRequests'],
		container['History'],
		container['BillingHistory']
	];

	for (const candidate of candidates) {
		if (Array.isArray(candidate)) {
			return candidate.filter((entry): entry is BunnyBillingRecord => Boolean(entry) && typeof entry === 'object');
		}
	}

	throw new Error('Could not find a bill list in the Bunny billing response.');
}

function mapBunnyRecordToCost(record: BunnyBillingRecord): ProjectCostInsert | null {
	const amount = firstFiniteNumber(
		record['Amount'],
		record['TotalAmount'],
		record['Total'],
		record['GrandTotal'],
		record['Price']
	);
	if (amount === null || amount <= 0) return null;

	const occurredAt =
		normalizeIsoDate(record['Date']) ??
		normalizeIsoDate(record['CreatedAt']) ??
		normalizeIsoDate(record['BillingDate']) ??
		normalizeIsoDate(record['IssueDate']) ??
		normalizeIsoDate(record['GeneratedAt']);
	if (!occurredAt) return null;

	const reference =
		firstString(
			record['Id'],
			record['ID'],
			record['Guid'],
			record['Number'],
			record['InvoiceNumber'],
			record['Reference']
		) ?? `${occurredAt.slice(0, 10)}:${amount}:${toCurrency(record['Currency'] ?? record['CurrencyCode'])}`;

	const description =
		firstString(record['Description'], record['Note'], record['Details'], record['ProductName']) ??
		'Imported from the Bunny.net billing API.';

	const invoiceLabel = firstString(record['Number'], record['InvoiceNumber'], record['Reference']);

	return {
		title: invoiceLabel ? `Bunny.net bill ${invoiceLabel}` : 'Bunny.net bill',
		description,
		vendor: 'Bunny.net',
		category: pickBunnyCategory(record),
		amount,
		currency: toCurrency(record['Currency'] ?? record['CurrencyCode']),
		occurred_at: occurredAt,
		coverage: 'direct',
		entry_method: 'api_import',
		source_system: BUNNY_SOURCE_SYSTEM,
		source_reference: `billing:${reference}`,
		is_public: true,
		metadata: record as Json
	};
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

async function fetchBunnyBillingRows(): Promise<ProjectCostInsert[] | null> {
	const apiKey = optionalEnv('BUNNYNET_API_KEY') ?? optionalEnv('BUNNY_API_KEY');
	if (!apiKey) {
		console.log('[funding-sync] BUNNYNET_API_KEY not configured, skipping Bunny billing import.');
		return null;
	}

	const response = await fetch('https://api.bunny.net/billing', {
		headers: {
			AccessKey: apiKey,
			Accept: 'application/json'
		}
	});

	if (!response.ok) {
		const detail = await response.text().catch(() => '');
		throw new Error(`Bunny billing import failed: ${response.status} ${detail || response.statusText}`);
	}

	const payload = (await response.json()) as unknown;
	const records = extractBunnyRecords(payload);
	const rows = records.map(mapBunnyRecordToCost).filter((row): row is ProjectCostInsert => Boolean(row));

	if (!rows.length && records.length) {
		throw new Error('Bunny billing import returned records, but none matched the expected bill shape.');
	}

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

function createSupabaseServiceClient() {
	const supabaseUrl = requireEnv('PUBLIC_SUPABASE_URL');
	const serviceKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY');
	return createClient<Database>(supabaseUrl, serviceKey, {
		auth: { persistSession: false }
	});
}

async function syncImportedCosts(
	supabase: ReturnType<typeof createClient<Database>>,
	sourceSystem: string,
	displayName: string,
	rows: ProjectCostInsert[]
) {
	const { data: existingRows, error: existingError } = await supabase
		.from('project_costs')
		.select(
			'id, title, description, vendor, category, amount, currency, occurred_at, coverage, entry_method, is_public, metadata, source_system, source_reference'
		)
		.eq('source_system', sourceSystem);

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
		`[funding-sync] ${displayName} synced. inserted=${inserts.length} updated=${updates.length} deleted=${staleIds.length}`
	);
	return { inserted: inserts.length, updated: updates.length, deleted: staleIds.length };
}

async function main() {
	const sources: ExternalFundingSource[] = [
		{
			sourceSystem: OPENAI_SOURCE_SYSTEM,
			displayName: 'OpenAI costs',
			rows: await fetchOpenAICostRows()
		},
		{
			sourceSystem: BUNNY_SOURCE_SYSTEM,
			displayName: 'Bunny.net bills',
			rows: await fetchBunnyBillingRows()
		}
	];

	const configuredSources = sources.filter(
		(source): source is ExternalFundingSource & { rows: ProjectCostInsert[] } => source.rows !== null
	);

	if (!configuredSources.length) {
		console.log('[funding-sync] No external funding sources configured.');
		return;
	}

	const supabase = createSupabaseServiceClient();
	for (const source of configuredSources) {
		await syncImportedCosts(supabase, source.sourceSystem, source.displayName, source.rows);
	}

	console.log('[funding-sync] Funding sync completed.');
}

main().catch((error) => {
	console.error('[funding-sync] Sync failed:', error);
	process.exit(1);
});