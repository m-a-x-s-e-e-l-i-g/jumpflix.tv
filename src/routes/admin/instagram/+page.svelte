<script lang="ts">
	import { enhance } from '$app/forms';

	let { form, data } = $props();

	const actionForm = $derived((form ?? {}) as any);
	const pageData = $derived(data as any);

	let bulkText = $state('');
	let previewSelections = $state<Record<string, string>>({});
	let previewIncluded = $state<Record<string, boolean>>({});

	$effect(() => {
		if (actionForm && typeof actionForm.bulkText === 'string') {
			bulkText = String(actionForm.bulkText);
		}
	});

	$effect(() => {
		const items = Array.isArray(actionForm?.preview?.items) ? actionForm.preview.items : [];
		if (!items.length) return;

		const nextSelections: Record<string, string> = {};
		const nextIncluded: Record<string, boolean> = {};
		for (const item of items) {
			const key = String(item.parsedSlug);
			nextSelections[key] = item.suggestedSlug ? `known:${item.suggestedSlug}` : `raw:${item.parsedSlug}`;
			nextIncluded[key] = true;
		}

		previewSelections = nextSelections;
		previewIncluded = nextIncluded;
	});

	function fmtHandles(handles?: string[] | null) {
		return Array.isArray(handles) ? handles.map((handle) => `@${handle}`).join(', ') : '';
	}

	function roleLabel(roles?: { creator?: boolean; athlete?: boolean }) {
		if (roles?.creator && roles?.athlete) return 'creator + athlete';
		if (roles?.creator) return 'creator';
		if (roles?.athlete) return 'athlete';
		return 'person';
	}

	function suggestionBadge(confidence: string) {
		if (confidence === 'exact') return 'Exact match';
		if (confidence === 'strong') return 'Strong suggestion';
		if (confidence === 'possible') return 'Possible suggestion';
		return 'No suggestion';
	}
</script>

