<script lang="ts">
	import { browser } from '$app/environment';
	import { tick } from 'svelte';
	import XIcon from '@lucide/svelte/icons/x';
	import { Dialog } from 'bits-ui';
	import { toast } from 'svelte-sonner';
	import type { Snippet } from 'svelte';
	import type {
		ContentItem,
		Episode,
		FacetEnvironment,
		FacetFilmStyle,
		FacetMood,
		FacetMovement,
		FacetTheme,
		FacetType
	} from '$lib/tv/types';
	import { parseTimecodeToSeconds } from '$lib/utils/timecode';

	let {
		selected,
		selectedEpisode = null,
		selectedSeasonNumber = null,
		triggerClass = 'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-gray-700/50 text-gray-300 border border-gray-600/50 hover:bg-gray-700 transition',
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
		| 'broken_link'
		| 'subscription'
		| 'poster';

	let kind: Kind = $state('facets');

	let targetScope: 'media' | 'episode' = $state('media');
	let seasonNumber = $state<number | ''>('');
	let episodeNumber = $state<number | ''>('');

	// Structured patch payload (optional)
	let posterUrl = $state('');
	let description = $state('');
	let paid = $state(false);
	let provider = $state('');
	let externalUrl = $state('');

	let creators = $state<string[]>([]);
	let starring = $state<string[]>([]);
	let newCreator = $state('');
	let newStar = $state('');

	let setFacetType = $state<FacetType | ''>('');
	let setFacetEnvironment = $state<FacetEnvironment | ''>('');
	let setFacetFilmStyle = $state<FacetFilmStyle | ''>('');
	let setFacetTheme = $state<FacetTheme | ''>('');
	let facetMood = $state<FacetMood[]>([]);
	let facetMovement = $state<FacetMovement[]>([]);

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

	const FACET_TYPE_OPTIONS: FacetType[] = [
		'fiction',
		'documentary',
		'session',
		'event',
		'tutorial'
	];
	const FACET_MOOD_OPTIONS: FacetMood[] = ['energetic', 'chill', 'gritty', 'wholesome', 'artistic'];
	const FACET_MOVEMENT_OPTIONS: FacetMovement[] = [
		'flow',
		'big-sends',
		'style',
		'technical',
		'speed',
		'oldskool',
		'contemporary'
	];
	const FACET_ENVIRONMENT_OPTIONS: FacetEnvironment[] = [
		'street',
		'rooftops',
		'nature',
		'urbex',
		'gym'
	];
	const FACET_FILM_STYLE_OPTIONS: FacetFilmStyle[] = [
		'cinematic',
		'street-cinematic',
		'skateish',
		'raw',
		'pov',
		'longtakes',
		'music-driven',
		'montage',
		'slowmo',
		'gonzo',
		'vintage',
		'minimalist',
		'experimental'
	];
	const FACET_THEME_OPTIONS: FacetTheme[] = [
		'journey',
		'team',
		'event',
		'competition',
		'educational',
		'travel',
		'creative',
		'entertainment'
	];

	type InitialSnapshot = {
		posterUrl: string;
		description: string;
		paid: boolean;
		provider: string;
		externalUrl: string;
		creators: string[];
		starring: string[];
		facetType: string;
		facetEnvironment: string;
		facetFilmStyle: string;
		facetTheme: string;
		facetMood: string[];
		facetMovement: string[];
	};

	let initial = $state<InitialSnapshot | null>(null);
	let initialKey = $state<string | null>(null);

	function normString(value: unknown): string {
		return String(value ?? '').trim();
	}

	type TrackChoice = {
		spotifyUrl: string;
		startAtSeconds: number | null;
		startTimecode: string | null;
	};

	function trackChoiceFromTrack(t: any): TrackChoice {
		const spotifyUrl = normString(t?.song?.spotifyUrl);
		const startAtSecondsRaw =
			typeof t?.startAtSeconds === 'number' && Number.isFinite(t.startAtSeconds)
				? Math.max(0, Math.floor(t.startAtSeconds))
				: null;
		const startTimecode = normString(t?.startTimecode) || null;
		return { spotifyUrl, startAtSeconds: startAtSecondsRaw, startTimecode };
	}

	function trackChoiceValue(t: any): string {
		return JSON.stringify(trackChoiceFromTrack(t));
	}

	function safeParseTrackChoice(value: string): TrackChoice | null {
		const raw = normString(value);
		if (!raw) return null;
		try {
			const parsed = JSON.parse(raw);
			const spotifyUrl = normString(parsed?.spotifyUrl);
			if (!spotifyUrl) return null;
			const sas = parsed?.startAtSeconds;
			const startAtSeconds =
				typeof sas === 'number' && Number.isFinite(sas) ? Math.max(0, Math.floor(sas)) : null;
			const stc = normString(parsed?.startTimecode) || null;
			return { spotifyUrl, startAtSeconds, startTimecode: stc };
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

	function addCreatorToList() {
		const v = normString(newCreator);
		if (!v) return;
		creators = uniqueCasePreserving([...creators, v]);
		newCreator = '';
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
	}

	function removeStarFromList(value: string) {
		const key = normString(value).toLowerCase();
		starring = starring.filter((v) => normString(v).toLowerCase() !== key);
	}

	function editedInputClass(isEdited: boolean): string {
		return (
			'w-full rounded-lg border bg-white/10 px-3 py-2 text-sm text-white focus:outline-none ' +
			(isEdited
				? 'border-[#e50914] ring-2 ring-[#e50914]/40 focus:border-[#ff1a27]'
				: 'border-white/20 focus:border-[#e50914]')
		);
	}

	function editedSelectClass(isEdited: boolean): string {
		return (
			'w-full rounded-xl border bg-white/10 px-4 py-3 text-base text-foreground shadow-inner focus:outline-none focus:ring-2 focus:ring-[#e50914]/70 ' +
			(isEdited ? 'border-[#e50914]' : 'border-white/20 focus:border-[#e50914]')
		);
	}

	function editedBadge(isEdited: boolean) {
		return isEdited
			? 'inline-flex items-center rounded-full border border-[#e50914]/40 bg-[#e50914]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.2em] text-[#ff6b73]'
			: 'hidden';
	}

	$effect(() => {
		if (!open) {
			initial = null;
			initialKey = null;
			return;
		}
		if (!selected) return;

		// Snapshot & preload values only once per open+target.
		const key = `${selected.type}:${selected.id}`;
		if (initialKey !== key) {
			initialKey = key;

			posterUrl = normString(selected.thumbnail);
			description = normString(selected.description);
			paid = Boolean(selected.paid);
			provider = normString(selected.provider);
			externalUrl = normString(selected.externalUrl);

			creators = normList(selected.creators);
			starring = normList(selected.starring);
			newCreator = '';
			newStar = '';

			setFacetType = (selected.facets?.type ?? '') as FacetType | '';
			setFacetEnvironment = (selected.facets?.environment ?? '') as FacetEnvironment | '';
			setFacetFilmStyle = (selected.facets?.filmStyle ?? '') as FacetFilmStyle | '';
			setFacetTheme = (selected.facets?.theme ?? '') as FacetTheme | '';
			facetMood = (selected.facets?.mood ?? []) as FacetMood[];
			facetMovement = (selected.facets?.movement ?? []) as FacetMovement[];

			trackAction = 'add';
			trackSpotifyUrl = '';
			trackRemoveChoice = selected.tracks?.length ? trackChoiceValue(selected.tracks?.[0]) : '';
			trackEditChoice = selected.tracks?.length ? trackChoiceValue(selected.tracks?.[0]) : '';
			trackTitle = '';
			trackArtist = '';
			trackStartTimecode = '';
			trackStartAtSeconds = '';

			initial = {
				posterUrl: normString(selected.thumbnail),
				description: normString(selected.description),
				paid: Boolean(selected.paid),
				provider: normString(selected.provider),
				externalUrl: normString(selected.externalUrl),
				creators: normList(selected.creators),
				starring: normList(selected.starring),
				facetType: normString(selected.facets?.type),
				facetEnvironment: normString(selected.facets?.environment),
				facetFilmStyle: normString(selected.facets?.filmStyle),
				facetTheme: normString(selected.facets?.theme),
				facetMood: normList(selected.facets?.mood),
				facetMovement: normList(selected.facets?.movement)
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
				seasonNumber = sn;
				episodeNumber = Math.max(1, Math.floor(epPos));
			}
		} else {
			targetScope = 'media';
			seasonNumber = '';
			episodeNumber = '';
		}

		tick().catch(() => {});
	});

	let posterEdited: boolean = $derived(normString(posterUrl) !== normString(initial?.posterUrl));
	let descriptionEdited: boolean = $derived(
		normString(description) !== normString(initial?.description)
	);
	let paidEdited: boolean = $derived(Boolean(paid) !== Boolean(initial?.paid));
	let providerEdited: boolean = $derived(normString(provider) !== normString(initial?.provider));
	let externalUrlEdited: boolean = $derived(
		normString(externalUrl) !== normString(initial?.externalUrl)
	);
	let subscriptionEdited: boolean = $derived(paidEdited || providerEdited || externalUrlEdited);
	let creatorsEdited: boolean = $derived(!stringSetEqual(creators, initial?.creators ?? []));
	let starringEdited: boolean = $derived(!stringSetEqual(starring, initial?.starring ?? []));
	let facetTypeEdited: boolean = $derived(
		normString(setFacetType) !== normString(initial?.facetType)
	);
	let facetEnvironmentEdited: boolean = $derived(
		normString(setFacetEnvironment) !== normString(initial?.facetEnvironment)
	);
	let facetFilmStyleEdited: boolean = $derived(
		normString(setFacetFilmStyle) !== normString(initial?.facetFilmStyle)
	);
	let facetThemeEdited: boolean = $derived(
		normString(setFacetTheme) !== normString(initial?.facetTheme)
	);
	let facetMoodEdited: boolean = $derived(
		!stringSetEqual(facetMood as unknown as string[], initial?.facetMood ?? [])
	);
	let facetMovementEdited: boolean = $derived(
		!stringSetEqual(facetMovement as unknown as string[], initial?.facetMovement ?? [])
	);

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

		if (
			kind === 'poster' &&
			(posterEdited || !initial) &&
			(posterEdited || normString(posterUrl))
		) {
			payload.set = { ...(payload.set ?? {}), thumbnail: normString(posterUrl) || null };
		}

		if (kind === 'subscription' && subscriptionEdited) {
			const set: any = {};
			if (Boolean(paid) !== Boolean(initial?.paid)) set.paid = Boolean(paid);
			if (normString(provider) !== normString(initial?.provider))
				set.provider = normString(provider) || null;
			if (normString(externalUrl) !== normString(initial?.externalUrl))
				set.external_url = normString(externalUrl) || null;
			if (Object.keys(set).length) payload.set = { ...(payload.set ?? {}), ...set };
		}

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

			const baseMood = initial?.facetMood ?? [];
			const baseMovement = initial?.facetMovement ?? [];

			const addMoodList = diffAdd(facetMood as unknown as string[], baseMood);
			const removeMoodList = diffRemove(baseMood, facetMood as unknown as string[]);
			const addMovementList = diffAdd(facetMovement as unknown as string[], baseMovement);
			const removeMovementList = diffRemove(baseMovement, facetMovement as unknown as string[]);

			if (addMoodList.length) add.facet_mood = addMoodList;
			if (removeMoodList.length) remove.facet_mood = removeMoodList;
			if (addMovementList.length) add.facet_movement = addMovementList;
			if (removeMovementList.length) remove.facet_movement = removeMovementList;

			if (facetTypeEdited) set.facet_type = normString(setFacetType) || null;
			if (facetEnvironmentEdited) set.facet_environment = normString(setFacetEnvironment) || null;
			if (facetFilmStyleEdited) set.facet_film_style = normString(setFacetFilmStyle) || null;
			if (facetThemeEdited) set.facet_theme = normString(setFacetTheme) || null;

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

	async function submit() {
		if (!browser) return;
		if (!selected) return;

		isSubmitting = true;
		try {
			const body = {
				mediaId: Number(selected.id),
				mediaType: selected.type,
				kind,
				targetScope,
				seasonNumber: targetScope === 'episode' ? seasonNumber : undefined,
				episodeNumber: targetScope === 'episode' ? episodeNumber : undefined,
				payload: buildPayload()
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
		'absolute right-6 top-6 inline-flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/70 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-black/20';
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
			class="fixed inset-0 z-40 bg-black/78 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:animate-in data-[state=open]:fade-in-0"
		/>
		<Dialog.Content
			class="fixed top-1/2 left-1/2 z-50 max-h-[calc(100dvh-2rem)] w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border border-white/10 bg-background p-0 text-foreground shadow-[0_40px_80px_-30px_rgba(0,0,0,0.75)] focus:outline-none data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
			aria-describedby="content-suggestion-description"
		>
			<button type="button" class={closeButtonClass} onclick={() => (open = false)}>
				<XIcon class="size-4" />
				<span class="sr-only">Close</span>
			</button>

			<div class="max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain px-6 py-7">
				<div class="flex flex-col gap-6">
					<header class="space-y-2">
						<Dialog.Title class="text-xl font-semibold text-foreground"
							>Suggest a change</Dialog.Title
						>
						<p id="content-suggestion-description" class="text-sm text-muted-foreground">
							Suggest edits (facets/people/tracks), report broken links, or flag new
							episodes/seasons.
						</p>
						{#if selected}
							<div class="text-xs text-white/70">
								Target: <span class="text-white">{selected.title}</span>
							</div>
						{/if}
					</header>

					<div class="grid grid-cols-1 gap-4">
						<label class="space-y-2">
							<span class="text-sm font-medium text-white/80">Category</span>
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
								<option value="subscription" class="bg-background text-foreground"
									>Subscription / provider change</option
								>
								<option value="poster" class="bg-background text-foreground"
									>Different poster</option
								>
							</select>
						</label>

						{#if selected?.type === 'series'}
							<div class="rounded-xl border border-white/10 bg-white/5 p-4">
								<div class="mb-2 text-sm font-medium text-white/80">Applies to</div>
								<div class="flex flex-wrap gap-3 text-sm text-white/80">
									<label class="inline-flex items-center gap-2">
										<input type="radio" bind:group={targetScope} value="media" />
										Series overall
									</label>
									<label class="inline-flex items-center gap-2">
										<input type="radio" bind:group={targetScope} value="episode" />
										Specific episode
									</label>
								</div>

								{#if targetScope === 'episode'}
									<div class="mt-3 grid grid-cols-2 gap-3">
										<label class="space-y-1">
											<span class="text-xs text-white/70">Season #</span>
											<input
												type="number"
												min="1"
												bind:value={seasonNumber}
												class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
											/>
										</label>
										<label class="space-y-1">
											<span class="text-xs text-white/70">Episode #</span>
											<input
												type="number"
												min="1"
												bind:value={episodeNumber}
												class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
											/>
										</label>
									</div>
								{/if}
							</div>
						{/if}

						{#if kind === 'poster'}
							<label class="space-y-2">
								<span class="inline-flex items-center gap-2 text-sm font-medium text-white/80">
									Poster URL
									<span class={editedBadge(posterEdited)}>Edited</span>
								</span>
								<input
									type="url"
									bind:value={posterUrl}
									placeholder="https://..."
									class={`w-full rounded-xl border bg-white/10 px-4 py-3 text-base text-white shadow-inner placeholder:text-white/50 focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none ${
										posterEdited ? 'border-[#e50914]' : 'border-white/20 focus:border-[#e50914]'
									}`}
								/>
								{#if initial?.posterUrl}
									<div class="text-xs text-white/60">
										Current: <span class="text-white/80">{initial.posterUrl}</span>
									</div>
								{/if}
							</label>
						{/if}

						{#if kind === 'subscription'}
							<div class="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
								<label class="inline-flex items-center gap-2 text-sm text-white/80">
									<input type="checkbox" bind:checked={paid} />
									Requires subscription / paid
									<span class={editedBadge(paidEdited)}>Edited</span>
								</label>
								<label class="space-y-1">
									<span class="inline-flex items-center gap-2 text-xs text-white/70">
										Provider
										<span class={editedBadge(providerEdited)}>Edited</span>
									</span>
									<input bind:value={provider} class={editedInputClass(providerEdited)} />
								</label>
								<label class="space-y-1">
									<span class="inline-flex items-center gap-2 text-xs text-white/70">
										External URL
										<span class={editedBadge(externalUrlEdited)}>Edited</span>
									</span>
									<input bind:value={externalUrl} class={editedInputClass(externalUrlEdited)} />
								</label>
							</div>
						{/if}

						{#if kind === 'description'}
							<div class="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
								<label class="space-y-2">
									<span class="inline-flex items-center gap-2 text-sm font-medium text-white/80">
										Description
										<span class={editedBadge(descriptionEdited)}>Edited</span>
									</span>
									<textarea
										rows="6"
										bind:value={description}
										placeholder="Suggest a better description…"
										class={`w-full rounded-xl border bg-white/10 px-4 py-3 text-sm text-white shadow-inner placeholder:text-white/50 focus:ring-2 focus:ring-[#e50914]/70 focus:outline-none ${
											descriptionEdited
												? 'border-[#e50914]'
												: 'border-white/20 focus:border-[#e50914]'
										}`}
									></textarea>
									{#if initial?.description}
										<div class="text-xs text-white/60">
											Current: <span class="text-white/80">{initial.description}</span>
										</div>
									{/if}
								</label>
							</div>
						{/if}

						{#if kind === 'people'}
							<div class="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
								<div class="space-y-2">
									<div class="inline-flex items-center gap-2 text-sm font-medium text-white/80">
										Creators
										<span class={editedBadge(creatorsEdited)}>Edited</span>
									</div>
									<div class="flex gap-2">
										<input
											bind:value={newCreator}
											placeholder="Add creator name"
											class={editedInputClass(false)}
											onkeydown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault();
													addCreatorToList();
												}
											}}
										/>
										<button
											type="button"
											class="shrink-0 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/80 hover:border-white/40"
											onclick={addCreatorToList}
										>
											Add
										</button>
									</div>
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
															: 'border-[#e50914]/30 bg-[#e50914]/10 text-[#ff9aa0]'
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
									<div class="inline-flex items-center gap-2 text-sm font-medium text-white/80">
										Starring
										<span class={editedBadge(starringEdited)}>Edited</span>
									</div>
									<div class="flex gap-2">
										<input
											bind:value={newStar}
											placeholder="Add starring name"
											class={editedInputClass(false)}
											onkeydown={(e) => {
												if (e.key === 'Enter') {
													e.preventDefault();
													addStarToList();
												}
											}}
										/>
										<button
											type="button"
											class="shrink-0 rounded-lg border border-white/20 bg-white/5 px-3 py-2 text-sm text-white/80 hover:border-white/40"
											onclick={addStarToList}
										>
											Add
										</button>
									</div>
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
															: 'border-[#e50914]/30 bg-[#e50914]/10 text-[#ff9aa0]'
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
							<div class="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<label class="space-y-1">
										<span class="inline-flex items-center gap-2 text-xs text-white/70">
											Facet type
											<span class={editedBadge(facetTypeEdited)}>Edited</span>
										</span>
										<select bind:value={setFacetType} class={editedSelectClass(facetTypeEdited)}>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_TYPE_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{opt}</option>
											{/each}
										</select>
									</label>
									<label class="space-y-1">
										<span class="inline-flex items-center gap-2 text-xs text-white/70">
											Environment
											<span class={editedBadge(facetEnvironmentEdited)}>Edited</span>
										</span>
										<select
											bind:value={setFacetEnvironment}
											class={editedSelectClass(facetEnvironmentEdited)}
										>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_ENVIRONMENT_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{opt}</option>
											{/each}
										</select>
									</label>
									<label class="space-y-1">
										<span class="inline-flex items-center gap-2 text-xs text-white/70">
											Film style
											<span class={editedBadge(facetFilmStyleEdited)}>Edited</span>
										</span>
										<select
											bind:value={setFacetFilmStyle}
											class={editedSelectClass(facetFilmStyleEdited)}
										>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_FILM_STYLE_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{opt}</option>
											{/each}
										</select>
									</label>
									<label class="space-y-1">
										<span class="inline-flex items-center gap-2 text-xs text-white/70">
											Theme
											<span class={editedBadge(facetThemeEdited)}>Edited</span>
										</span>
										<select bind:value={setFacetTheme} class={editedSelectClass(facetThemeEdited)}>
											<option value="" class="bg-background text-foreground">(none)</option>
											{#each FACET_THEME_OPTIONS as opt (opt)}
												<option value={opt} class="bg-background text-foreground">{opt}</option>
											{/each}
										</select>
									</label>
								</div>

								<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
									<div class="space-y-2">
										<div class="inline-flex items-center gap-2 text-xs text-white/70">
											Mood
											<span class={editedBadge(facetMoodEdited)}>Edited</span>
										</div>
										<div
											class={`rounded-lg border p-3 ${facetMoodEdited ? 'border-[#e50914]/40 bg-[#e50914]/5' : 'border-white/10 bg-white/5'}`}
										>
											<div class="flex flex-wrap gap-3 text-sm text-white/80">
												{#each FACET_MOOD_OPTIONS as opt (opt)}
													<label class="inline-flex items-center gap-2">
														<input type="checkbox" bind:group={facetMood} value={opt} />
														{opt}
													</label>
												{/each}
											</div>
										</div>
									</div>
									<div class="space-y-2">
										<div class="inline-flex items-center gap-2 text-xs text-white/70">
											Movement
											<span class={editedBadge(facetMovementEdited)}>Edited</span>
										</div>
										<div
											class={`rounded-lg border p-3 ${facetMovementEdited ? 'border-[#e50914]/40 bg-[#e50914]/5' : 'border-white/10 bg-white/5'}`}
										>
											<div class="flex flex-wrap gap-3 text-sm text-white/80">
												{#each FACET_MOVEMENT_OPTIONS as opt (opt)}
													<label class="inline-flex items-center gap-2">
														<input type="checkbox" bind:group={facetMovement} value={opt} />
														{opt}
													</label>
												{/each}
											</div>
										</div>
									</div>
								</div>
							</div>
						{/if}

						{#if kind === 'new_season'}
							<div class="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
								<label class="space-y-1">
									<span class="text-xs text-white/70">Season #</span>
									<input
										type="number"
										min="1"
										bind:value={seasonNumber}
										class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
									/>
								</label>
								<label class="space-y-1">
									<span class="text-xs text-white/70">YouTube playlist id (optional)</span>
									<input
										bind:value={newSeasonPlaylistId}
										class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
									/>
								</label>
								<label class="space-y-1">
									<span class="text-xs text-white/70">Custom season name (optional)</span>
									<input
										bind:value={newSeasonCustomName}
										class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
									/>
								</label>
							</div>
						{/if}

						{#if kind === 'new_episode'}
							<div class="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
								<div class="grid grid-cols-2 gap-3">
									<label class="space-y-1">
										<span class="text-xs text-white/70">Season #</span>
										<input
											type="number"
											min="1"
											bind:value={seasonNumber}
											class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
										/>
									</label>
									<label class="space-y-1">
										<span class="text-xs text-white/70">Episode #</span>
										<input
											type="number"
											min="1"
											bind:value={episodeNumber}
											class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
										/>
									</label>
								</div>
								<label class="space-y-1">
									<span class="text-xs text-white/70">Video ID (YouTube/Vimeo) (optional)</span>
									<input
										bind:value={newEpisodeVideoId}
										class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
									/>
								</label>
								<label class="space-y-1">
									<span class="text-xs text-white/70">Episode title (optional)</span>
									<input
										bind:value={newEpisodeTitle}
										class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
									/>
								</label>
								<label class="space-y-1">
									<span class="text-xs text-white/70">Thumbnail URL (optional)</span>
									<input
										bind:value={newEpisodeThumbnail}
										class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:border-[#e50914] focus:outline-none"
									/>
								</label>
							</div>
						{/if}

						{#if kind === 'tracks'}
							<div class="space-y-3 rounded-xl border border-white/10 bg-white/5 p-4">
								<div class="flex flex-wrap gap-3 text-sm text-white/80">
									<label class="inline-flex items-center gap-2">
										<input type="radio" bind:group={trackAction} value="add" />
										Add track
									</label>
									<label class="inline-flex items-center gap-2">
										<input type="radio" bind:group={trackAction} value="edit" />
										Edit timestamp
									</label>
									<label class="inline-flex items-center gap-2">
										<input type="radio" bind:group={trackAction} value="remove" />
										Remove track
									</label>
								</div>
								{#if trackAction === 'remove'}
									{#if selected?.tracks?.length}
										<div class="space-y-2">
											<div class="text-xs text-white/70">Select track to remove</div>
											<div
												class="max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/20"
											>
												{#each selected.tracks as t (trackChoiceValue(t))}
													<label
														class="flex items-start gap-3 border-b border-white/5 px-3 py-2 last:border-b-0 hover:bg-white/5"
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
											<div class="text-xs text-white/60">
												Selected: <span class="text-white/80">{removeSelectedLabel}</span>
											</div>
										</div>
									{:else}
										<div class="text-xs text-white/60">
											No tracks found for this video. You can still paste a Spotify URL below.
										</div>
										<label class="space-y-1">
											<span class="text-xs text-white/70">Spotify track URL</span>
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
											<div class="text-xs text-white/70">Select track to edit</div>
											<div
												class="max-h-56 overflow-auto rounded-lg border border-white/10 bg-black/20"
											>
												{#each selected.tracks as t (trackChoiceValue(t))}
													<label
														class="flex items-start gap-3 border-b border-white/5 px-3 py-2 last:border-b-0 hover:bg-white/5"
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
											<div class="text-xs text-white/60">
												Selected: <span class="text-white/80">{editSelectedLabel}</span>
											</div>
										</div>

										<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
											<label class="space-y-1">
												<span class="text-xs text-white/70">Start timecode (mm:ss)</span>
												<input
													bind:value={trackStartTimecode}
													class={editedInputClass(Boolean(trackStartTimecode.trim()))}
												/>
											</label>
										</div>
									{:else}
										<div class="text-xs text-white/60">No tracks found for this video.</div>
									{/if}
								{:else}
									<label class="space-y-1">
										<span class="text-xs text-white/70">Spotify track URL</span>
										<input
											bind:value={trackSpotifyUrl}
											placeholder="https://open.spotify.com/track/..."
											class={editedInputClass(Boolean(trackSpotifyUrl.trim()))}
										/>
									</label>
								{/if}
								{#if trackAction === 'add'}
									<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
										<label class="space-y-1">
											<span class="text-xs text-white/70">Artist</span>
											<input
												bind:value={trackArtist}
												class={editedInputClass(Boolean(trackArtist.trim()))}
											/>
										</label>
										<label class="space-y-1">
											<span class="text-xs text-white/70">Title</span>
											<input
												bind:value={trackTitle}
												class={editedInputClass(Boolean(trackTitle.trim()))}
											/>
										</label>
										<label class="space-y-1">
											<span class="text-xs text-white/70">Start timecode (mm:ss)</span>
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

					<div class="mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end sm:gap-3">
						<button
							type="button"
							class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border border-white/20 bg-white/5 px-5 py-2 text-sm font-medium tracking-[0.2em] text-white/70 uppercase transition hover:border-white/40 hover:text-white"
							onclick={() => (open = false)}
						>
							Cancel
						</button>
						<button
							type="button"
							disabled={isSubmitting || !selected}
							class="inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-[#e50914] px-5 py-2 text-sm font-medium tracking-[0.2em] text-white uppercase shadow-[0_12px_32px_-18px_rgba(229,9,20,0.9)] transition hover:bg-[#ff1a27] disabled:bg-[#e50914]/80 disabled:opacity-70"
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
