<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// YouTube URL state
	let youtubeUrl = $state('');
	let fetchingMeta = $state(false);
	let metaError = $state('');
	let metaFetched = $state(false);

	// Form fields
	let title = $state('');
	let slug = $state('');
	let slugTouched = $state(false);
	let description = $state('');
	let year = $state('');
	let duration = $state('');
	let videoId = $state('');
	let thumbnail = $state('');
	let blurhash = $state('');
	let externalUrl = $state('');
	let trakt = $state('');
	let creators = $state('');
	let starring = $state('');
	let paid = $state(false);
	let provider = $state('youtube');

	// Thumbnail options
	let thumbnailOptions: Array<{ quality: string; url: string }> = $state([]);
	let selectedThumbnailQuality = $state('maxresdefault');

	// Blurhash state
	let generatingBlurhash = $state(false);
	let blurhashError = $state('');

	// Thumbnail image error state
	let thumbImgError = $state(false);

	// Copy state
	let copied = $state(false);

	$effect(() => {
		if (thumbnail) thumbImgError = false;
	});

	function slugify(text: string): string {
		return text
			.toString()
			.normalize('NFKD')
			.replace(/[\u0300-\u036f]/g, '')
			.toLowerCase()
			.replace(/&/g, ' and ')
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/(^-|-$)+/g, '')
			.replace(/-{2,}/g, '-');
	}

	function updateSlug() {
		if (!slugTouched) {
			slug = year ? `${slugify(title)}-${year}` : slugify(title);
		}
	}

	function extractVideoId(url: string): string | null {
		const trimmed = url.trim();
		if (!trimmed) return null;
		try {
			const u = new URL(trimmed);
			const host = u.hostname.toLowerCase();
			if (host === 'youtu.be') {
				return u.pathname.replace(/^\/+/, '').split('/')[0] || null;
			}
			if (host.endsWith('youtube.com') || host.endsWith('youtube-nocookie.com')) {
				if (u.pathname === '/watch') return u.searchParams.get('v');
				const m = u.pathname.match(/^\/(?:embed|shorts|v)\/([^/?#]+)/i);
				if (m) return m[1] || null;
			}
		} catch {
			// not a URL — try raw video ID
		}
		// Accept raw 11-char video ID
		if (/^[A-Za-z0-9_-]{11}$/.test(trimmed)) return trimmed;
		return null;
	}

	async function fetchMetadata() {
		const vid = extractVideoId(youtubeUrl);
		if (!vid) {
			metaError = 'Could not extract a valid YouTube video ID from this URL.';
			return;
		}
		fetchingMeta = true;
		metaError = '';
		try {
			const res = await fetch(`/api/admin/youtube-metadata?videoId=${encodeURIComponent(vid)}`);
			if (!res.ok) {
				const body: unknown = await res.json().catch(() => ({}));
				const msg =
					body !== null && typeof body === 'object' && 'message' in body
						? String((body as { message: unknown }).message)
						: '';
				throw new Error(msg || `HTTP ${res.status}`);
			}
			const data = await res.json();
			title = data.title || '';
			description = data.description || '';
			duration = data.duration || '';
			creators = data.author || '';
			videoId = data.videoId || vid;
			externalUrl = data.externalUrl || '';
			provider = 'youtube';
			thumbnailOptions = data.thumbnails || [];
			const best =
				thumbnailOptions.find((t) => t.quality === 'maxresdefault') ?? thumbnailOptions[0];
			if (best) {
				thumbnail = best.url;
				selectedThumbnailQuality = best.quality;
			}
			if (!slugTouched) {
				slug = year ? `${slugify(title)}-${year}` : slugify(title);
			}
			metaFetched = true;
		} catch (err: unknown) {
			metaError = err instanceof Error ? err.message : 'Failed to fetch metadata';
		} finally {
			fetchingMeta = false;
		}
	}

	function selectThumbnail(quality: string) {
		selectedThumbnailQuality = quality;
		const opt = thumbnailOptions.find((t) => t.quality === quality);
		if (opt) {
			thumbnail = opt.url;
			thumbImgError = false;
		}
	}

	async function generateBlurhash() {
		if (!thumbnail) {
			blurhashError = 'Set a thumbnail URL first.';
			return;
		}
		generatingBlurhash = true;
		blurhashError = '';
		try {
			const res = await fetch(`/api/admin/blurhash?url=${encodeURIComponent(thumbnail)}`);
			if (!res.ok) {
				const body: unknown = await res.json().catch(() => ({}));
				const msg =
					body !== null && typeof body === 'object' && 'message' in body
						? String((body as { message: unknown }).message)
						: '';
				throw new Error(msg || `HTTP ${res.status}`);
			}
			const data = await res.json();
			blurhash = data.blurhash || '';
		} catch (err: unknown) {
			blurhashError =
				(err instanceof Error ? err.message : 'Failed') +
				' — you can save without a blurhash or enter one manually.';
		} finally {
			generatingBlurhash = false;
		}
	}

	async function copyThumbnailUrl() {
		if (!thumbnail) return;
		try {
			await navigator.clipboard.writeText(thumbnail);
			copied = true;
			setTimeout(() => (copied = false), 2000);
		} catch {
			// clipboard not available; selection fallback handled by the visible input
		}
	}
</script>

<div class="mx-auto w-full max-w-4xl px-6 pt-20 pb-16">
	<!-- Header -->
	<div class="jf-surface rounded-3xl p-6 md:p-8">
		<p class="jf-label">Admin desk</p>
		<h1 class="mt-2 text-3xl font-semibold text-white">Add New Film</h1>
		<p class="mt-2 text-sm text-white/60">
			Paste a YouTube URL to auto-populate metadata, then review and save.
		</p>
	</div>

	<!-- Action error (from form submission) -->
	{#if form?.message}
		<div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
			{form.message}
		</div>
	{/if}

	<!-- Step 1: YouTube URL -->
	<div class="jf-surface-soft mt-6 rounded-2xl p-5">
		<div class="mb-4 text-sm font-medium text-white/80">Step 1 — Paste a YouTube URL</div>
		<div class="flex gap-2">
			<input
				type="url"
				placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
				bind:value={youtubeUrl}
				onkeydown={(e) => e.key === 'Enter' && fetchMetadata()}
				class="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
			/>
			<button
				type="button"
				onclick={fetchMetadata}
				disabled={fetchingMeta || !youtubeUrl.trim()}
				class="inline-flex items-center justify-center rounded-xl bg-[#e50914] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#ff1a27] disabled:cursor-not-allowed disabled:opacity-50"
			>
				{fetchingMeta ? 'Fetching…' : 'Fetch Metadata'}
			</button>
		</div>
		{#if metaError}
			<p class="mt-2 text-xs text-red-300">{metaError}</p>
		{/if}
		{#if metaFetched && !metaError}
			<p class="mt-2 text-xs text-green-300">✓ Metadata loaded — review and edit below.</p>
		{/if}
	</div>

	<!-- Step 2: Form -->
	<form method="POST" action="?/save" use:enhance class="mt-6 space-y-5">
		<!-- Title + Slug -->
		<div class="jf-surface-soft rounded-2xl p-5">
			<div class="mb-4 text-sm font-medium text-white/80">Basic Info</div>
			<div class="space-y-4">
				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Title <span class="text-red-400">*</span></span>
					<input
						type="text"
						name="title"
						required
						bind:value={title}
						oninput={updateSlug}
						placeholder="Film title"
						class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
					/>
				</label>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="block space-y-1.5">
						<span class="text-xs text-white/60">Year</span>
						<input
							type="text"
							name="year"
							bind:value={year}
							oninput={updateSlug}
							placeholder="e.g. 2024"
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
					</label>

					<label class="block space-y-1.5">
						<span class="text-xs text-white/60">Slug</span>
						<input
							type="text"
							name="slug"
							bind:value={slug}
							oninput={() => (slugTouched = true)}
							placeholder="auto-generated from title"
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
					</label>
				</div>

				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Description</span>
					<textarea
						name="description"
						rows="4"
						bind:value={description}
						placeholder="Film description"
						class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
					></textarea>
				</label>
			</div>
		</div>

		<!-- Video / Provider -->
		<div class="jf-surface-soft rounded-2xl p-5">
			<div class="mb-4 text-sm font-medium text-white/80">Video Source</div>
			<div class="space-y-4">
				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="block space-y-1.5">
						<span class="text-xs text-white/60">Video ID</span>
						<input
							type="text"
							name="video_id"
							bind:value={videoId}
							placeholder="YouTube video ID"
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
					</label>

					<label class="block space-y-1.5">
						<span class="text-xs text-white/60">Duration</span>
						<input
							type="text"
							name="duration"
							bind:value={duration}
							placeholder="e.g. 1h 23m or 83min"
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
					</label>
				</div>

				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">External URL</span>
					<input
						type="url"
						name="external_url"
						bind:value={externalUrl}
						placeholder="https://www.youtube.com/watch?v=..."
						class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
					/>
				</label>

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
					<label class="block space-y-1.5">
						<span class="text-xs text-white/60">Provider</span>
						<input
							type="text"
							name="provider"
							bind:value={provider}
							placeholder="e.g. youtube, vimeo"
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
					</label>

					<label class="block space-y-1.5">
						<span class="text-xs text-white/60">Trakt</span>
						<input
							type="text"
							name="trakt"
							bind:value={trakt}
							placeholder="Trakt ID"
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
					</label>
				</div>
			</div>
		</div>

		<!-- Thumbnail -->
		<div class="jf-surface-soft rounded-2xl p-5">
			<div class="mb-4 text-sm font-medium text-white/80">Thumbnail</div>

			{#if thumbnailOptions.length > 0}
				<div class="mb-4 flex flex-wrap gap-2">
					{#each thumbnailOptions as opt (opt.quality)}
						<button
							type="button"
							onclick={() => selectThumbnail(opt.quality)}
							class={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
								selectedThumbnailQuality === opt.quality
									? 'border-[#e50914] bg-[#e50914]/20 text-white'
									: 'border-white/20 bg-white/5 text-white/60 hover:bg-white/10'
							}`}
						>
							{opt.quality}
						</button>
					{/each}
				</div>
			{/if}

			<div class="space-y-3">
				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Thumbnail URL</span>
					<div class="flex gap-2">
						<input
							type="url"
							name="thumbnail"
							bind:value={thumbnail}
							placeholder="https://img.youtube.com/vi/.../maxresdefault.jpg"
							class="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
						<button
							type="button"
							onclick={copyThumbnailUrl}
							disabled={!thumbnail}
							class="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-2.5 text-sm font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
						>
							{copied ? '✓ Copied' : 'Copy'}
						</button>
					</div>
				</label>

				{#if thumbnail}
					<div class="flex gap-4">
						{#if !thumbImgError}
							<img
								src={thumbnail}
								alt="Thumbnail preview"
								class="h-20 w-36 rounded-lg object-cover"
								onerror={() => (thumbImgError = true)}
							/>
						{:else}
							<div
								class="flex h-20 w-36 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-white/40"
							>
								Preview unavailable
							</div>
						{/if}
						<div class="flex flex-col justify-center gap-2">
							<div class="flex items-center gap-2">
								<input
									type="text"
									name="blurhash"
									bind:value={blurhash}
									placeholder="Blurhash string"
									class="w-56 rounded-xl border border-white/20 bg-white/10 px-3 py-2 font-mono text-xs text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
								/>
								<button
									type="button"
									onclick={generateBlurhash}
									disabled={generatingBlurhash || !thumbnail}
									class="inline-flex items-center justify-center rounded-xl border border-white/20 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-40"
								>
									{generatingBlurhash ? 'Generating…' : 'Generate Blurhash'}
								</button>
							</div>
							{#if blurhashError}
								<p class="text-xs text-yellow-300">{blurhashError}</p>
							{/if}
						</div>
					</div>
				{:else}
					<div class="flex items-center gap-2">
						<input
							type="text"
							name="blurhash"
							bind:value={blurhash}
							placeholder="Blurhash string (optional)"
							class="w-full rounded-xl border border-white/20 bg-white/10 px-3 py-2 font-mono text-xs text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
					</div>
				{/if}
			</div>
		</div>

		<!-- Cast & Crew -->
		<div class="jf-surface-soft rounded-2xl p-5">
			<div class="mb-4 text-sm font-medium text-white/80">Cast & Crew</div>
			<div class="space-y-4">
				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Creators (comma-separated)</span>
					<input
						type="text"
						name="creators"
						bind:value={creators}
						placeholder="e.g. Channel Name, Director"
						class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
					/>
				</label>

				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Starring / Athletes (comma-separated)</span>
					<input
						type="text"
						name="starring"
						bind:value={starring}
						placeholder="e.g. Athlete One, Athlete Two"
						class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
					/>
				</label>

				<label class="flex items-center gap-3">
					<input type="hidden" name="paid" value={paid ? 'true' : 'false'} />
					<button
						type="button"
						role="checkbox"
						aria-checked={paid}
						aria-label="Paid content"
						onclick={() => (paid = !paid)}
						class={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${paid ? 'bg-[#e50914]' : 'bg-white/20'}`}
					>
						<span
							class={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${paid ? 'translate-x-4' : 'translate-x-0'}`}
						></span>
					</button>
					<span class="text-sm text-white/80">Paid content</span>
				</label>
			</div>
		</div>

		<!-- Save -->
		<div class="flex justify-end pt-2">
			<button
				type="submit"
				class="inline-flex items-center justify-center rounded-full bg-[#e50914] px-8 py-3 text-sm font-medium text-white transition hover:bg-[#ff1a27] focus-visible:ring-2 focus-visible:ring-[#e50914] focus-visible:outline-none"
			>
				Save Film
			</button>
		</div>
	</form>
</div>