<div class="mx-auto w-full max-w-6xl px-6 pt-20 pb-16">
	<div class="jf-surface rounded-3xl p-6 md:p-8">
		<p class="jf-label">Admin desk</p>
		<h1 class="mt-2 text-3xl font-semibold text-white">Instagram profiles</h1>
		<p class="mt-2 max-w-3xl text-sm text-white/60">
			Paste raw credits like <span class="font-medium text-white/80">Name @handle</span>, preview the
			matches, then save. Headings like <span class="font-medium text-white/80">Invited athletes:</span>
			are ignored automatically.
		</p>
	</div>

	{#if pageData.error}
		<div class="mt-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-100">
			{pageData.error}
		</div>
	{/if}

	{#if actionForm.message}
		<div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
			{actionForm.message}
		</div>
	{/if}

	{#if actionForm.notice}
		<div class="mt-6 rounded-xl border border-sky-500/30 bg-sky-500/10 p-4 text-sm text-sky-100">
			{actionForm.notice}
		</div>
	{/if}

	{#if actionForm.ok && actionForm.result}
		<div class="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">
			Saved <span class="font-semibold">{actionForm.result.updated}</span> person profiles.
		</div>
	{/if}

	{#if actionForm.ok && actionForm.deletedSlug}
		<div class="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-100">
			Deleted profile <span class="font-semibold">{actionForm.deletedSlug}</span>.
		</div>
	{/if}

	<div class="jf-surface-soft mt-6 rounded-2xl p-5">
		<form method="POST" use:enhance class="space-y-4">
			<label class="block space-y-2">
				<span class="text-xs text-white/60">Bulk paste</span>
				<textarea
					name="bulk_text"
					bind:value={bulkText}
					rows="14"
					placeholder={`Christian Hansen   @chrishanpk\nTollef Roba   @tollefsroba\nSander Lier   @sanderlierpk / @andremusicc\n\nInvited athletes:\nAleksander Ræken   @a_raekken`}
					class="min-h-[18rem] w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
				></textarea>
			</label>

			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="text-xs text-white/55">
					The tool will suggest existing creators and athletes, then you choose what gets saved.
				</p>
				<div class="flex flex-wrap gap-2">
					<button
						type="submit"
						formaction="?/preview"
						class="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
					>
						Preview paste
					</button>
					<button
						type="submit"
						formaction="?/aiPreview"
						disabled={!pageData.aiReady}
						class="inline-flex items-center justify-center rounded-full border border-sky-400/30 bg-sky-500/10 px-5 py-2 text-sm font-medium text-sky-100 transition hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
					>
						AI format + preview
					</button>
				</div>
			</div>

			{#if !pageData.aiReady}
				<p class="text-xs text-white/45">
					AI formatting is unavailable until <span class="font-medium text-white/65">OPENAI_API_KEY</span> is configured on the server.
				</p>
			{/if}
		</form>
	</div>

	{#if actionForm.preview}
		<div class="jf-surface-soft mt-6 rounded-2xl p-5">
			<div class="flex items-baseline justify-between gap-4">
				<div>
					<div class="text-sm font-medium text-white/80">Preview</div>
					<div class="mt-1 text-xs text-white/60">
						Parsed: {actionForm.preview.items.length} · Ignored: {actionForm.preview.ignoredLines.length}
					</div>
				</div>
				<div class="text-xs text-white/55">Approve, change, or exclude each item before saving.</div>
			</div>

			<form method="POST" use:enhance class="mt-4 space-y-3">
				<input type="hidden" name="bulk_text" value={bulkText} />
				{#each actionForm.preview.items as item (item.parsedSlug)}
					<div class="rounded-xl border border-white/10 bg-black/20 p-4">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div>
								<div class="text-sm font-medium text-white">{item.parsedName}</div>
								<div class="mt-1 text-xs text-white/55">
									parsed as /{item.parsedSlug} · lines {item.lineNumbers.join(', ')}
								</div>
							</div>
							<div class="text-right text-xs text-white/60">
								<span class={`rounded-full border px-2 py-1 ${
									item.suggestionConfidence === 'exact'
										? 'border-green-500/30 bg-green-500/10 text-green-100'
										: item.suggestionConfidence === 'strong'
											? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
											: item.suggestionConfidence === 'possible'
												? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-100'
												: 'border-white/10 bg-white/5 text-white/60'
								}`}>{suggestionBadge(item.suggestionConfidence)}</span>
							</div>
						</div>

						<div class="mt-4 grid gap-4 md:grid-cols-[auto,1fr] md:items-start">
							<label class="flex items-center gap-2 text-sm text-white/80">
								<input type="checkbox" name={`include:${item.parsedSlug}`} bind:checked={previewIncluded[item.parsedSlug]} />
								<span>Include</span>
							</label>

							<div class="space-y-2">
								<div class="text-xs text-white/60">Save this handle under</div>
								<select
									name={`match:${item.parsedSlug}`}
									bind:value={previewSelections[item.parsedSlug]}
									class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
								>
									<option value={`raw:${item.parsedSlug}`}>Keep parsed name: {item.parsedName}</option>
									{#each item.candidates as candidate (candidate.slug)}
										<option value={`known:${candidate.slug}`}>
											Use existing: {candidate.name} ({roleLabel(candidate.roles)} · {Math.round(candidate.score * 100)}%)
										</option>
									{/each}
								</select>

								<div class="rounded-xl border border-white/10 bg-white/5 p-3 text-xs text-white/70">
									<div><span class="text-white/45">Instagram:</span> {fmtHandles(item.instagramHandles)}</div>
									{#if item.suggestedName}
										<div class="mt-1"><span class="text-white/45">Suggested:</span> {item.suggestedName}</div>
									{/if}
									{#if item.existingHandles.length}
										<div class="mt-1"><span class="text-white/45">Already saved:</span> {fmtHandles(item.existingHandles)}</div>
									{/if}
								</div>

								{#if item.candidates.length}
									<div class="space-y-1 rounded-xl border border-white/10 bg-black/20 p-3">
										<div class="text-xs text-white/60">Top existing matches</div>
										{#each item.candidates as candidate (candidate.slug)}
											<div class="flex flex-wrap items-center justify-between gap-2 text-xs text-white/75">
												<div>{candidate.name}</div>
												<div class="text-white/50">{roleLabel(candidate.roles)} · {candidate.reason} · {Math.round(candidate.score * 100)}%</div>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						</div>
					</div>
				{/each}

				<div class="flex justify-end">
					<button
						type="submit"
						formaction="?/apply"
						disabled={!pageData.tableReady}
						class="inline-flex items-center justify-center rounded-full bg-[#e50914] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#ff1a27] disabled:cursor-not-allowed disabled:opacity-60"
					>
						Save approved profiles
					</button>
				</div>
			</form>

			{#if actionForm.preview.ignoredLines.length}
				<div class="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
					<div class="text-sm font-medium text-white/80">Ignored lines</div>
					<div class="mt-3 space-y-2 text-xs text-white/65">
						{#each actionForm.preview.ignoredLines as line, index (`${line.lineNumber}-${index}`)}
							<div>
								<span class="text-white/45">Line {line.lineNumber}:</span> {line.text}
								<span class="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 uppercase tracking-wide text-[10px] text-white/50">
									{line.reason}
								</span>
							</div>
						{/each}
					</div>
				</div>
			{/if}
		</div>
	{/if}

	<div class="jf-surface-soft mt-6 rounded-2xl p-5">
		<div>
			<div class="text-sm font-medium text-white/80">Saved profiles</div>
			<div class="mt-1 text-xs text-white/60">
				{pageData.profiles.length} saved · {pageData.knownPeople.length} known people in the catalog
			</div>
		</div>

		{#if !pageData.profiles.length}
			<div class="mt-4 text-sm text-white/60">No Instagram profiles saved yet.</div>
		{:else}
			<div class="mt-4 space-y-3">
				{#each pageData.profiles as profile (profile.slug)}
					<div class="rounded-xl border border-white/10 bg-black/20 p-4">
						<div class="flex flex-wrap items-start justify-between gap-3">
							<div class="min-w-0">
								<a href={`/people/${profile.slug}`} class="truncate text-sm font-medium text-white underline-offset-2 hover:underline">
									{profile.name}
								</a>
								<div class="mt-1 text-xs text-white/60">{fmtHandles(profile.instagram_handles)}</div>
							</div>
							<form method="POST" use:enhance>
								<input type="hidden" name="slug" value={profile.slug} />
								<button
									type="submit"
									formaction="?/delete"
									class="inline-flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-medium text-red-100 transition hover:bg-red-500/15"
								>
									Delete
								</button>
							</form>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</div>