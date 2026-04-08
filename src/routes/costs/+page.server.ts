import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { isAdminUser, requireAdmin } from '$lib/server/admin';
import { loadPublicFundingData } from '$lib/server/funding';

const COST_CATEGORIES = ['hosting', 'video', 'ai', 'developer-tools', 'database', 'other'] as const;
const COST_COVERAGE = ['direct', 'sponsored', 'waived'] as const;
type CostCategory = (typeof COST_CATEGORIES)[number];
type CostCoverage = (typeof COST_COVERAGE)[number];

function asTrimmedString(value: FormDataEntryValue | null): string {
    return typeof value === 'string' ? value.trim() : '';
}

function asOptionalString(value: FormDataEntryValue | null): string | null {
    const trimmed = asTrimmedString(value);
    return trimmed ? trimmed : null;
}

function parseAmount(value: FormDataEntryValue | null): number | null {
    const parsed = Number(asTrimmedString(value));
    if (!Number.isFinite(parsed) || parsed < 0) return null;
    return parsed;
}

function parseCurrency(value: FormDataEntryValue | null): string | null {
    const currency = asTrimmedString(value).toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : null;
}

function parseDate(value: FormDataEntryValue | null): string | null {
    const raw = asTrimmedString(value);
    if (!raw) return null;
    const parsed = new Date(`${raw}T00:00:00Z`);
    return Number.isNaN(parsed.valueOf()) ? null : parsed.toISOString();
}

function hasCheckbox(form: FormData, name: string): boolean {
    return form.has(name);
}

export const load: PageServerLoad = async ({ locals }) => {
    const funding = await loadPublicFundingData();
    const { user } = await locals.safeGetSession();

    return {
        funding,
        isAdmin: isAdminUser(user),
        costCategories: [...COST_CATEGORIES],
        costCoverageOptions: [...COST_COVERAGE]
    };
};

export const actions: Actions = {
    createCost: async ({ request, locals }) => {
        const { user } = await locals.safeGetSession();
        requireAdmin(user);

        const form = await request.formData();
        const title = asTrimmedString(form.get('title'));
        const vendor = asTrimmedString(form.get('vendor'));
        const category = asTrimmedString(form.get('category'));
        const coverage = asTrimmedString(form.get('coverage'));
        const amount = parseAmount(form.get('amount'));
        const currency = parseCurrency(form.get('currency'));
        const occurredAt = parseDate(form.get('occurred_at'));

        if (!title) return fail(400, { message: 'Cost title is required.', adminSection: 'cost' });
        if (!vendor) return fail(400, { message: 'Vendor is required.', adminSection: 'cost' });
        if (!COST_CATEGORIES.includes(category as CostCategory)) {
            return fail(400, { message: 'Choose a valid cost category.', adminSection: 'cost' });
        }
        if (!COST_COVERAGE.includes(coverage as CostCoverage)) {
            return fail(400, { message: 'Choose a valid coverage state.', adminSection: 'cost' });
        }
        if (amount === null) return fail(400, { message: 'Enter a valid amount.', adminSection: 'cost' });
        if (!currency) return fail(400, { message: 'Use a 3-letter currency code.', adminSection: 'cost' });
        if (!occurredAt) return fail(400, { message: 'Choose a valid date.', adminSection: 'cost' });

        const validatedCategory = category as CostCategory;
        const validatedCoverage = coverage as CostCoverage;

        const supabase = createSupabaseServiceClient();
        const { error } = await supabase.from('project_costs').insert({
            title,
            description: asOptionalString(form.get('description')),
            vendor,
            category: validatedCategory,
            amount,
            currency,
            occurred_at: occurredAt,
            coverage: validatedCoverage,
            entry_method: 'manual',
            source_system: asOptionalString(form.get('source_system')),
            source_reference: asOptionalString(form.get('source_reference')),
            is_public: hasCheckbox(form, 'is_public')
        });

        if (error) return fail(400, { message: error.message, adminSection: 'cost' });

        return { ok: true, success: 'Cost added.', adminSection: 'cost' };
    },

    createDonation: async ({ request, locals }) => {
        const { user } = await locals.safeGetSession();
        requireAdmin(user);

        const form = await request.formData();
        const amount = parseAmount(form.get('amount'));
        const currency = parseCurrency(form.get('currency'));
        const donatedAt = parseDate(form.get('donated_at'));

        if (amount === null) return fail(400, { message: 'Enter a valid donation amount.', adminSection: 'donation' });
        if (!currency) return fail(400, { message: 'Use a 3-letter currency code.', adminSection: 'donation' });
        if (!donatedAt) return fail(400, { message: 'Choose a valid donation date.', adminSection: 'donation' });

        const supabase = createSupabaseServiceClient();
        const { error } = await supabase.from('project_donations').insert({
            supporter_name: asOptionalString(form.get('supporter_name')),
            note: asOptionalString(form.get('note')),
            amount,
            currency,
            donated_at: donatedAt,
            entry_method: 'manual',
            source_system: asOptionalString(form.get('source_system')),
            source_reference: asOptionalString(form.get('source_reference')),
            is_public: hasCheckbox(form, 'is_public')
        });

        if (error) return fail(400, { message: error.message, adminSection: 'donation' });

        return { ok: true, success: 'Donation added.', adminSection: 'donation' };
    },

    deleteCost: async ({ request, locals }) => {
        const { user } = await locals.safeGetSession();
        requireAdmin(user);

        const form = await request.formData();
        const id = Number(form.get('id'));
        if (!Number.isFinite(id)) return fail(400, { message: 'Invalid cost id.', adminSection: 'cost' });

        const supabase = createSupabaseServiceClient();
        const { error } = await supabase.from('project_costs').delete().eq('id', id);
        if (error) return fail(400, { message: error.message, adminSection: 'cost' });

        return { ok: true, success: 'Cost deleted.', adminSection: 'cost' };
    },

    deleteDonation: async ({ request, locals }) => {
        const { user } = await locals.safeGetSession();
        requireAdmin(user);

        const form = await request.formData();
        const id = Number(form.get('id'));
        if (!Number.isFinite(id)) return fail(400, { message: 'Invalid donation id.', adminSection: 'donation' });

        const supabase = createSupabaseServiceClient();
        const { error } = await supabase.from('project_donations').delete().eq('id', id);
        if (error) return fail(400, { message: error.message, adminSection: 'donation' });

        return { ok: true, success: 'Donation deleted.', adminSection: 'donation' };
    }
};