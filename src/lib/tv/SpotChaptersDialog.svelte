<script lang="ts">
	import ListMusicIcon from 'lucide-svelte/icons/list-music';
	import XIcon from 'lucide-svelte/icons/x';
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';

	type SpotInfo = { id: string; name: string; lat: number; lng: number };
	type Chapter = {
		suggestionId: number;
		spotId: string;
		startSeconds: number;
		endSeconds: number;
		startTimecode?: string | null;
		endTimecode?: string | null;
		note?: string | null;
		playbackKey?: string | null;
		spot?: SpotInfo | null;
	};

	let {
		mediaId = null,
		mediaType = null,
		playbackKey = null,
		seekToSeconds = null,
		triggerClass = 'control-button',
		triggerAriaLabel = 'Spot list (chapters)',
		triggerTitle = 'Spots'
	} = $props<{
		mediaId?: number | null;
		mediaType?: 'movie' | 'series' | null;
		playbackKey?: string | null;
		seekToSeconds?: ((seconds: number) => void) | null;
		triggerClass?: string;
		triggerAriaLabel?: string;
		triggerTitle?: string;
	}>();

	let open = $state(false);
	let isLoading = $state(false);
	let chapters = $state<Chapter[]>([]);

	function fmt(seconds: number): string {
		const s = Math.max(0, Math.floor(Number(seconds) || 0));
		const h = Math.floor(s / 3600);
		const m = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
		return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
	}

	function spotUrl(spotId: string): string {
		return `https://parkour.spot/spots/${encodeURIComponent(String(spotId ?? '').trim())}`;
	}

	async function load() {
		if (!mediaId || !mediaType) return;
		isLoading = true;
		try {
			const u = new URL('/api/spot-chapters', window.location.origin);
			u.searchParams.set('mediaId', String(mediaId));
			u.searchParams.set('mediaType', mediaType);
			if (playbackKey) u.searchParams.set('playbackKey', playbackKey);

			const res = await fetch(u.toString(), { cache: 'no-store' });
			const data = await res.json().catch(() => null);
			if (!res.ok) {
				const message = (data as any)?.error;
				throw new Error(message || `Failed to load spot chapters (HTTP ${res.status})`);
			}
			chapters = Array.isArray(data?.chapters) ? data.chapters : [];
		} catch (err: any) {
			toast.error(err?.message || 'Failed to load spot chapters');
		} finally {
			isLoading = false;
		}
	}

	$effect(() => {
		if (!open) return;
		void load();
	});

	const closeButtonClass =
		'absolute right-5 top-5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20';

	const openSpotButtonClass =
		'inline-flex flex-shrink-0 items-center gap-1 rounded border border-[#8ecff2]/35 bg-[#8ecff2]/10 px-2 py-1 text-xs text-[#8ecff2] transition hover:bg-[#8ecff2]/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ecff2]/70';
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		class={triggerClass}
		aria-label={triggerAriaLabel}
		title={triggerTitle}
		data-jumpflix-gesture-ignore="true"
	>
		<span class="icon" aria-hidden="true"><ListMusicIcon /></span>
		<span class="sr-only">Spots</span>
	</Dialog.Trigger>

	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-[60] bg-black/78 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-[70] max-h-[calc(100dvh-2rem)] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-background p-0 text-foreground shadow-[0_40px_80px_-30px_rgba(0,0,0,0.75)] focus:outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
			aria-describedby="spot-chapters-description"
		>
			<button type="button" class={closeButtonClass} onclick={() => (open = false)}>
				<XIcon class="size-4" />
				<span class="sr-only">Close</span>
			</button>

			<div class="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain px-6 py-7">
				<header class="space-y-2">
					<Dialog.Title class="text-xl font-semibold text-foreground">Spots</Dialog.Title>
					<p id="spot-chapters-description" class="text-sm text-muted-foreground">
						Approved spot chapters for this video.
					</p>
				</header>

				<div class="mt-5">
					{#if isLoading}
						<div class="text-sm text-white/60">Loading…</div>
					{:else if !chapters.length}
						<div class="text-sm text-white/60">No spots yet.</div>
					{:else}
						<ul class="space-y-2">
							{#each chapters as c (c.suggestionId)}
								{@const startLabel = c.startTimecode?.trim?.() || fmt(c.startSeconds)}
								{@const endLabel = c.endTimecode?.trim?.() || fmt(c.endSeconds)}
								<li
									class="flex items-center justify-between gap-3 rounded-lg border border-l-2 border-gray-700/50 border-l-[#8ecff2]/50 bg-gray-900/30 px-3 py-2"
								>
									<button
										type="button"
										class="min-w-0 flex-1 text-left"
										onclick={() => {
											seekToSeconds?.(c.startSeconds);
											open = false;
										}}
									>
										<div class="font-mono text-xs text-gray-400">{startLabel}–{endLabel}</div>
										<div class="truncate text-sm text-gray-100">
											{c.spot?.name ?? c.spotId}
										</div>
									</button>
									<div class="flex shrink-0 items-center gap-2">
										<a
											href={spotUrl(c.spotId)}
											target="_blank"
											rel="noreferrer"
											class={openSpotButtonClass}
											title="Open on parkour.spot"
											onclick={(e) => e.stopPropagation()}
										>
											<img
												src="/icons/brand-parkour-dot-spot.svg"
												alt=""
												class="size-4 invert"
												aria-hidden="true"
											/>
											<span>Open</span>
										</a>
									</div>
								</li>
							{/each}
						</ul>
					{/if}
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
