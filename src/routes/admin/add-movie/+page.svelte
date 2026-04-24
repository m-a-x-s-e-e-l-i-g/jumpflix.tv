<script lang="ts">
	import { enhance } from '$app/forms';
	import {
		getYouTubeThumbnailCandidates,
		isLikelyMissingYouTubeThumbnail,
		isYouTubeVideoId
	} from '$lib/youtube-thumbnails';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();

	// Source URL state (YouTube or Vimeo)
	let sourceUrl = $state('');
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
	let vimeoId = $state('');
	let posterUrl = $state('');
	let posterFilename = $state('');
	let posterTouched = $state(false);
	let blurhash = $state('');
	let externalUrl = $state('');
	let trakt = $state('');
	let creators = $state('');
	let starring = $state('');
	let paid = $state(false);
	let provider = $state('');
	let generatingPoster = $state(false);
	let posterGenerationError = $state('');
	let generatedPosterPreviewUrl = $state('');
	let generatedPosterSourceLabel = $state('');
	let includeTitleInPosterPrompt = $state(false);

	// Autofill (creators / athletes)
	let creatorsSuggestions = $state<string[]>([]);
	let creatorsSuggestOpen = $state(false);
	let creatorsSuggestLoading = $state(false);
	let creatorsSuggestError = $state('');
	let creatorsSuggestAbort: AbortController | null = null;

	let starringSuggestions = $state<string[]>([]);
	let starringSuggestOpen = $state(false);
	let starringSuggestLoading = $state(false);
	let starringSuggestError = $state('');
	let starringSuggestAbort: AbortController | null = null;

	// YouTube thumbnail preview (best-effort)
	let youtubeThumbUrl = $state('');
	let youtubeThumbCandidates: string[] = $state([]);
	let youtubeThumbIndex = $state(0);
	let youtubeThumbFailed = $state(false);
	let lastThumbVideoId = $state('');

	// Vimeo thumbnail preview
	let vimeoThumbUrl = $state('');
	let vimeoThumbFailed = $state(false);

	// Blurhash state
	let generatingBlurhash = $state(false);
	let blurhashError = $state('');

	function splitCommaList(value: string): string[] {
		return value
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean);
	}

	function activeToken(value: string): string {
		const parts = value.split(',');
		return (parts[parts.length - 1] ?? '').trim();
	}

	function replaceActiveToken(list: string, nextToken: string): string {
		const parts = list.split(',');
		parts[parts.length - 1] = ` ${nextToken}`;
		return parts
			.join(',')
			.split(',')
			.map((s) => s.trim())
			.filter(Boolean)
			.join(', ');
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
		role: 'creator' | 'athlete';
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


	function updatePosterUrlFromSlug() {
		if (posterTouched) return;
		const s = slug.trim();
		posterFilename = s ? `${s}.webp` : '';
		posterUrl = s ? `/images/posters/${s}.webp` : '';
	}

	function updatePosterUrlFromFilename() {
		const fn = posterFilename.trim();
		posterUrl = fn ? `/images/posters/${fn}` : '';
	}

	function isHttpUrl(value: string): boolean {
		return /^https?:\/\//i.test(value.trim());
	}

	function updateYouTubeThumbFromVideoId(idRaw: string) {
		const id = idRaw.trim();
		if (!isYouTubeVideoId(id)) {
			youtubeThumbUrl = '';
			youtubeThumbCandidates = [];
			youtubeThumbIndex = 0;
			youtubeThumbFailed = false;
			lastThumbVideoId = '';
			return;
		}
		youtubeThumbCandidates = getYouTubeThumbnailCandidates(id);
		youtubeThumbIndex = 0;
		youtubeThumbUrl = youtubeThumbCandidates[0] ?? '';
		youtubeThumbFailed = false;
		lastThumbVideoId = id;
	}

	function handleYouTubeThumbError() {
		const next = youtubeThumbIndex + 1;
		if (next >= youtubeThumbCandidates.length) {
			youtubeThumbFailed = true;
			return;
		}
		youtubeThumbIndex = next;
		youtubeThumbUrl = youtubeThumbCandidates[next] ?? '';
	}

	function handleYouTubeThumbLoad(event: Event) {
		const img = event.currentTarget;
		if (!(img instanceof HTMLImageElement)) return;
		if (isLikelyMissingYouTubeThumbnail(img.naturalWidth, img.naturalHeight)) {
			handleYouTubeThumbError();
		}
	}

	$effect(() => {
		const id = videoId.trim();
		if (id === lastThumbVideoId) return;
		updateYouTubeThumbFromVideoId(id);
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
		updatePosterUrlFromSlug();
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
		if (isYouTubeVideoId(trimmed)) return trimmed;
		return null;
	}

	function extractVimeoId(url: string): string | null {
		const trimmed = url.trim();
		if (!trimmed) return null;

		if (/^\d+$/.test(trimmed)) return trimmed;

		const rawInput = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(trimmed)
			? trimmed
			: /^([\w-]+\.)+vimeo\.com/i.test(trimmed)
				? `https://${trimmed}`
				: trimmed;

		try {
			const u = new URL(rawInput);
			const host = u.hostname.toLowerCase();
			if (!host.endsWith('vimeo.com')) return null;

			const clipId = u.searchParams.get('clip_id')?.trim();
			if (clipId && /^\d+$/.test(clipId)) return clipId;

			const parts = u.pathname.split('/').filter(Boolean);
			for (let i = parts.length - 1; i >= 0; i--) {
				const segment = parts[i] ?? '';
				if (/^\d+$/.test(segment)) return segment;
			}
		} catch {
			// not a URL
		}

		return null;
	}

	type ParsedSource = {
		provider: 'youtube' | 'vimeo';
		id: string;
		externalUrl: string;
	};

	function parseSource(url: string): ParsedSource | null {
		const ytId = extractVideoId(url);
		if (ytId) {
			return {
				provider: 'youtube',
				id: ytId,
				externalUrl: `https://www.youtube.com/watch?v=${encodeURIComponent(ytId)}`
			};
		}

		const vmId = extractVimeoId(url);
		if (vmId) {
			return {
				provider: 'vimeo',
				id: vmId,
				externalUrl: `https://vimeo.com/${encodeURIComponent(vmId)}`
			};
		}

		return null;
	}

	async function generatePosterFromThumbnail() {
		const hasYouTube = isYouTubeVideoId(videoId);
		const hasVimeo = vimeoId.trim().length > 0;

		if (!hasYouTube && !hasVimeo) {
			posterGenerationError = 'Set a valid YouTube or Vimeo video ID first.';
			return;
		}

		const filename = posterFilename.trim() || slug.trim();
		if (!filename) {
			posterGenerationError = 'Set a poster filename or slug before generating a poster.';
			return;
		}

		const filenameNoExtension = filename.replace(/\.webp$/i, '');

		generatingPoster = true;
		posterGenerationError = '';
		generatedPosterSourceLabel = '';

		try {
			const requestBody: Record<string, unknown> = {
				slug: filenameNoExtension,
				title: title.trim(),
				includeTitle: includeTitleInPosterPrompt
			};

			if (hasYouTube) {
				requestBody.videoId = videoId.trim();
			} else if (hasVimeo) {
				const sourceThumb = vimeoThumbUrl.trim() || (isHttpUrl(posterUrl) ? posterUrl.trim() : '');
				if (!sourceThumb) {
					throw new Error('Load Vimeo metadata first so a thumbnail can be used for poster generation.');
				}
				requestBody.thumbnailUrl = sourceThumb;
			}

			const res = await fetch('/api/admin/generate-poster', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify(requestBody)
			});

			if (!res.ok) {
				const body: unknown = await res.json().catch(() => ({}));
				const msg =
					body !== null && typeof body === 'object' && 'message' in body
						? String((body as { message: unknown }).message)
						: '';
				throw new Error(msg || `HTTP ${res.status}`);
			}

			const data = (await res.json()) as {
				posterUrl?: string;
				previewUrl?: string;
				sourceThumbnailUrl?: string;
				sourceWidth?: number;
				sourceHeight?: number;
			};

			posterUrl = data.posterUrl || posterUrl;				if (data.posterUrl) {
					const match = data.posterUrl.match(/\/([^\/]+)$/);
					if (match?.[1]) posterFilename = match[1];
				}			posterTouched = true;
			generatedPosterPreviewUrl = data.previewUrl || '';
			if (data.sourceThumbnailUrl && data.sourceWidth && data.sourceHeight) {
				generatedPosterSourceLabel = `${data.sourceWidth}×${data.sourceHeight} thumbnail used`;
			}
		} catch (err: unknown) {
			posterGenerationError =
				err instanceof Error ? err.message : 'Failed to generate poster from thumbnail.';
		} finally {
			generatingPoster = false;
		}
	}

	async function fetchMetadata() {
		const source = parseSource(sourceUrl);
		if (!source) {
			metaError = 'Could not extract a valid YouTube or Vimeo video ID from this URL.';
			return;
		}
		fetchingMeta = true;
		metaError = '';
		try {
			const endpoint =
				source.provider === 'youtube' ? '/api/admin/youtube-metadata' : '/api/admin/vimeo-metadata';
			const res = await fetch(`${endpoint}?videoId=${encodeURIComponent(source.id)}`);
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
			year = data.year || '';
			duration = data.duration || '';
			creators = data.author || '';
			if (source.provider === 'youtube') {
				provider = source.provider;
				externalUrl = source.externalUrl;
				videoId = data.videoId || source.id;
				vimeoId = '';
				vimeoThumbUrl = '';
				vimeoThumbFailed = false;
			} else {
				provider = '';
				externalUrl = '';
				vimeoId = data.videoId || source.id;
				videoId = '';
				const thumbUrl = typeof data.thumbnailUrl === 'string' ? data.thumbnailUrl.trim() : '';
				vimeoThumbUrl = thumbUrl;
				vimeoThumbFailed = false;
			}
			if (!slugTouched) {
				slug = year ? `${slugify(title)}-${year}` : slugify(title);
			}
			updatePosterUrlFromSlug();
			metaFetched = true;
		} catch (err: unknown) {
			metaError = err instanceof Error ? err.message : 'Failed to fetch metadata';
		} finally {
			fetchingMeta = false;
		}
	}

	async function generateBlurhash() {
		if (!posterUrl) {
			blurhashError = 'Set a poster URL first.';
			return;
		}
		generatingBlurhash = true;
		blurhashError = '';
		try {
			const url = posterUrl.startsWith('/')
				? new URL(posterUrl, window.location.origin).toString()
				: posterUrl;
			const res = await fetch(`/api/admin/blurhash?url=${encodeURIComponent(url)}`);
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

	$effect(() => {
		const q = activeToken(creators);
		creatorsSuggestError = '';
		if (!creatorsSuggestOpen || q.length < 2) {
			creatorsSuggestions = [];
			creatorsSuggestLoading = false;
			creatorsSuggestAbort?.abort();
			creatorsSuggestAbort = null;
			return;
		}

		creatorsSuggestAbort?.abort();
		const controller = new AbortController();
		creatorsSuggestAbort = controller;
		creatorsSuggestLoading = true;

		const handle = setTimeout(async () => {
			try {
				const suggestions = await fetchPeopleSuggestions({
					role: 'creator',
					query: q,
					signal: controller.signal
				});
				const existing = splitCommaList(creators).map((s) => s.toLowerCase());
				creatorsSuggestions = suggestions.filter((s) => !existing.includes(s.toLowerCase()));
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				creatorsSuggestError = 'Failed to load suggestions.';
				creatorsSuggestions = [];
			} finally {
				if (!controller.signal.aborted) creatorsSuggestLoading = false;
			}
		}, 160);

		return () => {
			clearTimeout(handle);
			controller.abort();
		};
	});

	$effect(() => {
		const q = activeToken(starring);
		starringSuggestError = '';
		if (!starringSuggestOpen || q.length < 2) {
			starringSuggestions = [];
			starringSuggestLoading = false;
			starringSuggestAbort?.abort();
			starringSuggestAbort = null;
			return;
		}

		starringSuggestAbort?.abort();
		const controller = new AbortController();
		starringSuggestAbort = controller;
		starringSuggestLoading = true;

		const handle = setTimeout(async () => {
			try {
				const suggestions = await fetchPeopleSuggestions({
					role: 'athlete',
					query: q,
					signal: controller.signal
				});
				const existing = splitCommaList(starring).map((s) => s.toLowerCase());
				starringSuggestions = suggestions.filter((s) => !existing.includes(s.toLowerCase()));
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				starringSuggestError = 'Failed to load suggestions.';
				starringSuggestions = [];
			} finally {
				if (!controller.signal.aborted) starringSuggestLoading = false;
			}
		}, 160);

		return () => {
			clearTimeout(handle);
			controller.abort();
		};
	});

	function applyCreatorSuggestion(name: string) {
		creators = replaceActiveToken(creators, name);
		creatorsSuggestOpen = false;
		creatorsSuggestions = [];
	}

	function applyStarringSuggestion(name: string) {
		starring = replaceActiveToken(starring, name);
		starringSuggestOpen = false;
		starringSuggestions = [];
	}
</script>

<div class="mx-auto w-full max-w-4xl px-6 pt-20 pb-16">
	<!-- Header -->
	<div class="jf-surface rounded-3xl p-6 md:p-8">
		<p class="jf-label">Admin desk</p>
		<h1 class="mt-2 text-3xl font-semibold text-white">Add New Film</h1>
		<p class="mt-2 text-sm text-white/60">
			Paste a YouTube or Vimeo URL to auto-populate metadata, then review and save.
		</p>
	</div>

	<!-- Action error (from form submission) -->
	{#if form?.message}
		<div class="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
			{form.message}
		</div>
	{/if}

	<!-- Step 1: Source URL -->
	<div class="jf-surface-soft mt-6 rounded-2xl p-5">
		<div class="mb-4 text-sm font-medium text-white/80">Step 1 — Paste a YouTube or Vimeo URL</div>
		<div class="flex gap-2">
			<input
				type="url"
				placeholder="https://www.youtube.com/watch?v=... or https://vimeo.com/..."
				bind:value={sourceUrl}
				onkeydown={(e) => e.key === 'Enter' && fetchMetadata()}
				class="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
			/>
			<button
				type="button"
				onclick={fetchMetadata}
				disabled={fetchingMeta || !sourceUrl.trim()}
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
							oninput={() => {
								slugTouched = true;
								updatePosterUrlFromSlug();
							}}
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
						<span class="text-xs text-white/60">Vimeo ID</span>
						<input
							type="text"
							name="vimeo_id"
							bind:value={vimeoId}
							placeholder="Vimeo video ID"
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>
					</label>

					<label class="block space-y-1.5 sm:col-span-2">
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

				<input type="hidden" name="external_url" value={externalUrl} />
				<input type="hidden" name="provider" value={provider} />

				<div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
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

		<!-- Poster -->
		<div class="jf-surface-soft rounded-2xl p-5">
			<div class="mb-4 text-sm font-medium text-white/80">Poster</div>

			<div class="space-y-3">
				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Thumbnail Preview</span>
					{#if youtubeThumbUrl && !youtubeThumbFailed}
						<img
							src={youtubeThumbUrl}
							alt="YouTube thumbnail preview"
							class="mb-3 aspect-video w-full max-w-md rounded-lg border border-white/10 object-cover"
							onload={handleYouTubeThumbLoad}
							onerror={handleYouTubeThumbError}
						/>
					{:else if youtubeThumbCandidates.length && youtubeThumbFailed}
						<div
							class="mb-3 flex aspect-video w-full max-w-md items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-white/40"
						>
							Preview unavailable
						</div>
					{:else if vimeoThumbUrl && !vimeoThumbFailed}
						<img
							src={vimeoThumbUrl}
							alt="Vimeo thumbnail preview"
							class="mb-3 aspect-video w-full max-w-md rounded-lg border border-white/10 object-cover"
							onerror={() => (vimeoThumbFailed = true)}
						/>
					{:else if vimeoThumbUrl && vimeoThumbFailed}
						<div
							class="mb-3 flex aspect-video w-full max-w-md items-center justify-center rounded-lg border border-white/10 bg-white/5 text-xs text-white/40"
						>
							Preview unavailable
						</div>
					{/if}
					<input type="hidden" name="thumbnail" value={posterUrl} />
					<p class="text-xs text-white/50">Poster path will be generated from the filename below.</p>
				</label>

				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Filename</span>
					<input
						type="text"
						bind:value={posterFilename}
						oninput={() => {
							posterTouched = true;
							updatePosterUrlFromFilename();
							generatedPosterPreviewUrl = '';
							generatedPosterSourceLabel = '';
						}}
						onblur={() => {
							if (posterFilename && !/\.webp$/i.test(posterFilename.trim())) {
								posterFilename = `${posterFilename.trim()}.webp`;
								updatePosterUrlFromFilename();
							}
						}}
						placeholder="e.g. my-movie-2024.webp"
						class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 font-mono text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
					/>
					<p class="text-xs text-white/50">Filename for generated poster (no path needed)</p>
				</label>

				<label class="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5">
					<button
						type="button"
						role="checkbox"
						aria-checked={includeTitleInPosterPrompt}
						aria-label="Include movie title in poster generation"
						onclick={() => (includeTitleInPosterPrompt = !includeTitleInPosterPrompt)}
						class={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${includeTitleInPosterPrompt ? 'bg-[#e50914]' : 'bg-white/20'}`}
					>
						<span
							class={`pointer-events-none block h-4 w-4 rounded-full bg-white shadow-lg ring-0 transition-transform ${includeTitleInPosterPrompt ? 'translate-x-4' : 'translate-x-0'}`}
						></span>
					</button>
					<div class="space-y-0.5">
						<span class="block text-sm text-white/80">Add movie title to generated poster</span>
						<p class="text-xs text-white/50">
							Off by default. When enabled, the poster prompt will ask for the title to be included.
						</p>
					</div>
				</label>

				<div class="flex flex-wrap items-center gap-2">
					<button
						type="button"
						onclick={generatePosterFromThumbnail}
					disabled={generatingPoster || (!isYouTubeVideoId(videoId) && !vimeoId.trim()) || (!slug.trim() && !posterFilename.trim())}
						class="inline-flex items-center justify-center rounded-xl bg-[#e50914] px-4 py-2 text-xs font-medium text-white transition hover:bg-[#ff1a27] disabled:cursor-not-allowed disabled:opacity-40"
					>
						{generatingPoster ? 'Generating Poster…' : 'Generate Poster From Thumbnail'}
					</button>
					{#if generatedPosterSourceLabel}
						<span class="text-xs text-white/55">{generatedPosterSourceLabel}</span>
					{/if}
				</div>
				{#if posterGenerationError}
					<p class="text-xs text-yellow-300">{posterGenerationError}</p>
				{/if}
				{#if generatedPosterPreviewUrl}
					<div class="space-y-2 rounded-xl border border-white/10 bg-white/5 p-3">
						<p class="text-xs text-white/60">Generated poster preview</p>
						<img
							src={generatedPosterPreviewUrl}
							alt="Generated poster preview"
							class="aspect-[2/3] w-full max-w-xs rounded-lg border border-white/10 object-cover"
						/>
					</div>
				{/if}

				<div class="flex items-center gap-2">
					<input
						type="text"
						name="blurhash"
						bind:value={blurhash}
						placeholder="Blurhash string (optional)"
						class="min-w-0 flex-1 rounded-xl border border-white/20 bg-white/10 px-3 py-2 font-mono text-xs text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
					/>
					<button
						type="button"
						onclick={generateBlurhash}
						disabled={generatingBlurhash || !posterUrl}
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

		<!-- Cast & Crew -->
		<div class="jf-surface-soft rounded-2xl p-5">
			<div class="mb-4 text-sm font-medium text-white/80">Cast & Crew</div>
			<div class="space-y-4">
				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Creators (comma-separated)</span>
					<div class="relative">
						<input
							type="text"
							name="creators"
							bind:value={creators}
							placeholder="e.g. Channel Name, Director"
							onfocus={() => (creatorsSuggestOpen = true)}
							onblur={() => setTimeout(() => (creatorsSuggestOpen = false), 120)}
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>

						{#if creatorsSuggestOpen && (creatorsSuggestLoading || creatorsSuggestions.length > 0)}
							<div
								class="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-black/20 backdrop-blur"
							>
								{#if creatorsSuggestLoading}
									<div class="px-4 py-3 text-xs text-white/60">Searching…</div>
								{:else}
									<div class="max-h-56 overflow-auto">
										{#each creatorsSuggestions as name (name)}
											<button
												type="button"
												onmousedown={(e) => {
													e.preventDefault();
													applyCreatorSuggestion(name);
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
					{#if creatorsSuggestError}
						<p class="text-xs text-yellow-300">{creatorsSuggestError}</p>
					{/if}
				</label>

				<label class="block space-y-1.5">
					<span class="text-xs text-white/60">Starring / Athletes (comma-separated)</span>
					<div class="relative">
						<input
							type="text"
							name="starring"
							bind:value={starring}
							placeholder="e.g. Athlete One, Athlete Two"
							onfocus={() => (starringSuggestOpen = true)}
							onblur={() => setTimeout(() => (starringSuggestOpen = false), 120)}
							class="w-full rounded-xl border border-white/20 bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 focus:border-[#e50914] focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none"
						/>

						{#if starringSuggestOpen && (starringSuggestLoading || starringSuggestions.length > 0)}
							<div
								class="absolute z-20 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-black/20 backdrop-blur"
							>
								{#if starringSuggestLoading}
									<div class="px-4 py-3 text-xs text-white/60">Searching…</div>
								{:else}
									<div class="max-h-56 overflow-auto">
										{#each starringSuggestions as name (name)}
											<button
												type="button"
												onmousedown={(e) => {
													e.preventDefault();
													applyStarringSuggestion(name);
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
					{#if starringSuggestError}
						<p class="text-xs text-yellow-300">{starringSuggestError}</p>
					{/if}
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
