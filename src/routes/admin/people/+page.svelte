<script lang="ts">
	import { enhance } from '$app/forms';
	import { toast } from 'svelte-sonner';
	import type { ActionData, PageData } from './$types';

	let { form, data }: { form: ActionData; data: PageData } = $props();

	let from = $state('');
	let to = $state('');
	let includeCreators = $state(true);
	let includeStarring = $state(true);
	let confirm = $state(false);
	let lastSuccessToastKey = $state('');

	// Autofill (name suggestions)
	let fromSuggestOpen = $state(false);
	let fromSuggestLoading = $state(false);
	let fromSuggestions = $state<string[]>([]);
	let fromSuggestError = $state('');
	let fromSuggestAbort: AbortController | null = null;

	let toSuggestOpen = $state(false);
	let toSuggestLoading = $state(false);
	let toSuggestions = $state<string[]>([]);
	let toSuggestError = $state('');
	let toSuggestAbort: AbortController | null = null;

	$effect(() => {
		if (form && typeof (form as any).from === 'string') from = String((form as any).from ?? '');
		if (form && typeof (form as any).to === 'string') to = String((form as any).to ?? '');
		if (form && typeof (form as any).includeCreators === 'boolean') {
			includeCreators = Boolean((form as any).includeCreators);
		}
		if (form && typeof (form as any).includeStarring === 'boolean') {
			includeStarring = Boolean((form as any).includeStarring);
		}
	});

	$effect(() => {
		if (!form || !(form as any).ok) return;

		const result = (form as any).result;
		const quickMerge = (form as any).quickMerge;

		if (result && typeof result.updated === 'number' && typeof result.affected === 'number') {
			const key = `merge:${result.updated}:${result.affected}:${(form as any).from ?? ''}:${(form as any).to ?? ''}`;
			if (key !== lastSuccessToastKey) {
				toast.success(`Merged ${result.updated} items (affected: ${result.affected}).`);
				lastSuccessToastKey = key;
			}
			return;
		}

		if (quickMerge && typeof quickMerge.keepName === 'string' && Array.isArray(quickMerge.merged)) {
			const key = `quick:${quickMerge.keepName}:${quickMerge.merged.join('|')}:${quickMerge.updated ?? ''}`;
			if (key !== lastSuccessToastKey) {
				toast.success(
					`Kept ${quickMerge.keepName} and merged ${quickMerge.merged.length} name(s).`
				);
				lastSuccessToastKey = key;
			}
		}
	});

	function listFmt(list?: unknown) {
		return Array.isArray(list) ? list.join(', ') : '';
	}

	function roleLabel(roles?: { creator?: boolean; athlete?: boolean }) {
		if (roles?.creator && roles?.athlete) return 'creator + athlete';
		if (roles?.creator) return 'creator';
		if (roles?.athlete) return 'athlete';
		return 'person';
	}

	function suggestRole(): 'creator' | 'athlete' | 'any' {
		if (includeCreators && includeStarring) return 'any';
		if (includeCreators) return 'creator';
		if (includeStarring) return 'athlete';
		return 'any';
	}

	function uniqueList(values: string[]): string[] {
		const seen = new Set<string>();
		const out: string[] = [];
		for (const v of values) {
			const key = v.trim().toLowerCase();
			if (!key) continue;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(v.trim());
		}
		return out;
	}

	async function fetchPeopleSuggestions(opts: {
		role: 'creator' | 'athlete' | 'any';
		query: string;
		signal: AbortSignal;
	}): Promise<string[]> {
		const res = await fetch(
			`/api/admin/people-suggest?role=${encodeURIComponent(opts.role)}&q=${encodeURIComponent(opts.query)}`,
			{ signal: opts.signal }
		);
		if (!res.ok) return [];
		const body = (await res.json()) as { results?: Array<{ name?: unknown }> };
		const names = Array.isArray(body?.results)
			? body.results
					.map((r) => (typeof r?.name === 'string' ? r.name : ''))
					.filter(Boolean)
			: [];
		return uniqueList(names);
	}

	$effect(() => {
		const q = from.trim();
		fromSuggestError = '';
		if (!fromSuggestOpen || q.length < 2) {
			fromSuggestions = [];
			fromSuggestLoading = false;
			fromSuggestAbort?.abort();
			fromSuggestAbort = null;
			return;
		}

		fromSuggestAbort?.abort();
		const controller = new AbortController();
		fromSuggestAbort = controller;
		fromSuggestLoading = true;

		const handle = setTimeout(async () => {
			try {
				fromSuggestions = await fetchPeopleSuggestions({
					role: suggestRole(),
					query: q,
					signal: controller.signal
				});
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				fromSuggestError = 'Failed to load suggestions.';
				fromSuggestions = [];
			} finally {
				if (!controller.signal.aborted) fromSuggestLoading = false;
			}
		}, 160);

		return () => {
			clearTimeout(handle);
			controller.abort();
		};
	});

	$effect(() => {
		const q = to.trim();
		toSuggestError = '';
		if (!toSuggestOpen || q.length < 2) {
			toSuggestions = [];
			toSuggestLoading = false;
			toSuggestAbort?.abort();
			toSuggestAbort = null;
			return;
		}

		toSuggestAbort?.abort();
		const controller = new AbortController();
		toSuggestAbort = controller;
		toSuggestLoading = true;

		const handle = setTimeout(async () => {
			try {
				toSuggestions = await fetchPeopleSuggestions({
					role: suggestRole(),
					query: q,
					signal: controller.signal
				});
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				toSuggestError = 'Failed to load suggestions.';
				toSuggestions = [];
			} finally {
				if (!controller.signal.aborted) toSuggestLoading = false;
			}
		}, 160);

		return () => {
			clearTimeout(handle);
			controller.abort();
		};
	});
