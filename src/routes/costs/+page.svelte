<script lang="ts">
    import { enhance } from '$app/forms';

    type MoneyBucket = {
        amount: number;
        currency: string;
    };

    type CostRow = {
        id: string;
        deleteId: number | null;
        title: string;
        description: string | null;
        vendor: string;
        category: string;
        amount: number;
        currency: string;
        occurred_at: string;
        coverage: string;
        entry_method: 'manual' | 'api_import' | 'seed';
        source_system: string | null;
        source_reference: string | null;
    };

    type DonationRow = {
        id: number;
        supporter_name: string | null;
        note: string | null;
        amount: number;
        currency: string;
        donated_at: string;
        source_system: string | null;
        source_reference: string | null;
    };

    type FundingPageData = {
        funding: {
            available: boolean;
            costs: CostRow[];
            donations: DonationRow[];
            categories: Array<{ category: string; count: number; totals: MoneyBucket[] }>;
            summary: {
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
        };
        isAdmin?: boolean;
        costCategories: string[];
        costCoverageOptions: string[];
    };

    type FundingActionData = {
        ok?: boolean;
        success?: string;
        message?: string;
        adminSection?: 'cost' | 'donation';
    };

    let { data, form }: { data: FundingPageData; form: FundingActionData } = $props();

    const categoryLabels: Record<string, string> = {
        hosting: 'Hosting',
        video: 'Video',
        ai: 'AI',
        'developer-tools': 'Developer tools',
        database: 'Database',
        other: 'Other'
    };

    const coverageLabels: Record<string, string> = {
        direct: 'Direct cost',
        sponsored: 'Sponsored',
        waived: 'No bill'
    };

    const EUR_REFERENCE_RATES: Record<string, number> = {
        EUR: 1,
        USD: 0.92
    };

    function formatMoney(amount: number, currency: string): string {
        return new Intl.NumberFormat(undefined, {
            style: 'currency',
            currency,
            minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
            maximumFractionDigits: 2
        }).format(amount);
    }

    function convertToEur(amount: number, currency: string): number {
        const rate = EUR_REFERENCE_RATES[String(currency || '').toUpperCase()] ?? 1;
        return Math.round(amount * rate * 100) / 100;
    }

    function formatEuro(amount: number): string {
        return formatMoney(amount, 'EUR');
    }

    function formatBuckets(values: Array<{ amount: number; currency: string }>): string {
        if (!values?.length) return 'None logged yet';
        const total = values.reduce((sum, value) => sum + convertToEur(value.amount, value.currency), 0);
        return formatEuro(total);
    }

    function formatNet(values: Array<{ amount: number; currency: string }>): string {
        if (!values?.length) return 'No balance yet';
        const total = values.reduce((sum, value) => sum + convertToEur(value.amount, value.currency), 0);
        if (total > 0) return `+${formatEuro(total)}`;
        if (total < 0) return `-${formatEuro(Math.abs(total))}`;
        return formatEuro(0);
    }

    function formatDate(value?: string | null): string {
        if (!value) return 'Unknown date';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.valueOf())) return value;
        return parsed.toLocaleDateString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }

    function formatDateTime(value?: string | null): string {
        if (!value) return 'Unknown';
        const parsed = new Date(value);
        if (Number.isNaN(parsed.valueOf())) return value;
        return parsed.toLocaleString(undefined, {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
</script>

<svelte:head>
    <title>Costs & Donations - JUMPFLIX</title>
</svelte:head>

<div class="mx-auto w-full max-w-6xl px-4 pt-20 pb-12 md:px-8">
    <div class="jf-surface rounded-3xl p-6 md:p-8">
        <p class="jf-label">Transparency</p>
        <h1 class="mt-2 text-3xl font-semibold tracking-tight md:text-5xl">Costs & donations</h1>
        <p class="mt-3 max-w-3xl text-sm text-muted-foreground md:text-base">
            This page tracks what JUMPFLIX costs to run, what gets sponsored, and any donations that
            help offset those costs. The goal is to keep the project financially transparent instead of
            pretending infrastructure runs on magic.
        </p>
    </div>

    {#if form?.message}
        <div class="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            {form.message}
        </div>
    {/if}

    {#if form?.ok && form?.success}
        <div class="mt-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">
            {form.success}
        </div>
    {/if}

    <div class="mt-6 grid gap-4 md:grid-cols-3">
        <div class="jf-surface-soft rounded-3xl p-5">
            <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total costs</div>
            <div class="mt-3 text-2xl font-semibold text-foreground md:text-3xl">
                {formatEuro(data.funding.summary.totalCostsEur)}
            </div>
            <p class="mt-2 text-sm text-muted-foreground">{data.funding.summary.costsCount} entries logged</p>
        </div>

        <div class="jf-surface-soft rounded-3xl p-5">
            <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Total donations</div>
            <div class="mt-3 text-2xl font-semibold text-foreground md:text-3xl">
                {formatEuro(data.funding.summary.totalDonationsEur)}
            </div>
            <p class="mt-2 text-sm text-muted-foreground">{data.funding.summary.donationsCount} donations logged</p>
        </div>

        <div class="jf-surface-soft rounded-3xl p-5">
            <div class="text-xs uppercase tracking-[0.18em] text-muted-foreground">Net balance</div>
            <div class="mt-3 text-2xl font-semibold text-foreground md:text-3xl">
                {formatEuro(data.funding.summary.netBalanceEur)}
            </div>
            <p class="mt-2 text-sm text-muted-foreground">
                Last recorded change: {formatDateTime(data.funding.summary.lastRecordedAt)}
            </p>
        </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <div class="space-y-6">
            <section class="jf-surface-soft rounded-3xl p-6 md:p-8">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h2 class="text-2xl font-semibold tracking-tight md:text-3xl">Costs</h2>
                        <p class="mt-2 text-sm text-muted-foreground md:text-base">
                            Direct bills, sponsored tools, and free-tier infrastructure all live here so the
                            real operating picture stays visible.
                        </p>
                    </div>
                    <div class="text-right text-sm text-muted-foreground">
                        {formatEuro(data.funding.summary.totalCostsEur)}
                    </div>
                </div>

                {#if data.funding.categories.length > 0}
                    <div class="mt-6 flex flex-wrap gap-2">
                        {#each data.funding.categories as category}
                            <div class="rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs text-muted-foreground">
                                <span class="font-medium text-foreground">
                                    {categoryLabels[category.category] ?? category.category}
                                </span>
                                <span class="ml-2">{formatBuckets(category.totals)}</span>
                            </div>
                        {/each}
                    </div>
                {/if}

                <div class="mt-6 space-y-4">
                    {#if !data.funding.costs.length}
                        <div class="rounded-2xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                            No costs have been logged yet.
                        </div>
                    {:else}
                        {#each data.funding.costs as cost (cost.id)}
                            <article class="rounded-2xl border border-border bg-background/50 p-4 md:p-5">
                                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div class="min-w-0">
                                        <div class="flex flex-wrap items-center gap-2">
                                            <h3 class="text-lg font-semibold text-foreground">{cost.title}</h3>
                                            <span class="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                                {categoryLabels[cost.category] ?? cost.category}
                                            </span>
                                            <span class="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                                                {coverageLabels[cost.coverage] ?? cost.coverage}
                                            </span>
                                        </div>
                                        <p class="mt-1 text-sm text-muted-foreground">
                                            {cost.vendor} · {formatDateTime(cost.occurred_at)}
                                        </p>
                                        {#if cost.description}
                                            <p class="mt-3 text-sm leading-6 text-foreground/90">{cost.description}</p>
                                        {/if}
                                        {#if cost.source_system || cost.source_reference}
                                            <p class="mt-2 text-xs text-muted-foreground">
                                                Source: {cost.source_system ?? 'manual'}
                                                {#if cost.source_reference}
                                                    · {cost.source_reference}
                                                {/if}
                                            </p>
                                        {/if}
                                    </div>

                                    <div class="flex shrink-0 items-center gap-3 md:flex-col md:items-end">
                                        <div class="text-lg font-semibold text-foreground">
                                            {formatEuro(convertToEur(Number(cost.amount), cost.currency))}
                                        </div>

                                        {#if data.isAdmin && cost.deleteId !== null}
                                            <form method="POST" use:enhance>
                                                <input type="hidden" name="id" value={cost.deleteId} />
                                                <button
                                                    type="submit"
                                                    formaction="?/deleteCost"
                                                    class="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-500/15"
                                                >
                                                    Delete
                                                </button>
                                            </form>
                                        {/if}
                                    </div>
                                </div>
                            </article>
                        {/each}
                    {/if}
                </div>
            </section>

            <section class="jf-surface-soft rounded-3xl p-6 md:p-8">
                <div class="flex items-start justify-between gap-4">
                    <div>
                        <h2 class="text-2xl font-semibold tracking-tight md:text-3xl">Donations</h2>
                        <p class="mt-2 text-sm text-muted-foreground md:text-base">
                            Support that comes in to help pay for the project gets logged separately here.
                        </p>
                    </div>
                    <div class="text-right text-sm text-muted-foreground">
                        {formatEuro(data.funding.summary.totalDonationsEur)}
                    </div>
                </div>

                <div class="mt-6 space-y-4">
                    {#if !data.funding.donations.length}
                        <div class="rounded-2xl border border-border bg-background/40 p-4 text-sm text-muted-foreground">
                            No donations have been logged yet.
                        </div>
                    {:else}
                        {#each data.funding.donations as donation (donation.id)}
                            <article class="rounded-2xl border border-border bg-background/50 p-4 md:p-5">
                                <div class="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                    <div class="min-w-0">
                                        <h3 class="text-lg font-semibold text-foreground">
                                            {donation.supporter_name || 'Anonymous supporter'}
                                        </h3>
                                        <p class="mt-1 text-sm text-muted-foreground">
                                            {formatDate(donation.donated_at)}
                                        </p>
                                        {#if donation.note}
                                            <p class="mt-3 text-sm leading-6 text-foreground/90">{donation.note}</p>
                                        {/if}
                                        {#if donation.source_system || donation.source_reference}
                                            <p class="mt-2 text-xs text-muted-foreground">
                                                Source: {donation.source_system ?? 'manual'}
                                                {#if donation.source_reference}
                                                    · {donation.source_reference}
                                                {/if}
                                            </p>
                                        {/if}
                                    </div>

                                    <div class="flex shrink-0 items-center gap-3 md:flex-col md:items-end">
                                        <div class="text-lg font-semibold text-foreground">
                                            {formatEuro(convertToEur(Number(donation.amount), donation.currency))}
                                        </div>

                                        {#if data.isAdmin}
                                            <form method="POST" use:enhance>
                                                <input type="hidden" name="id" value={donation.id} />
                                                <button
                                                    type="submit"
                                                    formaction="?/deleteDonation"
                                                    class="rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-100 transition hover:bg-red-500/15"
                                                >
                                                    Delete
                                                </button>
                                            </form>
                                        {/if}
                                    </div>
                                </div>
                            </article>
                        {/each}
                    {/if}
                </div>
            </section>
        </div>

        <div class="space-y-6">
            <section class="jf-surface rounded-3xl p-6">
                <h2 class="text-xl font-semibold tracking-tight text-foreground">What is already covered?</h2>
                <div class="mt-4 space-y-3 text-sm leading-6 text-muted-foreground">
                    <p>
                        Netlify hosting is currently on a sponsored open source plan, so recurring hosting is
                        mostly zero until an actual bill appears.
                    </p>
                    <p>
                        Supabase is still on the free plan.
                    </p>
                    <p>
                        OpenAI API costs and Bunny.net bills import automatically when billing access is configured
                        on the server.
                    </p>
                </div>
            </section>

            {#if data.isAdmin}
                <section class="jf-surface rounded-3xl p-6">
                    <h2 class="text-xl font-semibold tracking-tight text-foreground">Manual cost entry</h2>
                    <p class="mt-2 text-sm text-muted-foreground">
                        Use this for bills or sponsorship notes that do not come from an API yet.
                    </p>

                    <form method="POST" use:enhance class="mt-5 space-y-4">
                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Title</span>
                                <input name="title" required class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Vendor</span>
                                <input name="vendor" required class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                        </div>

                        <label class="space-y-1.5 text-sm">
                            <span class="text-muted-foreground">Description</span>
                            <textarea name="description" rows="3" class="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground focus:border-primary focus:outline-none"></textarea>
                        </label>

                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Category</span>
                                <select name="category" class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none">
                                    {#each data.costCategories as category}
                                        <option value={category}>{categoryLabels[category] ?? category}</option>
                                    {/each}
                                </select>
                            </label>
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Coverage</span>
                                <select name="coverage" class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none">
                                    {#each data.costCoverageOptions as coverage}
                                        <option value={coverage}>{coverageLabels[coverage] ?? coverage}</option>
                                    {/each}
                                </select>
                            </label>
                        </div>

                        <div class="grid gap-4 sm:grid-cols-3">
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Amount</span>
                                <input name="amount" type="number" min="0" step="0.01" required class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Currency</span>
                                <input name="currency" value="EUR" maxlength="3" required class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground uppercase focus:border-primary focus:outline-none" />
                            </label>
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Date</span>
                                <input name="occurred_at" type="date" required class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                        </div>

                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Source system</span>
                                <input name="source_system" placeholder="manual, netlify_api, openai_api..." class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Source reference</span>
                                <input name="source_reference" placeholder="invoice id, transaction id..." class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                        </div>

                        <label class="flex items-center gap-2 text-sm text-muted-foreground">
                            <input type="checkbox" name="is_public" checked />
                            <span>Visible on the public transparency page</span>
                        </label>

                        <button type="submit" formaction="?/createCost" class="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                            Add cost
                        </button>
                    </form>
                </section>

                <section class="jf-surface rounded-3xl p-6">
                    <h2 class="text-xl font-semibold tracking-tight text-foreground">Manual donation entry</h2>
                    <p class="mt-2 text-sm text-muted-foreground">
                        Log direct support here so the donations section stays complete too.
                    </p>

                    <form method="POST" use:enhance class="mt-5 space-y-4">
                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Supporter name</span>
                                <input name="supporter_name" placeholder="Optional" class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Date</span>
                                <input name="donated_at" type="date" required class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                        </div>

                        <label class="space-y-1.5 text-sm">
                            <span class="text-muted-foreground">Note</span>
                            <textarea name="note" rows="3" class="w-full rounded-xl border border-border bg-background/70 px-4 py-3 text-foreground focus:border-primary focus:outline-none"></textarea>
                        </label>

                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Amount</span>
                                <input name="amount" type="number" min="0" step="0.01" required class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Currency</span>
                                <input name="currency" value="EUR" maxlength="3" required class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground uppercase focus:border-primary focus:outline-none" />
                            </label>
                        </div>

                        <div class="grid gap-4 sm:grid-cols-2">
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Source system</span>
                                <input name="source_system" placeholder="manual, buymeacoffee, stripe..." class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                            <label class="space-y-1.5 text-sm">
                                <span class="text-muted-foreground">Source reference</span>
                                <input name="source_reference" placeholder="transaction id..." class="w-full rounded-xl border border-border bg-background/70 px-4 py-2.5 text-foreground focus:border-primary focus:outline-none" />
                            </label>
                        </div>

                        <label class="flex items-center gap-2 text-sm text-muted-foreground">
                            <input type="checkbox" name="is_public" checked />
                            <span>Visible on the public transparency page</span>
                        </label>

                        <button type="submit" formaction="?/createDonation" class="rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:opacity-90">
                            Add donation
                        </button>
                    </form>
                </section>
            {/if}
        </div>
    </div>
</div>