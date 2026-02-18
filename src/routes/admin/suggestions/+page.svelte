<script lang="ts">
	import { page } from '$app/stores';
	import { enhance } from '$app/forms';

	export let data: { suggestions: any[]; error: string | null };

	let selectedId: number | null = null;

	$: allSuggestions = data.suggestions ?? [];
	$: pendingSuggestions = allSuggestions.filter(
		(s) => String(s?.status ?? '').toLowerCase() === 'pending'
	);
	$: approvedSuggestions = allSuggestions.filter(
		(s) => String(s?.status ?? '').toLowerCase() === 'approved'
	);
	$: declinedSuggestions = allSuggestions.filter(
		(s) => String(s?.status ?? '').toLowerCase() === 'declined'
	);

	$: {
		const fromUrl = Number($page.url.searchParams.get('id') ?? '');
		selectedId = Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : null;
	}

	$: selected = selectedId
		? allSuggestions.find((s) => Number(s.id) === Number(selectedId))
		: (pendingSuggestions[0] ?? null);

	function fmtDate(value?: string | null) {
		if (!value) return '';
		try {
			return new Date(value).toLocaleString();
		} catch {
			return value;
		}
	}

	function jsonPretty(value: any) {
		if (value === null || value === undefined) return '';
		try {
			return JSON.stringify(value, null, 2);
		} catch {
			return String(value);
		}
	}

	$: adminPayloadText = selected
		? jsonPretty(selected.admin_payload ?? selected.payload ?? {})
		: '';
	$: adminNoteText = selected?.admin_note ?? '';

	function statusPillClass(status: unknown) {
		const s = String(status ?? '').toLowerCase();
		if (s === 'approved') return 'border-green-500/30 bg-green-500/10 text-green-100';
		return 'border-white/10 bg-white/5 text-white/70';
	}

	function suggestionCardClass(s: any, isSelected: boolean) {
		if (isSelected) return 'border-red-500/60 bg-red-500/10';
		const status = String(s?.status ?? '').toLowerCase();
		if (status === 'approved') return 'border-green-500/30 bg-green-500/10';
		if (status === 'declined') return 'border-white/10 bg-white/0 opacity-70';
		return 'border-white/10 bg-white/0';
	}
</script>

