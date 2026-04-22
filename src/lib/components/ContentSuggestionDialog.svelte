<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import ContentWarningIcon from '$lib/components/ContentWarningIcon.svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import type { Snippet } from 'svelte';
	import type {
		ContentWarning,
		ContentItem,
		Episode,
		FacetEnvironment,
		FacetFocus,
		FacetMedium,
		FacetMovement,
		FacetPresentation,
		FacetProduction,
		FacetType
	} from '$lib/tv/types';
	import {
		CONTENT_WARNING_DESCRIPTIONS,
		CONTENT_WARNING_LABELS,
		CONTENT_WARNING_OPTIONS,
		FACET_ENVIRONMENT_DESCRIPTIONS,
		FACET_ENVIRONMENT_LABELS,
		FACET_ENVIRONMENT_OPTIONS,
		FACET_FOCUS_DESCRIPTIONS,
		FACET_FOCUS_LABELS,
		FACET_FOCUS_OPTIONS,
		FACET_MEDIUM_DESCRIPTIONS,
		FACET_MEDIUM_LABELS,
		FACET_MEDIUM_OPTIONS,
		FACET_MOVEMENT_DESCRIPTIONS,
		FACET_MOVEMENT_LABELS,
		FACET_MOVEMENT_OPTIONS,
		FACET_PRESENTATION_DESCRIPTIONS,
		FACET_PRESENTATION_LABELS,
		FACET_PRESENTATION_OPTIONS,
		FACET_PRODUCTION_DESCRIPTIONS,
		FACET_PRODUCTION_LABELS,
		FACET_PRODUCTION_OPTIONS,
		FACET_TYPE_DESCRIPTIONS,
		FACET_TYPE_LABELS,
		FACET_TYPE_OPTIONS
	} from '$lib/tv/facet-options';
	import { parseTimecodeToSeconds } from '$lib/utils/timecode';

	let {
		selected,
		selectedEpisode = null,
		selectedSeasonNumber = null,
		triggerClass =
			'relative inline-flex items-center gap-2 rounded-md border border-border bg-background/90 px-4 py-2 text-sm font-medium text-foreground shadow-sm transition hover:-translate-y-0.5 hover:bg-muted/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
		triggerLabel = 'Suggest change / report issue',
		triggerAriaLabel = 'Suggest change / report issue',
		trigger = undefined
	} = $props<{
		selected: ContentItem | null;
		selectedEpisode?: Episode | null;
		selectedSeasonNumber?: number | null;
		triggerClass?: string;
		triggerLabel?: string;
		triggerAriaLabel?: string;
		trigger?: Snippet;
	}>();

	let open = $state(false);
	let isSubmitting = $state(false);

	type Kind =
		| 'facets'
		| 'people'
		| 'description'
		| 'new_season'
		| 'new_episode'
		| 'tracks'
		| 'broken_link';

	let kind: Kind = $state('facets');

	let targetScope: 'media' | 'episode' = $state('media');
	let seasonNumber = $state<number | ''>('');
	let episodeNumber = $state<number | ''>('');

	let description = $state('');

	let creators = $state<string[]>([]);
	let starring = $state<string[]>([]);
	let newCreator = $state('');
	let newStar = $state('');
	let creatorSuggestions = $state<string[]>([]);
	let creatorSuggestOpen = $state(false);
	let creatorSuggestLoading = $state(false);
	let creatorSuggestError = $state('');
	let creatorSuggestAbort: AbortController | null = null;
	let starSuggestions = $state<string[]>([]);
	let starSuggestOpen = $state(false);
	let starSuggestLoading = $state(false);
	let starSuggestError = $state('');
	let starSuggestAbort: AbortController | null = null;

	let setFacetType = $state<FacetType | ''>('');
	let setFacetEnvironment = $state<FacetEnvironment | ''>('');
	let setFacetFocus = $state<FacetFocus | ''>('');
	let setFacetProduction = $state<FacetProduction | ''>('');
	let setFacetPresentation = $state<FacetPresentation | ''>('');
	let setFacetMedium = $state<FacetMedium | ''>('');
	let facetMovement = $state<FacetMovement[]>([]);
	let contentWarnings = $state<ContentWarning[]>([]);

	// New season/episode fields
	let newSeasonPlaylistId = $state('');
	let newSeasonCustomName = $state('');

	let newEpisodeVideoId = $state('');
	let newEpisodeTitle = $state('');
	let newEpisodeThumbnail = $state('');

	// Track suggestion (single-entry, MVP)
	let trackAction: 'add' | 'remove' | 'edit' = $state('add');
	let trackSpotifyUrl = $state('');
	let trackRemoveChoice = $state('');
	let trackEditChoice = $state('');
	let trackTitle = $state('');
	let trackArtist = $state('');
	let trackStartTimecode = $state('');
	let trackStartAtSeconds = $state<number | ''>('');

	type SpotifySearchResult = {
		id: string;
		url: string;
		title: string;
		artist: string;
		durationMs?: number;
	};
	let spotifySearchLoading = $state(false);
	let spotifySearchError = $state('');
	let spotifySearchResults = $state<SpotifySearchResult[]>([]);
	let spotifySelectedTrackId = $state('');

	const FACETS_DOCS_URL = 'https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/blob/master/docs/FACETS.md';
	const KIND_META: Record<Kind, { label: string; description: string }> = {
		facets: {
			label: 'Facets',
			description: 'Refine the catalog tags that describe how this piece feels, reads, and should be discovered.'
		},
		people: {
			label: 'People',
			description: 'Add or remove creators and athletes so the credits stay useful and accurate.'
		},
		description: {
			label: 'Description',
			description: 'Rewrite the synopsis when it misses the tone, facts, or framing of the piece.'
		},
		new_season: {
			label: 'New season',
			description: 'Report a newly published season so the archive can catch up quickly.'
		},
		new_episode: {
			label: 'New episode',
			description: 'Flag a fresh episode with the basic metadata needed to add it to the series.'
		},
		tracks: {
			label: 'Tracks',
			description: 'Correct soundtrack entries or timestamps so tracklists stay reliable for rewatches.'
		},
		broken_link: {
			label: 'Broken link',
			description: 'Let us know when the video is unavailable, geo-blocked, or otherwise no longer watchable.'
		}
	};
	const controlBaseClass =
		'w-full min-h-11 rounded-xl border px-4 py-3 text-sm text-foreground shadow-inner transition-[border-color,box-shadow,background-color,color] placeholder:text-muted-foreground/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/25 disabled:cursor-not-allowed disabled:opacity-60';
	const fieldLabelClass = 'text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground';
	const helpTextClass = 'text-[11px] leading-5 text-muted-foreground/85';
	const sectionTitleClass = 'text-sm font-medium text-foreground';
	const choiceCardClass =
		'flex min-h-11 items-start gap-3 rounded-xl border border-white/10 bg-black/15 px-3 py-2.5 text-foreground/85 transition hover:border-white/20 hover:bg-white/[0.06] focus-within:border-primary/45 focus-within:bg-white/[0.07]';
	const itemPickerClass =
		'max-h-56 overflow-auto rounded-2xl border border-white/10 bg-black/20 supports-[backdrop-filter]:bg-black/25';
	const actionButtonBase =
		'inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium uppercase tracking-[0.18em] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-60';

	type InitialSnapshot = {
		description: string;
		creators: string[];
		starring: string[];
		facetType: string;
		facetEnvironment: string;
		facetFocus: string;
		facetProduction: string;
		facetPresentation: string;
		facetMedium: string;
		facetMovement: string[];
		contentWarnings: string[];
	};

	let initial = $state<InitialSnapshot | null>(null);
	let initialKey = $state<string | null>(null);

	function normString(value: unknown): string {
		return String(value ?? '').trim();
	}

	type TrackChoice = {
		songId: number | null;
		spotifyUrl: string | null;
		startAtSeconds: number | null;
		startTimecode: string | null;
	};

	function trackChoiceFromTrack(t: any): TrackChoice {
		const songIdRaw = t?.song?.id;
		const songId =
			typeof songIdRaw === 'number' && Number.isFinite(songIdRaw) ? Math.max(1, Math.floor(songIdRaw)) : null;
		const spotifyUrl = normString(t?.song?.spotifyUrl) || null;
		const startAtSecondsRaw =
			typeof t?.startAtSeconds === 'number' && Number.isFinite(t.startAtSeconds)
				? Math.max(0, Math.floor(t.startAtSeconds))
				: null;
		const startTimecode = normString(t?.startTimecode) || null;
		return { songId, spotifyUrl, startAtSeconds: startAtSecondsRaw, startTimecode };
	}

	function trackChoiceValue(t: any): string {
		return JSON.stringify(trackChoiceFromTrack(t));
	}

	function safeParseTrackChoice(value: string): TrackChoice | null {
		const raw = normString(value);
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw);
			const songIdRaw = parsed?.songId;
			const songId =
				typeof songIdRaw === 'number' && Number.isFinite(songIdRaw)
					? Math.max(1, Math.floor(songIdRaw))
					: null;
			const spotifyUrl = normString(parsed?.spotifyUrl) || null;
			if (!songId && !spotifyUrl) return null;
			const sas = parsed?.startAtSeconds;
			const startAtSeconds =
				typeof sas === 'number' && Number.isFinite(sas) ? Math.max(0, Math.floor(sas)) : null;
			const stc = normString(parsed?.startTimecode) || null;
			return { songId, spotifyUrl, startAtSeconds, startTimecode: stc };
		} catch {
			return null;
		}
	}

	function trackTimeLabel(t: any): string {
		const tc = normString(t?.startTimecode);
		if (tc) return tc;
		const s = t?.startAtSeconds;
		if (typeof s === 'number' && Number.isFinite(s)) return `${Math.max(0, Math.floor(s))}s`;
		return '—';
	}

	function normList(values: unknown): string[] {
		if (!Array.isArray(values)) return [];
		return values.map((v) => normString(v)).filter(Boolean);
	}

	function uniqueCasePreserving(values: string[]): string[] {
		const out: string[] = [];
		const seen = new Set<string>();
		for (const raw of values) {
			const v = normString(raw);
			if (!v) continue;
			const key = v.toLowerCase();
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(v);
		}
		return out;
	}

	function uniqueNames(values: string[]): string[] {
		return uniqueCasePreserving(values);
	}

	function stringSetEqual(a: string[], b: string[]): boolean {
		const sa = new Set(a.map((v) => normString(v).toLowerCase()).filter(Boolean));
		const sb = new Set(b.map((v) => normString(v).toLowerCase()).filter(Boolean));
		if (sa.size !== sb.size) return false;
		for (const v of sa) if (!sb.has(v)) return false;
		return true;
	}

	function diffAdd(current: string[], base: string[]): string[] {
		const baseSet = new Set(base.map((v) => normString(v).toLowerCase()).filter(Boolean));
		return uniqueCasePreserving(current).filter((v) => !baseSet.has(v.toLowerCase()));
	}

	function diffRemove(base: string[], current: string[]): string[] {
		const currentSet = new Set(current.map((v) => normString(v).toLowerCase()).filter(Boolean));
		return uniqueCasePreserving(base).filter((v) => !currentSet.has(v.toLowerCase()));
	}

	function valueDescription<T extends string>(
		value: T | '',
		descriptions: Record<T, string>
	): string | null {
		return value ? descriptions[value] : null;
	}

	function addCreatorToList() {
		const v = normString(newCreator);
		if (!v) return;
		creators = uniqueCasePreserving([...creators, v]);
		newCreator = '';
		creatorSuggestions = [];
		creatorSuggestError = '';
	}

	function removeCreatorFromList(value: string) {
		const key = normString(value).toLowerCase();
		creators = creators.filter((v) => normString(v).toLowerCase() !== key);
	}

	function addStarToList() {
		const v = normString(newStar);
		if (!v) return;
		starring = uniqueCasePreserving([...starring, v]);
		newStar = '';
		starSuggestions = [];
		starSuggestError = '';
	}

	async function fetchPeopleSuggestions(opts: {
		role: 'creator' | 'athlete' | 'any';
		query: string;
		signal: AbortSignal;
	}): Promise<string[]> {
		const res = await fetch(
			`/api/people-suggest?role=${encodeURIComponent(opts.role)}&q=${encodeURIComponent(opts.query)}`,
			{ signal: opts.signal }
		);
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error(typeof body?.error === 'string' ? body.error : 'Failed to load suggestions.');
		}
		const body = (await res.json()) as { results?: Array<{ name?: unknown }> };
		const names = Array.isArray(body?.results)
			? body.results
					.map((result) => (typeof result?.name === 'string' ? result.name : ''))
					.filter(Boolean)
			: [];
		return uniqueNames(names);
	}

	function removeStarFromList(value: string) {
		const key = normString(value).toLowerCase();
		starring = starring.filter((v) => normString(v).toLowerCase() !== key);
	}

	function sectionPanelClass(isEdited = false): string {
		return `space-y-4 rounded-2xl border p-4 sm:p-5 ${
			isEdited ? 'border-primary/35 bg-primary/[0.06]' : 'border-white/10 bg-white/[0.04]'
		}`;
	}

	function editedInputClass(isEdited: boolean): string {
		return `${controlBaseClass} ${
			isEdited
				? 'border-primary/60 bg-primary/[0.07] focus-visible:border-primary'
				: 'border-white/15 bg-white/[0.06] hover:border-white/25 focus-visible:border-primary'
		}`;
	}

	function editedSelectClass(isEdited: boolean): string {
		return `${controlBaseClass} text-base ${
			isEdited
				? 'border-primary/60 bg-primary/[0.07] focus-visible:border-primary'
				: 'border-white/15 bg-white/[0.06] hover:border-white/25 focus-visible:border-primary'
		}`;
	}

	function editedBadge(isEdited: boolean) {
		return isEdited
			? 'inline-flex items-center rounded-full border border-primary/35 bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary-foreground/90'
			: 'hidden';
	}

	$effect(() => {
		if (!open) {
			initial = null;
			initialKey = null;
			kind = 'facets';
			targetScope = 'media';
			seasonNumber = '';
			episodeNumber = '';
			newSeasonPlaylistId = '';
			newSeasonCustomName = '';
			newEpisodeVideoId = '';
			newEpisodeTitle = '';
			newEpisodeThumbnail = '';
			spotifySearchLoading = false;
			spotifySearchError = '';
			spotifySearchResults = [];
			spotifySelectedTrackId = '';
			creatorSuggestions = [];
			creatorSuggestOpen = false;
			creatorSuggestLoading = false;
			creatorSuggestError = '';
			creatorSuggestAbort?.abort();
			creatorSuggestAbort = null;
			starSuggestions = [];
			starSuggestOpen = false;
			starSuggestLoading = false;
			starSuggestError = '';
			starSuggestAbort?.abort();
			starSuggestAbort = null;
			return;
		}
		if (!selected) return;

		// Snapshot & preload values only once per open+target.
		const key = `${selected.type}:${selected.id}`;
		if (initialKey !== key) {
			initialKey = key;

			description = normString(selected.description);

			creators = normList(selected.creators);
			starring = normList(selected.starring);
			newCreator = '';
			newStar = '';

			setFacetType = (selected.facets?.type ?? '') as FacetType | '';
			setFacetEnvironment = (selected.facets?.environment ?? '') as FacetEnvironment | '';
			setFacetFocus = (selected.facets?.focus ?? '') as FacetFocus | '';
			setFacetProduction = (selected.facets?.production ?? '') as FacetProduction | '';
			setFacetPresentation = (selected.facets?.presentation ?? '') as FacetPresentation | '';
			setFacetMedium = (selected.facets?.medium ?? '') as FacetMedium | '';
			facetMovement = (selected.facets?.movement ?? []) as FacetMovement[];
			contentWarnings = (selected.facets?.contentWarnings ?? []) as ContentWarning[];

			trackAction = 'add';
			trackSpotifyUrl = '';
			trackRemoveChoice = selected.tracks?.length ? trackChoiceValue(selected.tracks?.[0]) : '';
			trackEditChoice = selected.tracks?.length ? trackChoiceValue(selected.tracks?.[0]) : '';
			trackTitle = '';
			trackArtist = '';
			trackStartTimecode = '';
			trackStartAtSeconds = '';
			newSeasonPlaylistId = '';
			newSeasonCustomName = '';
			newEpisodeVideoId = '';
			newEpisodeTitle = '';
			newEpisodeThumbnail = '';

			spotifySearchLoading = false;
			spotifySearchError = '';
			spotifySearchResults = [];
			spotifySelectedTrackId = '';

			initial = {
				description: normString(selected.description),
				creators: normList(selected.creators),
				starring: normList(selected.starring),
				facetType: normString(selected.facets?.type),
				facetEnvironment: normString(selected.facets?.environment),
				facetFocus: normString(selected.facets?.focus),
				facetProduction: normString(selected.facets?.production),
				facetPresentation: normString(selected.facets?.presentation),
				facetMedium: normString(selected.facets?.medium),
				facetMovement: normList(selected.facets?.movement),
				contentWarnings: normList(selected.facets?.contentWarnings)
			};
		}

		// Reset defaults on open (series episode scoping)
		if (selected?.type === 'series') {
			const epPos = selectedEpisode?.position;
			const sn = selectedSeasonNumber ?? null;
			if (
				typeof epPos === 'number' &&
				Number.isFinite(epPos) &&
				typeof sn === 'number' &&
				Number.isFinite(sn)
			) {
				targetScope = 'episode';
				seasonNumber = sn;
				episodeNumber = Math.max(1, Math.floor(epPos));
			} else {
				targetScope = 'media';
				seasonNumber = '';
				episodeNumber = '';
			}
		} else {
			targetScope = 'media';
			seasonNumber = '';
			episodeNumber = '';
		}

		tick().catch(() => {});
	});

	let descriptionEdited: boolean = $derived(
		normString(description) !== normString(initial?.description)
	);
	let creatorsEdited: boolean = $derived(!stringSetEqual(creators, initial?.creators ?? []));
	let starringEdited: boolean = $derived(!stringSetEqual(starring, initial?.starring ?? []));
	let facetTypeEdited: boolean = $derived(
		normString(setFacetType) !== normString(initial?.facetType)
	);
	let facetEnvironmentEdited: boolean = $derived(
		normString(setFacetEnvironment) !== normString(initial?.facetEnvironment)
	);
	let facetFocusEdited: boolean = $derived(
		normString(setFacetFocus) !== normString(initial?.facetFocus)
	);
	let facetProductionEdited: boolean = $derived(
		normString(setFacetProduction) !== normString(initial?.facetProduction)
	);
	let facetPresentationEdited: boolean = $derived(
		normString(setFacetPresentation) !== normString(initial?.facetPresentation)
	);
	let facetMediumEdited: boolean = $derived(
		normString(setFacetMedium) !== normString(initial?.facetMedium)
	);
	let facetMovementEdited: boolean = $derived(
		!stringSetEqual(facetMovement as unknown as string[], initial?.facetMovement ?? [])
	);
	let contentWarningsEdited: boolean = $derived(
		!stringSetEqual(contentWarnings as unknown as string[], initial?.contentWarnings ?? [])
	);
	let kindMeta = $derived(KIND_META[kind]);
	let targetSummary: string = $derived.by(() => {
		if (!selected) return 'No title selected';
		if (
			selected.type === 'series' &&
			targetScope === 'episode' &&
			typeof seasonNumber === 'number' &&
			typeof episodeNumber === 'number'
		) {
			return `${selected.title} • S${seasonNumber}E${episodeNumber}`;
		}
		return selected.title;
	});
	let spotifyStatusMessage: string = $derived.by(() => {
		if (spotifySearchLoading) return 'Searching Spotify…';
		if (spotifySearchError) return spotifySearchError;
		if (spotifySearchResults.length) {
			return `${spotifySearchResults.length} Spotify matches ready to review.`;
		}
		return '';
	});

	$effect(() => {
		const query = normString(newCreator);
		creatorSuggestError = '';
		if (!open || kind !== 'people' || !creatorSuggestOpen || query.length < 2) {
			creatorSuggestions = [];
			creatorSuggestLoading = false;
			creatorSuggestAbort?.abort();
			creatorSuggestAbort = null;
			return;
		}

		creatorSuggestAbort?.abort();
		const controller = new AbortController();
		creatorSuggestAbort = controller;
		creatorSuggestLoading = true;

		const handle = setTimeout(async () => {
			try {
				const names = await fetchPeopleSuggestions({
					role: 'any',
					query,
					signal: controller.signal
				});
				const existing = new Set(creators.map((value) => value.toLowerCase()));
				creatorSuggestions = names.filter((name) => !existing.has(name.toLowerCase()));
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				creatorSuggestError = err instanceof Error ? err.message : 'Failed to load suggestions.';
				creatorSuggestions = [];
			} finally {
				if (!controller.signal.aborted) creatorSuggestLoading = false;
			}
		}, 160);

		return () => {
			clearTimeout(handle);
			controller.abort();
		};
	});

	$effect(() => {
		const query = normString(newStar);
		starSuggestError = '';
		if (!open || kind !== 'people' || !starSuggestOpen || query.length < 2) {
			starSuggestions = [];
			starSuggestLoading = false;
			starSuggestAbort?.abort();
			starSuggestAbort = null;
			return;
		}

		starSuggestAbort?.abort();
		const controller = new AbortController();
		starSuggestAbort = controller;
		starSuggestLoading = true;

		const handle = setTimeout(async () => {
			try {
				const names = await fetchPeopleSuggestions({
					role: 'any',
					query,
					signal: controller.signal
				});
				const existing = new Set(starring.map((value) => value.toLowerCase()));
				starSuggestions = names.filter((name) => !existing.has(name.toLowerCase()));
			} catch (err: unknown) {
				if (err instanceof DOMException && err.name === 'AbortError') return;
				starSuggestError = err instanceof Error ? err.message : 'Failed to load suggestions.';
				starSuggestions = [];
			} finally {
				if (!controller.signal.aborted) starSuggestLoading = false;
			}
		}, 160);

		return () => {
			clearTimeout(handle);
			controller.abort();
		};
	});

	$effect(() => {
		if (!open) return;
		if (!selected) return;
		if (kind !== 'tracks') return;
		if (trackAction !== 'edit') return;
		const list = selected?.tracks ?? [];
		if (!list.length) return;

		const currentKey = normString(trackEditChoice);
		const selectedTrack = list.find((t: any) => trackChoiceValue(t) === currentKey) ?? list[0];
		if (!selectedTrack) return;

		const nextChoice = trackChoiceValue(selectedTrack);
		if (nextChoice && normString(trackEditChoice) !== nextChoice) {
			trackEditChoice = nextChoice;
		}

		const nextUrl = normString(selectedTrack?.song?.spotifyUrl);
		trackSpotifyUrl = nextUrl;
		spotifySelectedTrackId = '';
		spotifySearchResults = [];
		spotifySearchError = '';
		trackTitle = normString(selectedTrack?.song?.title);
		trackArtist = normString(selectedTrack?.song?.artist);
		trackStartTimecode = normString(selectedTrack?.startTimecode);
		trackStartAtSeconds =
			typeof selectedTrack?.startAtSeconds === 'number' &&
			Number.isFinite(selectedTrack.startAtSeconds)
				? selectedTrack.startAtSeconds
				: '';
	});

	$effect(() => {
		if (!open) return;
		if (kind !== 'tracks') return;

		const parsed = parseTimecodeToSeconds(trackStartTimecode);
		if (typeof parsed === 'number' && Number.isFinite(parsed) && parsed >= 0) {
			trackStartAtSeconds = parsed;
		}
	});

	async function searchSpotifyForTrack() {
		if (!browser) return;
		spotifySearchError = '';
		spotifySearchResults = [];
		spotifySelectedTrackId = '';

		const title = trackTitle.trim();
		const artist = trackArtist.trim();
		if (!title) {
			spotifySearchError = 'Enter a title to search.';
			return;
		}

		spotifySearchLoading = true;
		try {
			const res = await fetch('/api/spotify/search-track', {
				method: 'POST',
				headers: { 'content-type': 'application/json' },
				body: JSON.stringify({ title, artist: artist || undefined, limit: 10 })
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) {
				throw new Error(data?.error || 'Spotify search failed');
			}
			spotifySearchResults = Array.isArray(data?.tracks) ? data.tracks : [];
			if (!spotifySearchResults.length) {
				spotifySearchError = 'No results found.';
			}
		} catch (err: any) {
			spotifySearchError = err?.message || 'Spotify search failed';
		} finally {
			spotifySearchLoading = false;
		}
	}

	$effect(() => {
		if (!open) return;
		if (kind !== 'tracks') return;
		if (trackAction !== 'add') return;
		if (!spotifySelectedTrackId) return;
		const picked = spotifySearchResults.find((t) => String(t?.id) === spotifySelectedTrackId);
		if (!picked) return;
		trackSpotifyUrl = normString(picked.url);
		// Keep the form aligned with the selected Spotify entry.
		trackTitle = normString(picked.title) || trackTitle;
		trackArtist = normString(picked.artist) || trackArtist;
	});

	let removeSelectedTrack: any = $derived(
		String(kind) === 'tracks'
			? (selected?.tracks ?? []).find(
					(t: any) => trackChoiceValue(t) === normString(trackRemoveChoice)
				) ?? null
			: null
	);
	let editSelectedTrack: any = $derived(
		String(kind) === 'tracks'
			? (selected?.tracks ?? []).find((t: any) => trackChoiceValue(t) === normString(trackEditChoice)) ??
				null
			: null
	);
	let removeSelectedLabel: string = $derived(
		removeSelectedTrack
			? `${normString(removeSelectedTrack?.song?.artist)} — ${normString(removeSelectedTrack?.song?.title)} @ ${trackTimeLabel(removeSelectedTrack)}`
			: '—'
	);
	let editSelectedLabel: string = $derived(
		editSelectedTrack
			? `${normString(editSelectedTrack?.song?.artist)} — ${normString(editSelectedTrack?.song?.title)} @ ${trackTimeLabel(editSelectedTrack)}`
			: '—'
	);

	function buildPayload(): any {
		const payload: any = {};

		if (kind === 'description' && descriptionEdited) {
			payload.set = { ...(payload.set ?? {}), description: normString(description) || null };
		}

		if (kind === 'people') {
			const add: any = {};
			const remove: any = {};

			const baseCreators = initial?.creators ?? [];
			const baseStarring = initial?.starring ?? [];

			const addCreatorsList = diffAdd(creators, baseCreators);
			const removeCreatorsList = diffRemove(baseCreators, creators);
			const addStarringList = diffAdd(starring, baseStarring);
			const removeStarringList = diffRemove(baseStarring, starring);

			if (addCreatorsList.length) add.creators = addCreatorsList;
			if (removeCreatorsList.length) remove.creators = removeCreatorsList;
			if (addStarringList.length) add.starring = addStarringList;
			if (removeStarringList.length) remove.starring = removeStarringList;

			if (Object.keys(add).length) payload.add = add;
			if (Object.keys(remove).length) payload.remove = remove;
		}

		if (kind === 'facets') {
			const add: any = {};
			const remove: any = {};
			const set: any = {};

			const baseMovement = initial?.facetMovement ?? [];
			const baseContentWarnings = initial?.contentWarnings ?? [];

			const addMovementList = diffAdd(facetMovement as unknown as string[], baseMovement);
			const removeMovementList = diffRemove(baseMovement, facetMovement as unknown as string[]);
			const addContentWarningsList = diffAdd(
				contentWarnings as unknown as string[],
				baseContentWarnings
			);
			const removeContentWarningsList = diffRemove(
				baseContentWarnings,
				contentWarnings as unknown as string[]
			);

			if (addMovementList.length) add.facet_movement = addMovementList;
			if (removeMovementList.length) remove.facet_movement = removeMovementList;
			if (addContentWarningsList.length) add.content_warnings = addContentWarningsList;
			if (removeContentWarningsList.length) remove.content_warnings = removeContentWarningsList;

			if (facetTypeEdited) set.facet_type = normString(setFacetType) || null;
			if (facetEnvironmentEdited) set.facet_environment = normString(setFacetEnvironment) || null;
			if (facetFocusEdited) set.facet_focus = normString(setFacetFocus) || null;
			if (facetProductionEdited) set.facet_production = normString(setFacetProduction) || null;
			if (facetPresentationEdited) set.facet_presentation = normString(setFacetPresentation) || null;
			if (facetMediumEdited) set.facet_medium = normString(setFacetMedium) || null;

			if (Object.keys(add).length) payload.add = add;
			if (Object.keys(remove).length) payload.remove = remove;
			if (Object.keys(set).length) payload.set = set;
		}

		if (kind === 'new_season') {
			const set: any = {};
			if (typeof seasonNumber === 'number') set.season_number = seasonNumber;
			if (newSeasonPlaylistId.trim()) set.playlist_id = newSeasonPlaylistId.trim();
			if (newSeasonCustomName.trim()) set.custom_name = newSeasonCustomName.trim();
			payload.season = set;
		}

		if (kind === 'new_episode') {
			const ep: any = {};
			if (typeof seasonNumber === 'number') ep.season_number = seasonNumber;
			if (typeof episodeNumber === 'number') ep.episode_number = episodeNumber;
			if (newEpisodeVideoId.trim()) ep.video_id = newEpisodeVideoId.trim();
			if (newEpisodeTitle.trim()) ep.title = newEpisodeTitle.trim();
			if (newEpisodeThumbnail.trim()) ep.thumbnail = newEpisodeThumbnail.trim();
			payload.episode = ep;
		}

		if (kind === 'tracks') {
			const removeChoice = safeParseTrackChoice(trackRemoveChoice);
			const editChoice = safeParseTrackChoice(trackEditChoice);
			const choiceSongId =
				trackAction === 'remove'
					? removeChoice?.songId
					: trackAction === 'edit'
						? editChoice?.songId
						: null;
			const choiceUrl =
				trackAction === 'remove'
					? normString(removeChoice?.spotifyUrl)
					: trackAction === 'edit'
						? normString(editChoice?.spotifyUrl)
						: '';
			const effectiveSpotifyUrl =
				trackAction === 'remove'
					? choiceUrl || normString(trackSpotifyUrl)
					: trackAction === 'edit'
						? choiceUrl || normString(trackSpotifyUrl)
						: normString(trackSpotifyUrl);

			const action = trackAction === 'remove' ? 'remove' : 'add';

			let title = trackTitle.trim();
			let artist = trackArtist.trim();
			let prevStartAtSeconds: number | undefined = undefined;
			let prevStartTimecode: string | undefined = undefined;
			if (trackAction === 'edit') {
				const t = (selected?.tracks ?? []).find(
					(x: any) => trackChoiceValue(x) === normString(trackEditChoice)
				);
				title = title || normString(t?.song?.title);
				artist = artist || normString(t?.song?.artist);
				prevStartAtSeconds =
					typeof t?.startAtSeconds === 'number' && Number.isFinite(t.startAtSeconds)
						? t.startAtSeconds
						: undefined;
				prevStartTimecode = normString(t?.startTimecode) || undefined;
			}

			let startTimecodeForPayload = trackStartTimecode.trim() || undefined;
			let startAtSecondsForPayload =
				typeof trackStartAtSeconds === 'number' ? trackStartAtSeconds : undefined;
			if (trackAction === 'remove') {
				const tr = (selected?.tracks ?? []).find(
					(x: any) => trackChoiceValue(x) === normString(trackRemoveChoice)
				);
				startTimecodeForPayload = normString(tr?.startTimecode) || undefined;
				startAtSecondsForPayload =
					typeof tr?.startAtSeconds === 'number' && Number.isFinite(tr.startAtSeconds)
						? tr.startAtSeconds
						: undefined;
			}

			const t: any = {
				action,
				operation: trackAction === 'edit' ? 'edit' : undefined,
				songId: typeof choiceSongId === 'number' ? choiceSongId : undefined,
				spotifyUrl: effectiveSpotifyUrl || undefined,
				title: title || undefined,
				artist: artist || undefined,
				startTimecode: startTimecodeForPayload,
				startAtSeconds: startAtSecondsForPayload,
				previousStartAtSeconds:
					trackAction === 'edit' ? (prevStartAtSeconds ?? undefined) : undefined,
				previousStartTimecode:
					trackAction === 'edit' ? (prevStartTimecode ?? undefined) : undefined
			};
			payload.track = t;
		}

		return Object.keys(payload).length ? payload : undefined;
	}

	let currentPayload = $derived(buildPayload());
	let canSubmit: boolean = $derived(
		Boolean(selected) && (String(kind) === 'broken_link' || Boolean(currentPayload))
	);

	async function submit() {
		if (!browser) return;
		if (!selected) return;
		const payload = buildPayload();
		if (String(kind) !== 'broken_link' && !payload) {
			toast.error('Make at least one change before submitting.');
			return;
		}

		isSubmitting = true;
		try {
			const body = {
				mediaId: Number(selected.id),
				mediaType: selected.type,
				kind,
				targetScope,
				seasonNumber: targetScope === 'episode' ? seasonNumber : undefined,
				episodeNumber: targetScope === 'episode' ? episodeNumber : undefined,
				payload
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

			toast.message('Thanks! Suggestion submitted.');
			open = false;
		} catch (err: any) {
			toast.error(err?.message || 'Failed to submit suggestion');
		} finally {
			isSubmitting = false;
		}
	}

	const closeButtonClass =
		'absolute right-4 top-4 inline-flex size-10 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/72 transition hover:border-white/20 hover:bg-white/[0.1] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:right-5 sm:top-5';
</script>

<Dialog.Root bind:open>
	<Dialog.Trigger class={triggerClass} aria-label={triggerAriaLabel} title={triggerAriaLabel}>
		{#if trigger}
			{@render trigger()}
		{:else}
			{triggerLabel}
		{/if}
	</Dialog.Trigger>
	<Dialog.Portal>
		<Dialog.Overlay
			class="fixed inset-0 z-40 bg-background/86 backdrop-blur-[3px] data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none"
		/>
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-1rem)] w-[min(52rem,calc(100vw-1rem))] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[1.75rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.98),rgba(8,12,24,0.98))] text-foreground shadow-[0_40px_110px_-36px_rgba(2,6,23,0.92)] focus:outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:data-[state=closed]:animate-none motion-reduce:data-[state=open]:animate-none sm:max-h-[calc(100dvh-2.5rem)]"
			aria-describedby="content-suggestion-description"
		>
			<button type="button" class={closeButtonClass} onclick={() => (open = false)}>
				<XIcon class="size-4" />
				<span class="sr-only">Close</span>
			</button>

			<div class="border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0))] px-5 pb-5 pt-5 sm:px-6 sm:pb-6 sm:pt-6">
				<div class="pr-12">
					<p class="jf-label">Community Upkeep</p>
					<Dialog.Title class="mt-3 text-2xl font-semibold tracking-[-0.025em] text-foreground"
						>Suggest a change</Dialog.Title
					>
					<p id="content-suggestion-description" class="mt-2 max-w-[62ch] text-sm leading-6 text-muted-foreground">
						Improve metadata, availability, episodic details, or soundtrack info so the archive stays trustworthy.
					</p>
					<div class="mt-4 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-white/72">
						<span class="uppercase tracking-[0.18em] text-white/45">Target</span>
						<span class="truncate text-white/90">{targetSummary}</span>
					</div>
				</div>
			</div>

			<div class="flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
				<div class="flex flex-col gap-5">

					<div class="grid grid-cols-1 gap-4">
						<label class="space-y-2">
							<span class={sectionTitleClass}>Category</span>
							<select bind:value={kind} class={editedSelectClass(false)}>
								<option value="facets" class="bg-background text-foreground">Facets</option>
								<option value="people" class="bg-background text-foreground"
									>Creators / starring (athletes)</option
								>
								<option value="description" class="bg-background text-foreground"
									>Description</option
								>
								{#if selected?.type === 'series'}
									<option value="new_episode" class="bg-background text-foreground"
										>New episode available</option
									>
									<option value="new_season" class="bg-background text-foreground"
										>New season available</option
									>
								{/if}
								<option value="tracks" class="bg-background text-foreground"
									>Tracks & timestamps</option
								>
								<option value="broken_link" class="bg-background text-foreground"
									>Content not available / broken link</option
								>
							</select>
							<p class="text-sm leading-6 text-muted-foreground">{kindMeta.description}</p>
						</label>

						{#if selected?.type === 'series'}
							<fieldset class={sectionPanelClass(targetScope === 'episode')}>
								<legend class={sectionTitleClass}>Scope</legend>
								<p class="text-sm leading-6 text-muted-foreground">
									Choose whether this suggestion applies to the overall series or the episode currently in view.
								</p>
								<div class="flex flex-wrap gap-3 text-sm text-white/85">
									<label class={`${choiceCardClass} flex-1 sm:flex-none`}>
										<input type="radio" bind:group={targetScope} value="media" />
										<span>Series overall</span>
									</label>
									<label class={`${choiceCardClass} flex-1 sm:flex-none`}>
										<input type="radio" bind:group={targetScope} value="episode" />
										<span>Specific episode</span>
									</label>
								</div>

								{#if targetScope === 'episode'}
									<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
										<label class="space-y-1">
											<span class={fieldLabelClass}>Season number</span>
											<input
												type="number"
												min="1"
												bind:value={seasonNumber}
												class={editedInputClass(false)}
											/>
										</label>
										<label class="space-y-1">
											<span class={fieldLabelClass}>Episode number</span>
											<input
												type="number"
												min="1"
												bind:value={episodeNumber}
												class={editedInputClass(false)}
											/>
										</label>
									</div>
								{/if}
							</fieldset>
						{/if}

						{#if kind === 'description'}
							<div class={sectionPanelClass(descriptionEdited)}>
								<label class="space-y-2">
									<span class="inline-flex items-center gap-2 text-sm font-medium text-foreground">
										Description
										<span class={editedBadge(descriptionEdited)}>Edited</span>
									</span>
									<textarea
										rows="6"
										bind:value={description}
										placeholder="Suggest a better description…"
										class={`${editedInputClass(descriptionEdited)} min-h-36 resize-y`}
									></textarea>
									{#if initial?.description}
										<div class={helpTextClass}>
											Current: <span class="text-white/80">{initial.description}</span>
										</div>
									{/if}
								</label>
							</div>
						{/if}

						{#if kind === 'people'}
							<div class={sectionPanelClass(creatorsEdited || starringEdited)}>
								<div class="space-y-2">
									<div class="inline-flex items-center gap-2 text-sm font-medium text-foreground">
										Creators
										<span class={editedBadge(creatorsEdited)}>Edited</span>
									</div>
									<div class="relative">
										<div class="flex gap-2">
											<input
												bind:value={newCreator}
												placeholder="Start typing a creator name"
												class={editedInputClass(false)}
												onfocus={() => (creatorSuggestOpen = true)}
												onblur={() => setTimeout(() => (creatorSuggestOpen = false), 120)}
												onkeydown={(e) => {
													if (e.key === 'Enter') {
														e.preventDefault();
														addCreatorToList();
													}
												}}
											/>
											<button
												type="button"
												class={`${actionButtonBase} shrink-0 px-4 text-xs border border-white/15 bg-white/[0.05] text-white/75 hover:border-white/25 hover:bg-white/[0.09] hover:text-white`}
												onclick={addCreatorToList}
											>
												Add
											</button>
										</div>
										{#if creatorSuggestOpen && (creatorSuggestLoading || creatorSuggestions.length > 0)}
											<div class="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-[0_18px_45px_-25px_rgba(2,6,23,0.9)] backdrop-blur">
												{#if creatorSuggestLoading}
													<div class="px-4 py-3 text-xs text-white/60">Searching people…</div>
												{:else}
													<div class="max-h-56 overflow-auto py-1">
														{#each creatorSuggestions as name (name)}
															<button
																type="button"
																onmousedown={(e) => {
																	e.preventDefault();
																	newCreator = name;
																	addCreatorToList();
																}}
																class="block w-full px-4 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
															>
																{name}
															</button>
														{/each}
													</div>
												{/if}
											</div>
										{/if}
									</div>
									<p class={helpTextClass}>Autocomplete searches all known people in the archive. Press Enter to add a custom name.</p>
									{#if creatorSuggestError}
										<p class="text-xs text-yellow-300">{creatorSuggestError}</p>
									{/if}
									{#if creators.length}
										<div class="flex flex-wrap gap-2">
											{#each creators as c (c)}
												<button
													type="button"
													class={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
														(initial?.creators ?? []).some(
															(v) => v.toLowerCase() === c.toLowerCase()
														)
															? 'border-white/15 bg-white/5 text-white/80'
															: 'border-primary/35 bg-primary/10 text-primary-foreground/90'
													}`}
													onclick={() => removeCreatorFromList(c)}
													title="Remove"
												>
													{c}
													<span class="text-white/50">×</span>
												</button>
											{/each}
										</div>
									{:else}
										<div class="text-xs text-white/60">No creators set.</div>
									{/if}
								</div>

								<div class="space-y-2">
									<div class="inline-flex items-center gap-2 text-sm font-medium text-foreground">
										Starring
										<span class={editedBadge(starringEdited)}>Edited</span>
									</div>
									<div class="relative">
										<div class="flex gap-2">
											<input
												bind:value={newStar}
												placeholder="Start typing an athlete name"
												class={editedInputClass(false)}
												onfocus={() => (starSuggestOpen = true)}
												onblur={() => setTimeout(() => (starSuggestOpen = false), 120)}
												onkeydown={(e) => {
													if (e.key === 'Enter') {
														e.preventDefault();
														addStarToList();
													}
												}}
											/>
											<button
												type="button"
												class={`${actionButtonBase} shrink-0 px-4 text-xs border border-white/15 bg-white/[0.05] text-white/75 hover:border-white/25 hover:bg-white/[0.09] hover:text-white`}
												onclick={addStarToList}
											>
												Add
											</button>
										</div>
										{#if starSuggestOpen && (starSuggestLoading || starSuggestions.length > 0)}
											<div class="absolute z-20 mt-2 w-full overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-[0_18px_45px_-25px_rgba(2,6,23,0.9)] backdrop-blur">
												{#if starSuggestLoading}
													<div class="px-4 py-3 text-xs text-white/60">Searching people…</div>
												{:else}
													<div class="max-h-56 overflow-auto py-1">
														{#each starSuggestions as name (name)}
															<button
																type="button"
																onmousedown={(e) => {
																	e.preventDefault();
																	newStar = name;
																	addStarToList();
																}}
																class="block w-full px-4 py-2.5 text-left text-sm text-white/80 transition hover:bg-white/[0.08] hover:text-white"
															>
																{name}
															</button>
														{/each}
													</div>
												{/if}
											</div>
										{/if}
									</div>
									<p class={helpTextClass}>Autocomplete searches all known people in the archive, even if they currently appear as creators somewhere else.</p>
									{#if starSuggestError}
										<p class="text-xs text-yellow-300">{starSuggestError}</p>
									{/if}
									{#if starring.length}
										<div class="flex flex-wrap gap-2">
											{#each starring as s (s)}
												<button
													type="button"
													class={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs ${
														(initial?.starring ?? []).some(
															(v) => v.toLowerCase() === s.toLowerCase()
														)
															? 'border-white/15 bg-white/5 text-white/80'
															: 'border-primary/35 bg-primary/10 text-primary-foreground/90'
													}`}
													onclick={() => removeStarFromList(s)}
													title="Remove"
												>
													{s}
													<span class="text-white/50">×</span>
												</button>
											{/each}
										</div>
									{:else}
										<div class="text-xs text-white/60">No starring set.</div>
									{/if}
								</div>
							</div>
						{/if}

						{#if kind === 'facets'}
							<div class={sectionPanelClass(
								facetTypeEdited ||
								facetEnvironmentEdited ||
								facetFocusEdited ||
								facetProductionEdited ||
								facetPresentationEdited ||
								facetMediumEdited ||
								facetMovementEdited ||
								contentWarningsEdited
							)}>
								<div class="rounded-2xl border border-white/10 bg-black/20 p-4 text-sm leading-6 text-muted-foreground">
									<a
										href={FACETS_DOCS_URL}
										target="_blank"
										rel="noopener noreferrer"
										class="font-medium text-white underline decoration-white/30 underline-offset-4 transition hover:decoration-white/70"
									>
										Read the full FACETS.md documentation
									</a>
								</div>
								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<label class="space-y-1">
										<span class={`inline-flex items-center gap-2 ${fieldLabelClass}`}>
											Facet type
											<span class={editedBadge(facetTypeEdited)}>Edited</span>
										</span>
										<span class={`block ${helpTextClass}`}>
											What kind of content this primarily is.
										</span>
										<select bind:value={setFacetType} class={editedSelectClass(facetTypeEdited)}>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_TYPE_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{FACET_TYPE_LABELS[opt]}</option>
											{/each}
										</select>
										{#if setFacetType}
											<span class={`block ${helpTextClass}`}>
												{valueDescription(setFacetType, FACET_TYPE_DESCRIPTIONS)}
											</span>
										{/if}
									</label>
									<label class="space-y-1">
										<span class={`inline-flex items-center gap-2 ${fieldLabelClass}`}>
											Environment
											<span class={editedBadge(facetEnvironmentEdited)}>Edited</span>
										</span>
										<span class={`block ${helpTextClass}`}>
											The dominant setting that defines the video visually.
										</span>
										<select
											bind:value={setFacetEnvironment}
											class={editedSelectClass(facetEnvironmentEdited)}
										>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_ENVIRONMENT_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{FACET_ENVIRONMENT_LABELS[opt]}</option>
											{/each}
										</select>
										{#if setFacetEnvironment}
											<span class={`block ${helpTextClass}`}>
												{valueDescription(setFacetEnvironment, FACET_ENVIRONMENT_DESCRIPTIONS)}
											</span>
										{/if}
									</label>
									<label class="space-y-1">
										<span class={`inline-flex items-center gap-2 ${fieldLabelClass}`}>
											Focus
											<span class={editedBadge(facetFocusEdited)}>Edited</span>
										</span>
										<span class={`block ${helpTextClass}`}>
											Optional: the special angle or intent that defines the piece.
										</span>
										<select
											bind:value={setFacetFocus}
											class={editedSelectClass(facetFocusEdited)}
										>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_FOCUS_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{FACET_FOCUS_LABELS[opt]}</option>
											{/each}
										</select>
										{#if setFacetFocus}
											<span class={`block ${helpTextClass}`}>
												{valueDescription(setFacetFocus, FACET_FOCUS_DESCRIPTIONS)}
											</span>
										{/if}
									</label>
									<label class="space-y-1">
										<span class={`inline-flex items-center gap-2 ${fieldLabelClass}`}>
											Production
											<span class={editedBadge(facetProductionEdited)}>Edited</span>
										</span>
										<span class={`block ${helpTextClass}`}>
											How polished the edit and production feel overall.
										</span>
										<select bind:value={setFacetProduction} class={editedSelectClass(facetProductionEdited)}>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_PRODUCTION_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{FACET_PRODUCTION_LABELS[opt]}</option>
											{/each}
										</select>
										{#if setFacetProduction}
											<span class={`block ${helpTextClass}`}>
												{valueDescription(setFacetProduction, FACET_PRODUCTION_DESCRIPTIONS)}
											</span>
										{/if}
									</label>
									<label class="space-y-1">
										<span class={`inline-flex items-center gap-2 ${fieldLabelClass}`}>
											Presentation
											<span class={editedBadge(facetPresentationEdited)}>Edited</span>
										</span>
										<span class={`block ${helpTextClass}`}>
											How the video is packaged or framed for the viewer.
										</span>
										<select bind:value={setFacetPresentation} class={editedSelectClass(facetPresentationEdited)}>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_PRESENTATION_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{FACET_PRESENTATION_LABELS[opt]}</option>
											{/each}
										</select>
										{#if setFacetPresentation}
											<span class={`block ${helpTextClass}`}>
												{valueDescription(setFacetPresentation, FACET_PRESENTATION_DESCRIPTIONS)}
											</span>
										{/if}
									</label>
									<label class="space-y-1">
										<span class={`inline-flex items-center gap-2 ${fieldLabelClass}`}>
											Medium
											<span class={editedBadge(facetMediumEdited)}>Edited</span>
										</span>
										<span class={`block ${helpTextClass}`}>
											Only set this when the medium itself is meaningfully defining.
										</span>
										<select bind:value={setFacetMedium} class={editedSelectClass(facetMediumEdited)}>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_MEDIUM_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{FACET_MEDIUM_LABELS[opt]}</option>
											{/each}
										</select>
										{#if setFacetMedium}
											<span class={`block ${helpTextClass}`}>
												{valueDescription(setFacetMedium, FACET_MEDIUM_DESCRIPTIONS)}
											</span>
										{/if}
									</label>
								</div>

								<div class="grid grid-cols-1 gap-3 lg:grid-cols-2">
									<div class="space-y-2">
										<div class={`inline-flex items-center gap-2 ${fieldLabelClass}`}>
											Movement
											<span class={editedBadge(facetMovementEdited)}>Edited</span>
										</div>
										<div class={helpTextClass}>
											Multi-select. Tag all movement styles that are meaningfully present.
										</div>
										<div
											class={`rounded-2xl border p-3 ${facetMovementEdited ? 'border-primary/35 bg-primary/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}
										>
											<div class="grid gap-2">
												{#each FACET_MOVEMENT_OPTIONS as opt (opt)}
													<label class={choiceCardClass}>
														<input class="mt-1" type="checkbox" bind:group={facetMovement} value={opt} />
														<span class="min-w-0">
															<span class="block text-sm text-white/90">{FACET_MOVEMENT_LABELS[opt]}</span>
															<span class={`block ${helpTextClass}`}>
																{FACET_MOVEMENT_DESCRIPTIONS[opt]}
															</span>
														</span>
													</label>
												{/each}
											</div>
										</div>
									</div>
									<div class="space-y-2">
										<div class={`inline-flex items-center gap-2 ${fieldLabelClass}`}>
											Content warnings
											<span class={editedBadge(contentWarningsEdited)}>Edited</span>
										</div>
										<div class={helpTextClass}>
											Viewer advisories only. Use these when the warning is meaningfully present, not for browsing.
										</div>
										<div
											class={`rounded-2xl border p-3 ${contentWarningsEdited ? 'border-primary/35 bg-primary/[0.06]' : 'border-white/10 bg-white/[0.04]'}`}
										>
											<div class="grid gap-2">
												{#each CONTENT_WARNING_OPTIONS as opt (opt)}
													<label class={choiceCardClass}>
														<input class="mt-1" type="checkbox" bind:group={contentWarnings} value={opt} />
														<span class="min-w-0">
															<span class="flex items-center gap-2 text-sm text-white/90">
																<ContentWarningIcon warning={opt} className="h-4 w-4 text-white/70" />
																{CONTENT_WARNING_LABELS[opt]}
															</span>
															<span class={`block ${helpTextClass}`}>
																{CONTENT_WARNING_DESCRIPTIONS[opt]}
															</span>
														</span>
													</label>
												{/each}
											</div>
										</div>
									</div>
								</div>
							</div>
						{/if}

						{#if kind === 'new_season'}
							<div class={sectionPanelClass(Boolean(newSeasonPlaylistId.trim() || newSeasonCustomName.trim() || typeof seasonNumber === 'number'))}>
								<label class="space-y-1">
									<span class={fieldLabelClass}>Season number</span>
									<input
										type="number"
										min="1"
										bind:value={seasonNumber}
										class={editedInputClass(typeof seasonNumber === 'number')}
									/>
								</label>
								<label class="space-y-1">
									<span class={fieldLabelClass}>YouTube playlist ID</span>
									<input
										bind:value={newSeasonPlaylistId}
										class={editedInputClass(Boolean(newSeasonPlaylistId.trim()))}
									/>
									<p class={helpTextClass}>Optional, but useful when the season already exists as a playlist.</p>
								</label>
								<label class="space-y-1">
									<span class={fieldLabelClass}>Custom season name</span>
									<input
										bind:value={newSeasonCustomName}
										class={editedInputClass(Boolean(newSeasonCustomName.trim()))}
									/>
								</label>
							</div>
						{/if}

						{#if kind === 'new_episode'}
							<div class={sectionPanelClass(Boolean(newEpisodeVideoId.trim() || newEpisodeTitle.trim() || newEpisodeThumbnail.trim() || typeof seasonNumber === 'number' || typeof episodeNumber === 'number'))}>
								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<label class="space-y-1">
										<span class={fieldLabelClass}>Season number</span>
										<input
											type="number"
											min="1"
											bind:value={seasonNumber}
											class={editedInputClass(typeof seasonNumber === 'number')}
										/>
									</label>
									<label class="space-y-1">
										<span class={fieldLabelClass}>Episode number</span>
										<input
											type="number"
											min="1"
											bind:value={episodeNumber}
											class={editedInputClass(typeof episodeNumber === 'number')}
										/>
									</label>
								</div>
								<label class="space-y-1">
									<span class={fieldLabelClass}>Video ID</span>
									<input
										bind:value={newEpisodeVideoId}
										class={editedInputClass(Boolean(newEpisodeVideoId.trim()))}
									/>
									<p class={helpTextClass}>Use the platform video ID when you have it. Leave blank if you only know the title.</p>
								</label>
								<label class="space-y-1">
									<span class={fieldLabelClass}>Episode title</span>
									<input
										bind:value={newEpisodeTitle}
										class={editedInputClass(Boolean(newEpisodeTitle.trim()))}
									/>
								</label>
								<label class="space-y-1">
									<span class={fieldLabelClass}>Thumbnail URL</span>
									<input
										bind:value={newEpisodeThumbnail}
										class={editedInputClass(Boolean(newEpisodeThumbnail.trim()))}
									/>
								</label>
							</div>
						{/if}

						{#if kind === 'tracks'}
							<div class={sectionPanelClass(trackAction !== 'remove' ? Boolean(trackTitle.trim() || trackArtist.trim() || trackSpotifyUrl.trim() || trackStartTimecode.trim()) : Boolean(trackRemoveChoice))}>
								<div class="flex flex-wrap gap-3 text-sm text-white/85">
									<label class={`${choiceCardClass} flex-1 sm:flex-none`}>
										<input type="radio" bind:group={trackAction} value="add" />
										<span>Add track</span>
									</label>
									<label class={`${choiceCardClass} flex-1 sm:flex-none`}>
										<input type="radio" bind:group={trackAction} value="edit" />
										<span>Edit timestamp</span>
									</label>
									<label class={`${choiceCardClass} flex-1 sm:flex-none`}>
										<input type="radio" bind:group={trackAction} value="remove" />
										<span>Remove track</span>
									</label>
								</div>
								{#if trackAction === 'remove'}
									{#if selected?.tracks?.length}
										<div class="space-y-2">
											<div class={fieldLabelClass}>Select track to remove</div>
											<div class={itemPickerClass}>
												{#each selected.tracks as t (trackChoiceValue(t))}
													<label
														class="flex items-start gap-3 border-b border-white/5 px-3 py-2.5 last:border-b-0 hover:bg-white/[0.06] focus-within:bg-white/[0.06]"
													>
														<input
															class="mt-1"
															type="radio"
															bind:group={trackRemoveChoice}
															value={trackChoiceValue(t)}
														/>
														<div class="min-w-0">
															<div class="truncate text-sm text-white">
																{t.song.artist} — {t.song.title}
															</div>
															<div class="text-xs text-white/50">
																{trackTimeLabel(t)}
															</div>
														</div>
													</label>
												{/each}
											</div>
											<div class={helpTextClass}>
												Selected: <span class="text-white/80">{removeSelectedLabel}</span>
											</div>
										</div>
									{:else}
										<div class={helpTextClass}>
											No tracks found for this video. You can still paste a Spotify URL below.
										</div>
										<label class="space-y-1">
											<span class={fieldLabelClass}>Spotify track URL</span>
											<input
												bind:value={trackSpotifyUrl}
												placeholder="https://open.spotify.com/track/..."
												class={editedInputClass(Boolean(trackSpotifyUrl.trim()))}
											/>
										</label>
									{/if}
								{:else if trackAction === 'edit'}
									{#if selected?.tracks?.length}
										<div class="space-y-2">
											<div class={fieldLabelClass}>Select track to edit</div>
											<div class={itemPickerClass}>
												{#each selected.tracks as t (trackChoiceValue(t))}
													<label
														class="flex items-start gap-3 border-b border-white/5 px-3 py-2.5 last:border-b-0 hover:bg-white/[0.06] focus-within:bg-white/[0.06]"
													>
														<input
															class="mt-1"
															type="radio"
															bind:group={trackEditChoice}
															value={trackChoiceValue(t)}
														/>
														<div class="min-w-0">
															<div class="truncate text-sm text-white">
																{t.song.artist} — {t.song.title}
															</div>
															<div class="text-xs text-white/50">
																{trackTimeLabel(t)}
															</div>
														</div>
													</label>
												{/each}
											</div>
											<div class={helpTextClass}>
												Selected: <span class="text-white/80">{editSelectedLabel}</span>
											</div>
										</div>

										<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
											<label class="space-y-1">
												<span class={fieldLabelClass}>Start timecode</span>
												<input
													bind:value={trackStartTimecode}
													class={editedInputClass(Boolean(trackStartTimecode.trim()))}
												/>
											</label>
										</div>
									{:else}
										<div class={helpTextClass}>No tracks found for this video.</div>
									{/if}
								{:else}
									<label class="space-y-1">
										<span class={fieldLabelClass}>Spotify track URL</span>
										<input
											bind:value={trackSpotifyUrl}
											placeholder="https://open.spotify.com/track/..."
											class={editedInputClass(Boolean(trackSpotifyUrl.trim()))}
										/>
										<div class={helpTextClass}>Leave blank if the song is not on Spotify.</div>
									</label>
								{/if}
								{#if trackAction === 'add'}
									<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
										<label class="space-y-1">
											<span class={fieldLabelClass}>Artist</span>
											<input
												bind:value={trackArtist}
												class={editedInputClass(Boolean(trackArtist.trim()))}
											/>
										</label>
										<label class="space-y-1">
											<span class={fieldLabelClass}>Title</span>
											<input
												bind:value={trackTitle}
												class={editedInputClass(Boolean(trackTitle.trim()))}
											/>
										</label>
										<div class="sm:col-span-2 flex flex-wrap items-center gap-2">
											<button
												type="button"
												disabled={spotifySearchLoading || !trackTitle.trim()}
												class={`${actionButtonBase} px-4 text-xs border border-white/15 bg-white/[0.05] text-white/80 hover:border-white/25 hover:bg-white/[0.09]`}
												onclick={searchSpotifyForTrack}
											>
												{spotifySearchLoading ? 'Searching…' : 'Search Spotify'}
											</button>
											<div class={helpTextClass} role="status" aria-live="polite">
												{spotifyStatusMessage}
											</div>
										</div>

										{#if spotifySearchResults.length}
											<div class="sm:col-span-2 space-y-2">
												<div class={fieldLabelClass}>Select the correct Spotify track</div>
												<div class={itemPickerClass}>
													{#each spotifySearchResults as r (r.id)}
														<label class="flex items-start gap-3 border-b border-white/5 px-3 py-2.5 last:border-b-0 hover:bg-white/[0.06] focus-within:bg-white/[0.06]">
															<input
																class="mt-1"
																type="radio"
																bind:group={spotifySelectedTrackId}
																value={r.id}
															/>
															<div class="min-w-0">
																<div class="truncate text-sm text-white">{r.artist} — {r.title}</div>
																<div class="truncate text-xs text-white/50">
																	<a
																		href={r.url}
																		target="_blank"
																		rel="noreferrer"
																		class="transition hover:text-white hover:underline"
																	>
																		{r.url}
																	</a>
																</div>
															</div>
														</label>
													{/each}
												</div>
												<div class={helpTextClass}>
													Selected track will fill the Spotify URL.
												</div>
											</div>
										{/if}
										<label class="space-y-1">
											<span class={fieldLabelClass}>Start timecode</span>
											<input
												bind:value={trackStartTimecode}
												class={editedInputClass(Boolean(trackStartTimecode.trim()))}
											/>
										</label>
									</div>
								{/if}
							</div>
						{/if}
					</div>
				</div>
			</div>

			<div class="border-t border-white/10 bg-black/15 px-5 py-4 sm:px-6">
				<div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div class="min-h-5 text-xs leading-5 text-muted-foreground">
						{#if kind === 'broken_link'}
							Broken-link reports can be submitted without extra fields.
						{:else if !canSubmit}
							Make at least one change or fill in a field before submitting.
						{:else}
							Suggestions are reviewed manually before anything changes in the catalog.
						{/if}
					</div>
					<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
						<button
							type="button"
							class={`${actionButtonBase} border border-white/15 bg-white/[0.05] text-white/72 hover:border-white/25 hover:bg-white/[0.09] hover:text-white`}
							onclick={() => (open = false)}
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={isSubmitting || !canSubmit}
							class={`${actionButtonBase} bg-primary text-primary-foreground shadow-[0_16px_40px_-22px_rgba(229,9,20,0.85)] hover:bg-primary/90 disabled:bg-primary/70`}
							onclick={submit}
						>
							{isSubmitting ? 'Sending…' : 'Submit'}
						</button>
					</div>
				</div>
			</div>
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>
