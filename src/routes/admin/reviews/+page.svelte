<script lang="ts">
  import { enhance } from '$app/forms';

  export let data: { reviews: any[]; error: string | null };

  function fmtDate(value?: string | null) {
    if (!value) return '';
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
</script>

<div class="mx-auto w-full max-w-6xl px-6 pt-20 pb-10">
  <div class="rounded-3xl jf-surface p-6 md:p-8">
    <p class="jf-label">Admin desk</p>
    <h1 class="mt-2 text-3xl font-semibold text-white">Reviews</h1>
    <p class="mt-2 text-sm text-white/60">Recently added user reviews (posted immediately).</p>
  </div>

  {#if data.error}
    <div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{data.error}</div>
  {/if}

  <div class="mt-6 rounded-2xl jf-surface-soft p-4">
    {#if !(data.reviews?.length)}
      <div class="text-sm text-white/60">No reviews yet.</div>
    {:else}
      <div class="space-y-3">
        {#each data.reviews as r (r.id)}
          <div class="rounded-xl border border-white/10 bg-black/20 p-4">
            <div class="flex items-start justify-between gap-4">
              <div class="min-w-0">
                <div class="text-sm font-medium text-white truncate">
                  {r.media?.title ?? `Media #${r.media_id}`}
                </div>
                <div class="mt-1 text-xs text-white/60">
                  <span class="rounded-full border border-white/10 bg-white/5 px-2 py-0.5">{r.media?.type ?? 'media'}</span>
                  <span class="ml-2">{fmtDate(r.created_at)}</span>
                  {#if r.author_name}
                    <span class="ml-2">· {r.author_name}</span>
                  {/if}
                  {#if r.user_id}
                    <span class="ml-2">· {String(r.user_id).slice(0, 8)}…</span>
                  {/if}
                </div>
              </div>

              <form method="POST" use:enhance>
                <input type="hidden" name="id" value={r.id} />
                <button
                  type="submit"
                  formaction="?/delete"
                  class="inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-medium border border-red-500/30 bg-red-500/10 text-red-100 hover:bg-red-500/15 transition"
                >
                  Delete
                </button>
              </form>
            </div>

            <div class="mt-3 whitespace-pre-wrap text-sm text-white/80">{r.body}</div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>
