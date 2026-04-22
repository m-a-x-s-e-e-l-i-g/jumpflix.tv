<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		getManualFacetDescription,
		getManualFacetLabel,
		MANUAL_FACET_CONFIGS,
		MANUAL_FACET_KEYS,
		type ManualFacetKey
	} from '$lib/tv/facet-options';

	type Item = {
		id: number;
		slug: string;
		title: string;
		type: 'movie' | 'series';
		description: string | null;
		year: string | null;
		duration: string | null;
		thumbnail: string | null;
		updated_at: string;
		creators: string[] | null;
		starring: string[] | null;
	};

	type PageDataShape = {
		activeFacetKey: ManualFacetKey;
		items: Item[];
		error: string | null;
	};

	type ActionDataShape = {
		message?: string;
		success?: string;
	};

	export let data: PageDataShape;
	export let form: ActionDataShape | undefined;

	function itemHref(item: { type: 'movie' | 'series'; slug: string }) {
		return item.type === 'series' ? `/series/${item.slug}` : `/movie/${item.slug}`;
	}

	function fmtDate(value?: string | null) {
		if (!value) return '';
		try {
			return new Date(value).toLocaleString();
		} catch {
			return value;
		}
	}

	function listText(values: string[] | null | undefined) {
		if (!values?.length) return null;
		return values.join(', ');
	}

	function descriptionPreview(value: string | null | undefined) {
		const normalized = String(value ?? '')
			.replace(/\s+/g, ' ')
			.trim();
		if (!normalized) return null;
		return normalized.length > 220 ? `${normalized.slice(0, 217).trimEnd()}...` : normalized;
	}

	$: items = data.items ?? [];
	$: activeFacet = MANUAL_FACET_CONFIGS[data.activeFacetKey];
	$: queueNoun = activeFacet.mode === 'multiple' ? 'at least one label yet' : 'a stored label';
	$: assignmentHint =
		activeFacet.mode === 'multiple'
			? 'One click seeds the first value for the media record.'
			: 'One click writes the chosen value to the media record.';
	$: activeFacetOptions = activeFacet.options as string[];
	$: emptyTitle =
		activeFacet.mode === 'multiple'
			? `Every item has at least one ${activeFacet.singularLabel}.`
			: `Every item has a ${activeFacet.singularLabel}.`;
	$: emptyBody =
		activeFacet.mode === 'multiple'
			? 'This queue only lists media that still needs its first label in this facet group, so there is nothing left to seed right now.'
			: 'This page only lists media that still needs a stored value for this facet, so there is nothing left to assign right now.';
	$: movieCount = items.filter((item: Item) => item.type === 'movie').length;
	$: seriesCount = items.filter((item: Item) => item.type === 'series').length;
</script>

