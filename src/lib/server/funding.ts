import { createSupabaseClient } from '$lib/server/supabaseClient';
import type { Database } from '$lib/supabase/types';

type ProjectCostRow = Database['public']['Tables']['project_costs']['Row'];
type ProjectDonationRow = Database['public']['Tables']['project_donations']['Row'];

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

export type PublicFundingData = {
    available: boolean;
    costs: ProjectCostRow[];
    donations: ProjectDonationRow[];
    categories: FundingCategorySummary[];
    summary: FundingSummary;
};

function toAmount(value: unknown): number {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function toCurrency(value: unknown): string {
    return typeof value === 'string' && value.trim().length === 3
        ? value.trim().toUpperCase()
        : 'USD';
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

function buildCategorySummary(costs: ProjectCostRow[]): FundingCategorySummary[] {
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

function latestRecordedAt(costs: ProjectCostRow[], donations: ProjectDonationRow[]): string | null {
    let latest = 0;

    for (const row of [...costs, ...donations]) {
        const value = Date.parse(row.updated_at ?? row.created_at ?? '');
        if (Number.isFinite(value)) latest = Math.max(latest, value);
    }

    return latest > 0 ? new Date(latest).toISOString() : null;
}

export async function loadPublicFundingData(): Promise<PublicFundingData> {
    const supabase = createSupabaseClient();

    const [costsRes, donationsRes] = await Promise.all([
        supabase.from('project_costs').select('*').eq('is_public', true).order('occurred_at', { ascending: false }),
        supabase.from('project_donations').select('*').eq('is_public', true).order('donated_at', { ascending: false })
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

    const costs = (costsRes.data ?? []) as ProjectCostRow[];
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