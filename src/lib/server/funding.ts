import { createSupabaseClient } from '$lib/server/supabaseClient';
import { env } from '$env/dynamic/private';
import type { Database, Json } from '$lib/supabase/types';

type ProjectCostRow = Database['public']['Tables']['project_costs']['Row'];
type ProjectDonationRow = Database['public']['Tables']['project_donations']['Row'];
type ProjectCostCategory = ProjectCostRow['category'];
type ProjectCostCoverage = ProjectCostRow['coverage'];
type ProjectCostEntryMethod = ProjectCostRow['entry_method'];

const EUR_REFERENCE_RATES: Record<string, number> = {
    EUR: 1,
    USD: 0.92
};

export type MoneyBucket = {
    currency: string;
    amount: number;
};

export type FundingCategorySummary = {
    category: string;
    totals: MoneyBucket[];
    count: number;
};

export type FundingSummary = {
    totalCosts: MoneyBucket[];
    totalDonations: MoneyBucket[];
    netBalance: MoneyBucket[];
	totalCostsEur: number;
	totalDonationsEur: number;
	netBalanceEur: number;
    costsCount: number;
    donationsCount: number;
    lastRecordedAt: string | null;
};

export type FundingCostRow = {
    id: string;
    deleteId: number | null;
    title: string;
    description: string | null;
    vendor: string;
    category: ProjectCostCategory;
    amount: number;
    currency: string;
    occurred_at: string;
    coverage: ProjectCostCoverage;
    entry_method: ProjectCostEntryMethod;
    source_system: string | null;
    source_reference: string | null;
    metadata: Json;
    created_at: string;
    updated_at: string;
};

export type PublicFundingData = {
    available: boolean;
    costs: FundingCostRow[];
    donations: ProjectDonationRow[];
    categories: FundingCategorySummary[];
    summary: FundingSummary;
};

type OpenAICostBucket = {
    start_time?: unknown;
    end_time?: unknown;
    results?: unknown;
};

const OPENAI_COSTS_START_FALLBACK = '2024-01-01';

function toAmount(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
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

function emptyFundingData(available = false): PublicFundingData {
    return {
        available,
        costs: [],
        donations: [],
        categories: [],
        summary: {
            totalCosts: [],
            totalDonations: [],
            netBalance: [],
			totalCostsEur: 0,
			totalDonationsEur: 0,
			netBalanceEur: 0,
            costsCount: 0,
            donationsCount: 0,
            lastRecordedAt: null
        }
    };
}

function isMissingFundingTableError(error: { message?: string } | null): boolean {
    const message = String(error?.message ?? '').toLowerCase();
    return (
        message.includes('project_costs') ||
        message.includes('project_donations')
    ) && (message.includes('does not exist') || message.includes('relation') || message.includes('schema cache'));
}

function toMoneyBuckets(values: Array<{ currency: unknown; amount: unknown }>): MoneyBucket[] {
    const totals = new Map<string, number>();

    for (const value of values) {
        const currency = toCurrency(value.currency);
        totals.set(currency, (totals.get(currency) ?? 0) + toAmount(value.amount));
    }

    return Array.from(totals.entries())
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => a.currency.localeCompare(b.currency));
}

function mergeBuckets(costs: MoneyBucket[], donations: MoneyBucket[]): MoneyBucket[] {
    const totals = new Map<string, number>();

    for (const bucket of donations) {
        totals.set(bucket.currency, (totals.get(bucket.currency) ?? 0) + bucket.amount);
    }

    for (const bucket of costs) {
        totals.set(bucket.currency, (totals.get(bucket.currency) ?? 0) - bucket.amount);
    }

    return Array.from(totals.entries())
        .map(([currency, amount]) => ({ currency, amount }))
        .sort((a, b) => a.currency.localeCompare(b.currency));
}

function roundCurrency(value: number): number {
    return Math.round(value * 100) / 100;
}

function toApproxEur(values: Array<{ currency: unknown; amount: unknown }>): number {
    let total = 0;

    for (const value of values) {
        const currency = toCurrency(value.currency);
        const rate = EUR_REFERENCE_RATES[currency];
        if (!rate) continue;
        total += toAmount(value.amount) * rate;
    }

    return roundCurrency(total);
}

function buildCategorySummary(costs: FundingCostRow[]): FundingCategorySummary[] {
    const groups = new Map<string, { count: number; values: Array<{ currency: string; amount: number }> }>();

    for (const cost of costs) {
        const category = cost.category;
        const existing = groups.get(category) ?? { count: 0, values: [] };
        existing.count += 1;
        existing.values.push({ currency: cost.currency, amount: toAmount(cost.amount) });
        groups.set(category, existing);
    }

    return Array.from(groups.entries())
        .map(([category, value]) => ({
            category,
            count: value.count,
            totals: toMoneyBuckets(value.values)
        }))
        .sort((a, b) => a.category.localeCompare(b.category));
}

function latestRecordedAt(costs: FundingCostRow[], donations: ProjectDonationRow[]): string | null {
    let latest = 0;

    for (const row of [...costs, ...donations]) {
        const value = Date.parse(row.updated_at ?? row.created_at ?? '');
        if (Number.isFinite(value)) latest = Math.max(latest, value);
    }

    return latest > 0 ? new Date(latest).toISOString() : null;
}

