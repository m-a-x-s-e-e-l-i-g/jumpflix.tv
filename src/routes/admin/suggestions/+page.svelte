<script lang="ts">
  import { page } from '$app/stores';
  import { enhance } from '$app/forms';

  export let data: { suggestions: any[]; error: string | null };

  let selectedId: number | null = null;

  $: {
    const fromUrl = Number(($page.url.searchParams.get('id') ?? ''));
    selectedId = Number.isFinite(fromUrl) && fromUrl > 0 ? fromUrl : null;
  }

  $: selected = selectedId
    ? (data.suggestions ?? []).find((s) => Number(s.id) === Number(selectedId))
    : (data.suggestions ?? [])[0] ?? null;

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

  $: adminPayloadText = selected ? jsonPretty(selected.admin_payload ?? selected.payload ?? {}) : '';
  $: adminNoteText = selected?.admin_note ?? '';

  function statusPillClass(status: unknown) {
    const s = String(status ?? '').toLowerCase();
    if (s === 'approved') return 'border-green-500/30 bg-green-500/10 text-green-100';
    return 'border-white/10 bg-white/5 text-white/70';
  }
</script>

<div class="mx-auto w-full max-w-6xl px-6 pt-20 pb-10">
  <h1 class="text-2xl font-semibold text-white">Content suggestions</h1>
  <p class="mt-1 text-sm text-white/60">Review, edit, approve or decline user suggestions.</p>

  {#if data.error}
    <div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{data.error}</div>
  {/if}

  <div class="mt-6 grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-5">
    <aside class="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div class="text-sm font-medium text-white/80">Queue</div>
      <div class="mt-3 space-y-2 max-h-[70vh] overflow-auto pr-1">
        {#if !data.suggestions?.length}
          <div class="text-sm text-white/60">No suggestions yet.</div>
        {:else}
          {#each data.suggestions as s (s.id)}
            <a
              href={`/admin/suggestions?id=${s.id}`}
              class={`block rounded-xl border px-3 py-2 transition hover:bg-white/5 ${selected && s.id === selected.id
                ? 'border-red-500/60 bg-red-500/10'
                : String(s.status ?? '').toLowerCase() === 'approved'
                  ? 'border-green-500/30 bg-green-500/10'
                  : 'border-white/10 bg-white/0'}`}
            >
              <div class="flex items-center justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-sm text-white truncate">{s.media?.title ?? `Media #${s.media_id}`}</div>
                  <div class="text-xs text-white/60 truncate">
                    <span>{s.kind} · </span>
                    <span class={String(s.status ?? '').toLowerCase() === 'approved' ? 'text-green-200' : 'text-white/60'}>{s.status}</span>
                  </div>
                </div>
                <div class="text-[10px] text-white/50 whitespace-nowrap">{fmtDate(s.created_at)}</div>
              </div>
            </a>
          {/each}
        {/if}
      </div>
    </aside>

    <section class="rounded-2xl border border-white/10 bg-white/5 p-5">
      {#if !selected}
        <div class="text-sm text-white/60">Select a suggestion to review.</div>
      {:else}
        <div class="flex items-start justify-between gap-4">
          <div>
            <div class="text-lg font-semibold text-white">{selected.media?.title ?? `Media #${selected.media_id}`}</div>
            <div class="mt-1 text-sm text-white/60">
              <span class="inline-flex items-center gap-2">
                <span class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">{selected.media_type}</span>
                <span class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-white/70">{selected.kind}</span>
                <span class={`rounded-full border px-2 py-0.5 text-xs ${statusPillClass(selected.status)}`}>{selected.status}</span>
              </span>
            </div>
            {#if selected.target_scope === 'episode'}
              <div class="mt-2 text-xs text-white/60">Episode: S{selected.season_number} · E{selected.episode_number}</div>
            {/if}
          </div>
        </div>

        <div class="mt-5 grid grid-cols-1 gap-4">
          <div class="rounded-xl border border-white/10 bg-black/20 p-4">
            <div class="text-xs text-white/60 mb-2">Payload</div>
            <pre class="text-xs text-white/80 overflow-auto">{jsonPretty(selected.payload)}</pre>
          </div>

          <form method="POST" use:enhance class="space-y-4">
            <input type="hidden" name="id" value={selected.id} />

            <label class="block space-y-2">
              <span class="text-sm font-medium text-white/80">Admin note</span>
              <textarea
                name="admin_note"
                rows="3"
                class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/50 focus:border-[#e50914] focus:outline-none focus:ring-2 focus:ring-[#e50914]/70"
                bind:value={adminNoteText}
                placeholder="Optional internal note"
              ></textarea>
            </label>

            <label class="block space-y-2">
              <span class="text-sm font-medium text-white/80">Admin payload (editable JSON)</span>
              <textarea
                name="admin_payload"
                rows="14"
                class="w-full font-mono rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-xs text-white shadow-inner placeholder:text-white/50 focus:border-[#e50914] focus:outline-none focus:ring-2 focus:ring-[#e50914]/70"
                bind:value={adminPayloadText}
              ></textarea>
              <div class="text-xs text-white/60">
                On approve, the admin payload is applied to the database (for supported suggestion types).
              </div>
            </label>

            <div class="flex flex-wrap gap-2 justify-end">
              <button
                type="submit"
                formaction="?/save"
                class="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium border border-white/20 bg-white/5 text-white/80 hover:bg-white/10 transition"
              >
                Save draft
              </button>
              <button
                type="submit"
                formaction="?/decline"
                class="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium border border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/15 transition"
              >
                Decline
              </button>
              <button
                type="submit"
                formaction="?/approve"
                class="inline-flex items-center justify-center rounded-full px-5 py-2 text-sm font-medium bg-[#e50914] text-white hover:bg-[#ff1a27] transition"
              >
                Approve & apply
              </button>
            </div>
          </form>
        </div>
      {/if}
    </section>
  </div>
</div>