<div class="mx-auto w-full max-w-7xl px-6 pt-20 pb-16">
	<div class="jf-surface rounded-[2rem] p-6 md:p-8">
		<p class="jf-label">Admin desk</p>
		<div class="mt-4 flex flex-wrap gap-2">
			{#each MANUAL_FACET_KEYS as facetKey (facetKey)}
				<a
					href={`?facet=${facetKey}`}
					class={`rounded-full border px-3 py-1.5 text-[11px] uppercase tracking-[0.18em] transition ${
						facetKey === data.activeFacetKey
							? 'border-[#e50914]/45 bg-[#e50914]/16 text-white'
							: 'border-white/12 bg-white/[0.04] text-white/55 hover:border-white/20 hover:text-white/82'
					}`}
				>
					{MANUAL_FACET_CONFIGS[facetKey].navLabel}
				</a>
			{/each}
		</div>
		<div class="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
			<div class="max-w-3xl">
				<h1 class="text-3xl font-semibold text-white">Missing {activeFacet.pluralLabel}</h1>
				<p class="mt-2 max-w-2xl text-sm leading-6 text-white/60">
					Only media items with no stored {activeFacet.singularLabel} or {queueNoun} are shown
					here. {activeFacet.mode === 'multiple'
						? 'Pick one starting label and the item will drop out of the queue.'
						: 'Pick one label and the item will drop out of the queue.'}
				</p>
			</div>
			<div class="grid grid-cols-3 gap-3 text-left sm:min-w-[19rem]">
				<div class="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
					<div class="text-[11px] uppercase tracking-[0.18em] text-white/45">Queue</div>
					<div class="mt-1 text-2xl font-semibold text-white">{items.length}</div>
				</div>
				<div class="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
					<div class="text-[11px] uppercase tracking-[0.18em] text-white/45">Movies</div>
					<div class="mt-1 text-2xl font-semibold text-white">{movieCount}</div>
				</div>
				<div class="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3">
					<div class="text-[11px] uppercase tracking-[0.18em] text-white/45">Series</div>
					<div class="mt-1 text-2xl font-semibold text-white">{seriesCount}</div>
				</div>
			</div>
		</div>
	</div>

	{#if form?.message}
		<div class="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
			{form.message}
		</div>
	{/if}

	{#if form?.success}
		<div class="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
			{form.success}
		</div>
	{/if}

	{#if data.error}
		<div class="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-100">
			{data.error}
		</div>
	{/if}

	{#if !items.length}
		<div class="mt-6 rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-6 py-10 text-center">
			<div class="text-sm uppercase tracking-[0.24em] text-white/45">Queue clear</div>
			<h2 class="mt-3 text-2xl font-semibold text-white">{emptyTitle}</h2>
			<p class="mx-auto mt-2 max-w-xl text-sm leading-6 text-white/60">
				{emptyBody}
			</p>
		</div>
	{:else}
		<div class="mt-6 grid gap-4">
			{#each items as item (item.id)}
				<form
					method="POST"
					action="?/assign"
					use:enhance
					class="overflow-hidden rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.055),rgba(255,255,255,0.025))]"
				>
					<input type="hidden" name="id" value={item.id} />
					<input type="hidden" name="facetKey" value={data.activeFacetKey} />
					<div class="grid gap-0 lg:grid-cols-[minmax(0,1fr)_25rem]">
						<div class="p-5 md:p-6">
							<div class="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
								<div class="min-w-0">
									<div class="flex flex-wrap items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-white/45">
										<span class="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] tracking-[0.18em] text-white/55">
											{item.type}
										</span>
										{#if item.year}
											<span>{item.year}</span>
										{/if}
										{#if item.duration}
											<span>{item.duration}</span>
										{/if}
									</div>
									<h2 class="mt-3 truncate text-2xl font-semibold text-white">{item.title}</h2>
									<div class="mt-2 flex flex-wrap items-center gap-3 text-sm text-white/55">
										<a
											href={itemHref(item)}
											target="_blank"
											rel="noreferrer"
											class="transition hover:text-white"
										>
											Open public page
										</a>
										<span class="text-white/25">/</span>
										<span class="font-mono text-xs text-white/45">{item.slug}</span>
										<span class="text-white/25">/</span>
										<span class="text-xs text-white/45">Updated {fmtDate(item.updated_at)}</span>
									</div>
								</div>
								{#if item.thumbnail}
									<img
										src={item.thumbnail}
										alt={item.title}
										class="h-24 w-24 rounded-2xl border border-white/10 object-cover md:h-28 md:w-28"
									/>
								{/if}
							</div>

							<div class="mt-5 grid gap-3 text-sm text-white/65 md:grid-cols-2">
								{#if descriptionPreview(item.description)}
									<div class="md:col-span-2">
										<div class="text-[11px] uppercase tracking-[0.16em] text-white/40">Description</div>
										<p class="mt-1 max-w-[75ch] leading-6 text-white/68">
											{descriptionPreview(item.description)}
										</p>
									</div>
								{/if}
								<div>
									<div class="text-[11px] uppercase tracking-[0.16em] text-white/40">Creators</div>
									<div class="mt-1 leading-6 text-white/70">{listText(item.creators) ?? 'None listed'}</div>
								</div>
								<div>
									<div class="text-[11px] uppercase tracking-[0.16em] text-white/40">Starring</div>
									<div class="mt-1 leading-6 text-white/70">{listText(item.starring) ?? 'None listed'}</div>
								</div>
							</div>
						</div>

						<div class="border-t border-white/10 bg-black/20 p-5 lg:border-t-0 lg:border-l">
							<div class="text-[11px] uppercase tracking-[0.18em] text-white/45">
								Assign {activeFacet.singularLabel}
							</div>
							<p class="mt-2 text-sm leading-6 text-white/60">
								{assignmentHint}
							</p>
							<div class="mt-4 grid gap-2">
								{#each activeFacetOptions as facetValue (facetValue)}
									<button
										type="submit"
										name="facetValue"
										value={facetValue}
										class="rounded-2xl border border-white/15 bg-white/[0.05] px-4 py-3 text-left transition hover:border-[#e50914]/40 hover:bg-[#e50914]/14"
									>
										<div class="text-sm font-medium text-white/82">{getManualFacetLabel(data.activeFacetKey, facetValue)}</div>
										<div class="mt-1 text-xs leading-5 text-white/52">
											{getManualFacetDescription(data.activeFacetKey, facetValue)}
										</div>
									</button>
								{/each}
							</div>
						</div>
					</div>
				</form>
			{/each}
		</div>
	{/if}
</div>