</script>

<div class="mx-auto w-full max-w-5xl px-6 pt-20 pb-16">
	<div class="jf-surface rounded-3xl p-6 md:p-8">
		<p class="jf-label">Admin desk</p>
		<h1 class="mt-2 text-3xl font-semibold text-white">People merge</h1>
		<p class="mt-2 text-sm text-white/60">
			Bulk rename / merge creator & athlete names across all content.
		</p>
	</div>

	{#if form?.message}
		<div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
			{form.message}
		</div>
	{/if}

	<div class="jf-surface-soft mt-6 rounded-2xl p-5">
		<form method="POST" use:enhance class="space-y-4">
			<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">From name</span>
					<div class="relative">
						<input
							type="text"
							name="from"
							required
							bind:value={from}
							placeholder="e.g. Venda Benda"
							onfocus={() => (fromSuggestOpen = true)}
							onblur={() => setTimeout(() => (fromSuggestOpen = false), 120)}
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>

						{#if fromSuggestOpen && (fromSuggestLoading || fromSuggestions.length > 0)}
							<div
								class="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-black/20 backdrop-blur"
							>
								{#if fromSuggestLoading}
									<div class="px-4 py-3 text-xs text-white/60">Searching…</div>
								{:else}
									<div class="max-h-56 overflow-auto">
										{#each fromSuggestions as name (name)}
											<button
												type="button"
												onmousedown={(e) => {
													e.preventDefault();
													from = name;
													fromSuggestOpen = false;
												}}
												class="block w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10"
											>
												{name}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
					{#if fromSuggestError}
						<p class="text-xs text-yellow-300">{fromSuggestError}</p>
					{/if}
				</label>

				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">To name</span>
					<div class="relative">
						<input
							type="text"
							name="to"
							required
							bind:value={to}
							placeholder='e.g. Václav "Venda" Benda'
							onfocus={() => (toSuggestOpen = true)}
							onblur={() => setTimeout(() => (toSuggestOpen = false), 120)}
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>

						{#if toSuggestOpen && (toSuggestLoading || toSuggestions.length > 0)}
							<div
								class="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-black/20 backdrop-blur"
							>
								{#if toSuggestLoading}
									<div class="px-4 py-3 text-xs text-white/60">Searching…</div>
								{:else}
									<div class="max-h-56 overflow-auto">
										{#each toSuggestions as name (name)}
											<button
												type="button"
												onmousedown={(e) => {
													e.preventDefault();
													to = name;
													toSuggestOpen = false;
												}}
												class="block w-full px-4 py-2.5 text-left text-sm text-white/80 hover:bg-white/10"
											>
												{name}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
					{#if toSuggestError}
						<p class="text-xs text-yellow-300">{toSuggestError}</p>
					{/if}
				</label>
			</div>

			<div class="flex flex-wrap items-center gap-4">
				<label class="flex items-center gap-2 text-sm text-white/80">
					<input type="checkbox" name="include_creators" bind:checked={includeCreators} />
					<span>Creators</span>
				</label>
				<label class="flex items-center gap-2 text-sm text-white/80">
					<input type="checkbox" name="include_starring" bind:checked={includeStarring} />
					<span>Starring / Athletes</span>
				</label>
			</div>

			<div class="rounded-xl border border-white/10 bg-black/20 p-4">
				<label class="flex items-start gap-3">
					<input type="checkbox" bind:checked={confirm} />
					<input type="hidden" name="confirm" value={confirm ? 'yes' : 'no'} />
					<div>
						<div class="text-sm font-medium text-white/80">Confirm bulk merge</div>
						<div class="mt-1 text-xs text-white/60">
							This updates <span class="font-semibold">media_items</span> in-place and dedupes names.
						</div>
					</div>
				</label>
			</div>

			<div class="flex flex-wrap justify-end gap-2">
				<button
					type="submit"
					formaction="?/preview"
					class="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
				>
					Preview
				</button>
				<button
					type="submit"
					formaction="?/merge"
					class="inline-flex items-center justify-center rounded-full bg-[#e50914] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#ff1a27]"
				>
					Merge
				</button>
			</div>
		</form>
	</div>

	{#if data?.people}
		<div class="jf-surface-soft mt-6 rounded-2xl p-5">
			<div>
				<div class="text-sm font-medium text-white/80">All people</div>
				<div class="mt-1 text-xs text-white/60">Total: {data.people.all.length}</div>
			</div>

			<div class="mt-4 rounded-xl border border-white/10 bg-black/20 p-4">
				<div class="max-h-96 overflow-auto pr-2">
					<ul class="space-y-2 text-sm text-white/80">
						{#each data.people.all as person (person.slug)}
							<li class="flex flex-wrap items-center gap-2">
								<span class="truncate">{person.name}</span>
								{#if person.roles.creator}
									<span class="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/65">
										Creator
									</span>
								{/if}
								{#if person.roles.athlete}
									<span class="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/65">
										Athlete
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				</div>
			</div>

			<div class="mt-5">
				<div class="text-sm font-medium text-white/80">Potential matches</div>
				<div class="mt-1 text-xs text-white/60">
					Name variants that normalize to the same slug.
				</div>

				<div class="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
					{#if data.people.potentialMatches.length === 0}
						<div class="text-sm text-white/60">No potential matches found.</div>
					{:else}
						<div class="max-h-80 overflow-auto pr-2">
							<ul class="space-y-3">
								{#each data.people.potentialMatches as match (match.slug)}
									<li class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
										<div class="flex flex-wrap items-center gap-2 text-xs text-white/55">
											<span>{match.slug}</span>
											{#if match.roles.creator}
												<span class="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/65">
													Creator
												</span>
											{/if}
											{#if match.roles.athlete}
												<span class="rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-white/65">
													Athlete
												</span>
											{/if}
										</div>
										<div class="mt-2 text-sm text-white/80">{match.names.join(' · ')}</div>
										<div class="mt-3 flex flex-wrap gap-2">
											{#each match.names as keepName (`${match.slug}-${keepName}`)}
												<form method="POST" use:enhance>
													<input type="hidden" name="keep_name" value={keepName} />
													<input type="hidden" name="all_names" value={JSON.stringify(match.names)} />
													<button
														type="submit"
														formaction="?/quickMerge"
														class="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
													>
														{keepName}
													</button>
												</form>
											{/each}
										</div>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>

			<div class="mt-5">
				<div class="text-sm font-medium text-white/80">Potential matches by similar names</div>
				<div class="mt-1 text-xs text-white/60">
					Fuzzy name matches with score percentage. Pick which one to keep and merge instantly.
				</div>

				<div class="mt-3 rounded-xl border border-white/10 bg-black/20 p-4">
					{#if data.people.lookAlikeMatches.length === 0}
						<div class="text-sm text-white/60">No similar-name matches found.</div>
					{:else}
						<div class="max-h-96 overflow-auto pr-2">
							<ul class="space-y-3">
								{#each data.people.lookAlikeMatches as pair (`${pair.left.slug}-${pair.right.slug}`)}
									<li class="rounded-lg border border-white/10 bg-white/[0.03] p-3">
										<div class="flex flex-wrap items-center justify-between gap-3">
											<div class="text-sm text-white/85">
												<span class="font-medium">{pair.left.name}</span>
												<span class="mx-1 text-white/45">↔</span>
												<span class="font-medium">{pair.right.name}</span>
											</div>
											<div class="rounded-full border border-white/15 bg-white/5 px-2 py-1 text-xs text-white/70">
												{Math.round(pair.score * 100)}% · {pair.reason}
											</div>
										</div>

										<div class="mt-1 text-xs text-white/55">
											{pair.left.slug} ({roleLabel(pair.left.roles)}) · {pair.right.slug} ({roleLabel(pair.right.roles)})
										</div>

										<div class="mt-3 flex flex-wrap gap-2">
											<form method="POST" use:enhance>
												<input type="hidden" name="keep_name" value={pair.left.name} />
												<input type="hidden" name="merge_from" value={pair.right.name} />
												<button
													type="submit"
													formaction="?/quickMerge"
													class="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
												>
													{pair.left.name}
												</button>
											</form>
											<form method="POST" use:enhance>
												<input type="hidden" name="keep_name" value={pair.right.name} />
												<input type="hidden" name="merge_from" value={pair.left.name} />
												<button
													type="submit"
													formaction="?/quickMerge"
													class="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/80 transition hover:bg-white/10"
												>
													{pair.right.name}
												</button>
											</form>
										</div>
									</li>
								{/each}
							</ul>
						</div>
					{/if}
				</div>
			</div>
		</div>
	{/if}

	{#if form?.preview}
		<div class="jf-surface-soft mt-6 rounded-2xl p-5">
			<div class="flex items-baseline justify-between gap-4">
				<div>
					<div class="text-sm font-medium text-white/80">Preview</div>
					<div class="mt-1 text-xs text-white/60">
						Affected: {form.preview.total} · Showing: {form.preview.shown}
					</div>
				</div>
			</div>

			<div class="mt-4 space-y-3">
				{#if !form.preview.items?.length}
					<div class="text-sm text-white/60">No matches found.</div>
				{:else}
					{#each form.preview.items as item (item.id)}
						<div class="rounded-xl border border-white/10 bg-black/20 p-4">
							<div class="flex items-start justify-between gap-4">
								<div class="min-w-0">
									<div class="truncate text-sm font-medium text-white">{item.title}</div>
									<div class="mt-1 text-xs text-white/60">
										<span class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">
											{item.type}
										</span>
										<span class="ml-2 text-white/50">/ {item.slug}</span>
									</div>
								</div>
								<a
									href={item.type === 'movie' ? `/movie/${item.slug}` : `/series/${item.slug}`}
									class="text-xs text-white/70 underline hover:text-white"
									target="_blank"
									rel="noreferrer"
								>
									Open
								</a>
							</div>

							{#if item.creatorsBefore}
								<div class="mt-3">
									<div class="text-xs text-white/60">Creators</div>
									<div class="mt-1 text-xs text-white/80">
										<div><span class="text-white/50">Before:</span> {listFmt(item.creatorsBefore)}</div>
										<div><span class="text-white/50">After:</span> {listFmt(item.creatorsAfter)}</div>
									</div>
								</div>
							{/if}

							{#if item.starringBefore}
								<div class="mt-3">
									<div class="text-xs text-white/60">Starring / Athletes</div>
									<div class="mt-1 text-xs text-white/80">
										<div><span class="text-white/50">Before:</span> {listFmt(item.starringBefore)}</div>
										<div><span class="text-white/50">After:</span> {listFmt(item.starringAfter)}</div>
									</div>
								</div>
							{/if}
						</div>
					{/each}
				{/if}
			</div>
		</div>
	{/if}
</div>