function normalizeCostRow(row: ProjectCostRow): FundingCostRow {
    return {
        id: String(row.id),
        deleteId: row.id,
        title: row.title,
        description: row.description,
        vendor: row.vendor,
        category: row.category,
        amount: toAmount(row.amount),
        currency: toCurrency(row.currency),
        occurred_at: row.occurred_at,
        coverage: row.coverage,
        entry_method: row.entry_method,
        source_system: row.source_system,
        source_reference: row.source_reference,
        metadata: row.metadata,
        created_at: row.created_at,
        updated_at: row.updated_at
    };
}

function getOpenAICostsStartTime(): number {
    const configured = String(env.OPENAI_COSTS_START_DATE ?? '').trim() || OPENAI_COSTS_START_FALLBACK;
    const parsed = Date.parse(`${configured}T00:00:00Z`);
    if (Number.isFinite(parsed)) return Math.floor(parsed / 1000);
    return Math.floor(Date.parse(`${OPENAI_COSTS_START_FALLBACK}T00:00:00Z`) / 1000);
}

function parseOpenAIBucketRows(bucket: OpenAICostBucket): FundingCostRow[] {
    const startTime = toInteger(bucket.start_time);
    if (startTime === null || !Array.isArray(bucket.results)) return [];

    const totals = new Map<string, number>();
    const lineItems = new Set<string>();

    for (const result of bucket.results) {
        const amountValue = toAmount((result as { amount?: { value?: unknown } })?.amount?.value);
        if (amountValue <= 0) continue;
        const currency = toCurrency((result as { amount?: { currency?: unknown } })?.amount?.currency);
        totals.set(currency, roundCurrency((totals.get(currency) ?? 0) + amountValue));

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
        id: `openai:${startTime}:${currency}`,
        deleteId: null,
        title: 'OpenAI API usage',
        description,
        vendor: 'OpenAI',
        category: 'ai',
        amount,
        currency,
        occurred_at: occurredAt,
        coverage: 'direct',
        entry_method: 'api_import',
        source_system: 'openai_api',
        source_reference: `organization/costs:${occurredAt.slice(0, 10)}`,
        metadata: {
            bucket_start_time: startTime,
            bucket_end_time: endTime,
            line_items: Array.from(lineItems)
        },
        created_at: occurredAt,
        updated_at: occurredAt
    }));
}

async function loadOpenAICostRows(): Promise<FundingCostRow[]> {
    const apiKey = String(env.OPENAI_ADMIN_KEY ?? '').trim();
    if (!apiKey) return [];

    const headers: Record<string, string> = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
    };

    const organization = String(env.OPENAI_ORG_ID ?? '').trim();
    if (organization) headers['OpenAI-Organization'] = organization;

    const rows: FundingCostRow[] = [];
    let page: string | null = null;

    try {
        do {
            const url = new URL('https://api.openai.com/v1/organization/costs');
            url.searchParams.set('start_time', String(getOpenAICostsStartTime()));
            url.searchParams.set('bucket_width', '1d');
            url.searchParams.set('limit', '180');
            if (page) url.searchParams.set('page', page);

            const response = await fetch(url, { headers });
            if (!response.ok) {
                const detail = await response.text().catch(() => '');
                console.warn('OpenAI costs import failed:', response.status, detail || response.statusText);
                return [];
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
    } catch (error) {
        console.warn('OpenAI costs import failed:', error);
        return [];
    }

    return rows;
}

export async function loadPublicFundingData(): Promise<PublicFundingData> {
    const supabase = createSupabaseClient();

    const [costsRes, donationsRes, openAICosts] = await Promise.all([
        supabase.from('project_costs').select('*').eq('is_public', true).order('occurred_at', { ascending: false }),
        supabase.from('project_donations').select('*').eq('is_public', true).order('donated_at', { ascending: false }),
        loadOpenAICostRows()
    ]);

    if (isMissingFundingTableError(costsRes.error) || isMissingFundingTableError(donationsRes.error)) {
        return emptyFundingData(false);
    }

    if (costsRes.error) {
        throw new Error(costsRes.error.message);
    }

    if (donationsRes.error) {
        throw new Error(donationsRes.error.message);
    }

        const costs = [
		...((costsRes.data ?? []) as ProjectCostRow[]).map(normalizeCostRow),
		...openAICosts
	].sort((a, b) => Date.parse(b.occurred_at) - Date.parse(a.occurred_at));
    const donations = (donationsRes.data ?? []) as ProjectDonationRow[];
    const totalCosts = toMoneyBuckets(costs.map((cost) => ({ currency: cost.currency, amount: cost.amount })));
    const totalDonations = toMoneyBuckets(
        donations.map((donation) => ({ currency: donation.currency, amount: donation.amount }))
    );

    return {
        available: true,
        costs,
        donations,
        categories: buildCategorySummary(costs),
        summary: {
            totalCosts,
            totalDonations,
            netBalance: mergeBuckets(totalCosts, totalDonations),
			totalCostsEur: toApproxEur(costs.map((cost) => ({ currency: cost.currency, amount: cost.amount }))),
			totalDonationsEur: toApproxEur(
				donations.map((donation) => ({ currency: donation.currency, amount: donation.amount }))
			),
			netBalanceEur: roundCurrency(
				toApproxEur(donations.map((donation) => ({ currency: donation.currency, amount: donation.amount }))) -
					toApproxEur(costs.map((cost) => ({ currency: cost.currency, amount: cost.amount })))
			),
            costsCount: costs.length,
            donationsCount: donations.length,
            lastRecordedAt: latestRecordedAt(costs, donations)
        }
    };
}