<div class="mx-auto w-full max-w-6xl px-6 pt-20 pb-10">
	<div class="jf-surface rounded-3xl p-6 md:p-8">
		<p class="jf-label">Admin desk</p>
		<h1 class="mt-2 text-3xl font-semibold text-white">Content suggestions</h1>
		<p class="mt-2 text-sm text-white/60">Review, edit, approve or decline user suggestions.</p>
	</div>

	{#if data.error}
		<div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
			{data.error}
		</div>
	{/if}

	<div class="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-[360px_1fr]">
		<aside class="jf-surface-soft rounded-2xl p-4">
			<div class="text-sm font-medium text-white/80">Queue</div>
			<div class="mt-3 max-h-[70vh] space-y-2 overflow-auto pr-1">
				{#if !allSuggestions.length}
					<div class="text-sm text-white/60">No suggestions yet.</div>
				{:else if !pendingSuggestions.length}
					<div class="text-sm text-white/60">Nothing to do</div>
				{:else}
					{#each pendingSuggestions as s (s.id)}
						<a
							href={`/admin/suggestions?id=${s.id}`}
							class={`block rounded-xl border px-3 py-2 transition hover:bg-white/5 ${suggestionCardClass(
								s,
								Boolean(selected && s.id === selected.id)
							)}`}
						>
							<div class="flex items-center justify-between gap-3">
								<div class="min-w-0">
									<div class="truncate text-sm text-white">
										{s.media?.title ?? `Media #${s.media_id}`}
									</div>
									<div class="truncate text-xs text-white/60">
										<span>{s.kind} · </span>
										<span
											class={String(s.status ?? '').toLowerCase() === 'approved'
												? 'text-green-200'
												: 'text-white/60'}>{s.status}</span
										>
									</div>
								</div>
								<div class="text-[10px] whitespace-nowrap text-white/50">
									{fmtDate(s.created_at)}
								</div>
							</div>
						</a>
					{/each}
				{/if}
			</div>

			<div class="mt-5 text-sm font-medium text-white/80">Approved</div>
			<div class="mt-3 max-h-[70vh] space-y-2 overflow-auto pr-1">
				{#if approvedSuggestions.length}
					{#each approvedSuggestions as s (s.id)}
						<a
							href={`/admin/suggestions?id=${s.id}`}
							class={`block rounded-xl border px-3 py-2 transition hover:bg-white/5 ${suggestionCardClass(
								s,
								Boolean(selected && s.id === selected.id)
							)}`}
						>
							<div class="flex items-center justify-between gap-3">
								<div class="min-w-0">
									<div class="truncate text-sm text-white">
										{s.media?.title ?? `Media #${s.media_id}`}
									</div>
									<div class="truncate text-xs text-white/60">
										<span>{s.kind} · </span>
										<span class="text-green-200">{s.status}</span>
									</div>
								</div>
								<div class="text-[10px] whitespace-nowrap text-white/50">
									{fmtDate(s.created_at)}
								</div>
							</div>
						</a>
					{/each}
				{:else}
					<div class="text-sm text-white/60">No approved suggestions.</div>
				{/if}
			</div>
		</aside>

		<section class="jf-surface-soft rounded-2xl p-5">
			{#if !selected}
				<div class="text-sm text-white/60">
					{pendingSuggestions.length === 0 ? 'Nothing to do' : 'Select a suggestion to review.'}
				</div>
			{:else}
				<div class="flex items-start justify-between gap-4">
					<div>
						<div class="text-lg font-semibold text-white">
							{selected.media?.title ?? `Media #${selected.media_id}`}
						</div>
						<div class="mt-1 text-sm text-white/60">
							<span class="inline-flex items-center gap-2">
								<span
									class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70"
									>{selected.media_type}</span
								>
								<span
									class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70"
									>{selected.kind}</span
								>
								<span
									class={`rounded-full border px-2 py-0.5 text-xs ${statusPillClass(selected.status)}`}
									>{selected.status}</span
								>
							</span>
						</div>
						{#if selected.target_scope === 'episode'}
							<div class="mt-2 text-xs text-white/60">
								Episode: S{selected.season_number} · E{selected.episode_number}
							</div>
						{/if}
					</div>
				</div>

				<div class="mt-5 grid grid-cols-1 gap-4">
					<div class="rounded-xl border border-white/10 bg-black/20 p-4">
						<div class="mb-2 text-xs text-white/60">Payload</div>
						<pre class="overflow-auto text-xs text-white/80">{jsonPretty(selected.payload)}</pre>
					</div>

					<form method="POST" use:enhance class="space-y-4">
						<input type="hidden" name="id" value={selected.id} />

						<label class="block space-y-2">
							<span class="text-sm font-medium text-white/80">Admin note</span>
							<textarea
								name="admin_note"
								rows="3"
								class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/50 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
								bind:value={adminNoteText}
								placeholder="Optional internal note"
							></textarea>
						</label>

						<label class="block space-y-2">
							<span class="text-sm font-medium text-white/80">Admin payload (editable JSON)</span>
							<textarea
								name="admin_payload"
								rows="14"
								class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 font-mono text-xs text-white shadow-inner placeholder:text-white/50 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
								bind:value={adminPayloadText}
							></textarea>
							<div class="text-xs text-white/60">
								On approve, the admin payload is applied to the database (for supported suggestion
								types).
							</div>
						</label>

						<div class="flex flex-wrap justify-end gap-2">
							<button
								type="submit"
								formaction="?/save"
								class="inline-flex items-center justify-center rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium text-white/80 transition hover:bg-white/10"
							>
								Save draft
							</button>
							{#if String(selected.status ?? '').toLowerCase() === 'pending'}
								<button
									type="submit"
									formaction="?/decline"
									class="inline-flex items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 px-5 py-2 text-sm font-medium text-red-100 transition hover:bg-red-500/15"
								>
									Decline
								</button>
							{/if}
							<button
								type="submit"
								formaction="?/approve"
								class="inline-flex items-center justify-center rounded-full bg-[#e50914] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#ff1a27]"
							>
								{String(selected.status ?? '').toLowerCase() === 'approved'
									? 'Re-apply changes'
									: 'Approve & apply'}
							</button>
						</div>
					</form>
				</div>
			{/if}
		</section>
	</div>
</div>
