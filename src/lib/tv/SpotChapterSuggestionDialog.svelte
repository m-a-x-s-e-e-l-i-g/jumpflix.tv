<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import MapPinIcon from '@lucide/svelte/icons/map-pin';
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import ParkourSpotPicker from '$lib/components/ParkourSpotPicker.svelte';
	import { normalizeParkourSpotId } from '$lib/utils';

	const dispatch = createEventDispatcher<{
		submitted: { id: number | null; status: string | null };
	}>();

	let {
		mediaId = null,
		mediaType = null,
		playbackKey = null,
		getCurrentTimeSeconds = null,
		spotChapterId = null,
		initialStartSeconds = null,
		initialEndSeconds = null,
		lockTimeRange = false,
		triggerClass =
			'control-button',
		triggerAriaLabel = 'Suggest a parkour spot (chapter)',
		triggerTitle = 'Suggest spot'
	} = $props<{
		mediaId?: number | null;
		mediaType?: 'movie' | 'series' | null;
		playbackKey?: string | null;
		getCurrentTimeSeconds?: (() => number) | null;
		spotChapterId?: number | null;
		initialStartSeconds?: number | null;
		initialEndSeconds?: number | null;
		lockTimeRange?: boolean;
		triggerClass?: string;
		triggerAriaLabel?: string;
		triggerTitle?: string;
	}>();

	let open = $state(false);
	let isSubmitting = $state(false);
	let isChangeMode = $derived(Boolean(spotChapterId) && Boolean(lockTimeRange));

	let startSeconds = $state<number | ''>('');
	let endSeconds = $state<number | ''>('');
	let spotId = $state('');

	$effect(() => {
		if (!open) return;
		if (lockTimeRange) {
			if (typeof initialStartSeconds === 'number' && Number.isFinite(initialStartSeconds)) {
				startSeconds = Math.floor(Math.max(0, initialStartSeconds));
			}
			if (typeof initialEndSeconds === 'number' && Number.isFinite(initialEndSeconds)) {
				endSeconds = Math.floor(Math.max(0, initialEndSeconds));
			}
		}
	});

	function safeNowSeconds(): number {
		try {
			const v = getCurrentTimeSeconds?.();
			return Number.isFinite(v as any) ? Math.max(0, Number(v)) : 0;
		} catch {
			return 0;
		}
	}

	function fmtTime(seconds: number): string {
		if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
		const s = Math.floor(seconds);
		const m = Math.floor(s / 60);
		const r = s % 60;
		return `${m}:${String(r).padStart(2, '0')}`;
	}

	function clampInt(value: number | ''): number | null {
		if (value === '') return null;
		const n = Math.floor(Number(value));
		if (!Number.isFinite(n)) return null;
		return Math.max(0, n);
	}

	async function submit() {
		if (isSubmitting) return;
		if (!mediaId || !mediaType) {
			toast.error('Missing media context for this video.');
			return;
		}

		const start = clampInt(startSeconds);
		const end = clampInt(endSeconds);
		const id = normalizeParkourSpotId(spotId) ?? spotId.trim();

		if (!id) {
			toast.error('Pick a spot first.');
			return;
		}
		if (start === null || end === null) {
			toast.error('Provide a start and end time.');
			return;
		}
		if (end <= start) {
			toast.error('End time must be after start time.');
			return;
		}

		isSubmitting = true;
		try {
			const body = {
				mediaId,
				mediaType,
				targetScope: 'media',
				kind: 'spot_chapter',
				payload: {
					spotId: id,
					startSeconds: start,
					endSeconds: end,
					startTimecode: fmtTime(start),
					endTimecode: fmtTime(end),
					playbackKey: playbackKey ?? undefined,
					spotChapterId: spotChapterId ?? undefined
				}
			};

			const res = await fetch('/api/suggestions', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(body)
			});

			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data?.error || 'Failed to submit suggestion');
			}

			dispatch('submitted', {
				id: typeof data?.id === 'number' ? data.id : Number(data?.id) || null,
				status: typeof data?.status === 'string' ? data.status : null
			});

			toast.message(isChangeMode ? 'Thanks! Spot change submitted.' : 'Thanks! Spot suggestion submitted.');
			open = false;
			startSeconds = '';
			endSeconds = '';
			spotId = '';
		} catch (err: any) {
			toast.error(err?.message || 'Failed to submit suggestion');
		} finally {
			isSubmitting = false;
		}
	}

	const closeButtonClass =
		'absolute right-5 top-5 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20';
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger
		class={triggerClass}
		aria-label={triggerAriaLabel}
		title={triggerTitle}
		data-jumpflix-gesture-ignore="true"
	>
		<span class="icon" aria-hidden="true"><MapPinIcon /></span>
		<span class="sr-only">{triggerTitle}</span>
	</Dialog.Trigger>

	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-[60] bg-black/78 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-[70] max-h-[calc(100dvh-2rem)] w-full max-w-3xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-background p-0 text-foreground shadow-[0_40px_80px_-30px_rgba(0,0,0,0.75)] focus:outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
			aria-describedby="spot-suggestion-description"
		>
			<button type="button" class={closeButtonClass} onclick={() => (open = false)}>
				<XIcon class="size-4" />
				<span class="sr-only">Close</span>
			</button>

			<div class="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain px-6 py-7">
				<div class="flex flex-col gap-5">
					<header class="space-y-2">
						<Dialog.Title class="text-xl font-semibold text-foreground">
							{isChangeMode ? 'Change current spot' : 'Suggest a parkour spot'}
						</Dialog.Title>
						<p id="spot-suggestion-description" class="text-sm text-muted-foreground">
							{isChangeMode
								? 'Pick a new Parkour·Spot for the currently active chapter range.'
								: 'Mark a time range in this video and attach a Parkour·Spot id.'}
						</p>
					</header>

					<div class="grid grid-cols-1 gap-4">
						<div class="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4">
							<div class="text-sm font-medium text-white/80">Time range</div>

							<div class="grid grid-cols-2 gap-3">
								<label class="space-y-1">
									<span class="text-xs text-white/70">Start (seconds)</span>
									<input
										type="number"
										min="0"
										disabled={lockTimeRange}
										bind:value={startSeconds}
										class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
									/>
									<div class="text-[11px] text-white/50">
										{startSeconds === '' ? '—' : fmtTime(Number(startSeconds))}
									</div>
								</label>

								<label class="space-y-1">
									<span class="text-xs text-white/70">End (seconds)</span>
									<input
										type="number"
										min="0"
										disabled={lockTimeRange}
										bind:value={endSeconds}
										class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
									/>
									<div class="text-[11px] text-white/50">
										{endSeconds === '' ? '—' : fmtTime(Number(endSeconds))}
									</div>
								</label>
							</div>

							{#if !lockTimeRange}
								<div class="flex flex-wrap gap-2">
									<button
										type="button"
										class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
										onclick={() => (startSeconds = Math.floor(safeNowSeconds()))}
									>
										Set start to current
									</button>
									<button
										type="button"
										class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-xs text-white/80 hover:bg-white/10"
										onclick={() => (endSeconds = Math.floor(safeNowSeconds()))}
									>
										Set end to current
									</button>
								</div>
							{/if}
						</div>
					</div>

					<div class="rounded-xl border border-white/10 bg-white/5 p-4">
						<div class="mb-3 text-sm font-medium text-white/80">Pick a spot</div>
						<ParkourSpotPicker bind:spotId />
					</div>

					<div class="flex flex-wrap items-center justify-between gap-3">
						<div class="text-xs text-white/60">
							Sends a suggestion for moderation (doesn’t immediately change chapters).
						</div>
						<button
							type="button"
							disabled={isSubmitting}
							onclick={submit}
							class="inline-flex items-center justify-center rounded-xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-white hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
						>
							{isSubmitting ? 'Submitting…' : 'Submit suggestion'}
						</button>
					</div>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
