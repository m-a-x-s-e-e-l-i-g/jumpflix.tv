<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount, untrack } from 'svelte';
	import { toast } from 'svelte-sonner';
	import { normalizeParkourSpotId } from '$lib/utils';

	import 'leaflet/dist/leaflet.css';
	import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
	import markerIcon from 'leaflet/dist/images/marker-icon.png';
	import markerShadow from 'leaflet/dist/images/marker-shadow.png';

	type SpotCandidate = {
		id: string;
		name: string;
		lat: number;
		lng: number;
		raw: any;
	};

	type MediaType = 'movie' | 'series';

	let {
		spotId = $bindable(''),
		mediaId = null,
		mediaType = null,
		playbackKey = null
	} = $props<{
		spotId?: string;
		mediaId?: number | null;
		mediaType?: MediaType | null;
		playbackKey?: string | null;
	}>();

	let query = $state('');
	let results = $state<SpotCandidate[]>([]);
	let videoSpots = $state<SpotCandidate[]>([]);
	let selected = $state<SpotCandidate | null>(null);
	let isLoading = $state(false);

	let mapContainer: HTMLDivElement | null = null;
	let leaflet: typeof import('leaflet') | null = null;
	let map: import('leaflet').Map | null = null;
	let markersLayer: import('leaflet').LayerGroup | null = null;

	let lastSearchAbort: AbortController | null = null;
	let videoSpotsAbort: AbortController | null = null;
	let queryTimer: ReturnType<typeof setTimeout> | null = null;
	let moveTimer: ReturnType<typeof setTimeout> | null = null;
	let videoSpotsRequestKey = '';
	let didFitVideoSpotsKey = '';
	let movingMapProgrammatically = false;

	function normalizeCandidate(raw: any): SpotCandidate | null {
		const id = String(raw?.id ?? raw?.spotId ?? '').trim();
		if (!id) return null;
		const name = String(raw?.name ?? raw?.title ?? raw?.displayName ?? id).trim() || id;

		const latRaw = raw?.lat ?? raw?.latitude ?? raw?.location?.lat ?? raw?.location?.latitude;
		const lngRaw =
			raw?.lng ?? raw?.lon ?? raw?.longitude ?? raw?.location?.lng ?? raw?.location?.longitude;
		const lat = typeof latRaw === 'number' ? latRaw : Number(String(latRaw ?? ''));
		const lng = typeof lngRaw === 'number' ? lngRaw : Number(String(lngRaw ?? ''));
		if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

		return { id, name, lat, lng, raw };
	}

	function extractCandidates(payload: any): SpotCandidate[] {
		const arr =
			(Array.isArray(payload) && payload) ||
			(Array.isArray(payload?.spots) && payload.spots) ||
			(Array.isArray(payload?.data) && payload.data) ||
			(Array.isArray(payload?.results) && payload.results) ||
			(Array.isArray(payload?.items) && payload.items) ||
			[];

		const out: SpotCandidate[] = [];
		for (const item of arr) {
			const c = normalizeCandidate(item);
			if (c) out.push(c);
		}
		return out;
	}

	function extractVideoSpots(payload: any): SpotCandidate[] {
		const chapters = Array.isArray(payload?.chapters) ? payload.chapters : [];
		const seen = new Set<string>();
		const out: SpotCandidate[] = [];

		for (const chapter of chapters) {
			const candidate = normalizeCandidate(chapter?.spot ?? chapter);
			if (!candidate || seen.has(candidate.id)) continue;
			seen.add(candidate.id);
			out.push(candidate);
		}

		return out;
	}

	function getMediaRequestKey(): string {
		if (!mediaId || !mediaType || (mediaType === 'series' && !playbackKey?.trim())) return '';
		return `${mediaId}:${mediaType}:${playbackKey?.trim() ?? ''}`;
	}

	function fitToCandidates(candidates: SpotCandidate[], maxZoom = 14) {
		if (!map || !leaflet || candidates.length === 0) return;

		movingMapProgrammatically = true;
		try {
			if (candidates.length === 1) {
				map.setView([candidates[0].lat, candidates[0].lng], maxZoom, { animate: false });
				return;
			}

			const bounds = leaflet.latLngBounds(
				candidates.map((candidate) => [candidate.lat, candidate.lng] as [number, number])
			);
			if (bounds.isValid()) map.fitBounds(bounds, { padding: [24, 24], maxZoom, animate: false });
		} finally {
			movingMapProgrammatically = false;
		}
	}

	function panToCandidate(candidate: SpotCandidate) {
		if (!map) return;
		movingMapProgrammatically = true;
		try {
			map.panTo([candidate.lat, candidate.lng], { animate: false });
		} finally {
			movingMapProgrammatically = false;
		}
	}

	function fitVideoSpotsIfNeeded() {
		const requestKey = getMediaRequestKey();
		if (!map || !requestKey || !videoSpots.length || didFitVideoSpotsKey === requestKey) return;
		fitToCandidates(videoSpots);
		didFitVideoSpotsKey = requestKey;
	}

	function clearMarkers() {
		if (!markersLayer) return;
		markersLayer.clearLayers();
	}

	function renderMarkers(candidates: SpotCandidate[]) {
		if (!leaflet || !map || !markersLayer) return;
		clearMarkers();
		for (const c of candidates) {
			const marker = leaflet.marker([c.lat, c.lng]);
			marker.on('click', () => {
				selected = c;
				spotId = c.id;
			});
			marker.addTo(markersLayer);
		}
	}

	async function loadVideoSpots(requestKey: string) {
		if (!browser) return;

		if (!requestKey) {
			videoSpotsAbort?.abort();
			videoSpots = [];
			videoSpotsRequestKey = '';
			didFitVideoSpotsKey = '';
			return;
		}
		if (videoSpotsRequestKey === requestKey) return;

		videoSpotsAbort?.abort();
		const abort = new AbortController();
		videoSpotsAbort = abort;
		videoSpotsRequestKey = requestKey;
		videoSpots = [];
		didFitVideoSpotsKey = '';
		if (!query.trim()) {
			results = [];
			renderMarkers([]);
		}

		try {
			const url = new URL('/api/spot-chapters', window.location.origin);
			url.searchParams.set('mediaId', String(mediaId));
			url.searchParams.set('mediaType', mediaType as MediaType);
			if (playbackKey?.trim()) url.searchParams.set('playbackKey', playbackKey.trim());

			const res = await fetch(url.toString(), { signal: abort.signal, cache: 'no-store' });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Failed to load video spots');

			const nextVideoSpots = extractVideoSpots(data);
			if (abort.signal.aborted) return;

			videoSpots = nextVideoSpots;
			if (!query.trim()) {
				if (moveTimer) clearTimeout(moveTimer);
				lastSearchAbort?.abort();
				results = nextVideoSpots;
				renderMarkers(nextVideoSpots);
				fitVideoSpotsIfNeeded();
				if (nextVideoSpots.length === 0 && map) queueBoundsSearch();
			}
		} catch (err: any) {
			if (!abort.signal.aborted) toast.error(err?.message || 'Failed to load video spots');
		}
	}

	async function runSearch(params: Record<string, string>) {
		if (!browser) return;
		lastSearchAbort?.abort();
		const abort = new AbortController();
		lastSearchAbort = abort;

		isLoading = true;
		try {
			const url = new URL('/api/parkour-spot/spots', window.location.origin);
			for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

			const res = await fetch(url.toString(), { signal: abort.signal });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Failed to search spots');

			results = extractCandidates(data);
			renderMarkers(results);
		} catch (err: any) {
			if (abort.signal.aborted) return;
			toast.error(err?.message || 'Failed to search spots');
		} finally {
			if (lastSearchAbort === abort) isLoading = false;
		}
	}

	function queueQuerySearch() {
		if (queryTimer) clearTimeout(queryTimer);
		if (moveTimer) clearTimeout(moveTimer);
		lastSearchAbort?.abort();
		queryTimer = setTimeout(() => {
			const q = query.trim();
			if (!q) {
				const mediaKey = getMediaRequestKey();
				if (mediaKey && videoSpotsRequestKey === mediaKey) {
					lastSearchAbort?.abort();
					results = videoSpots;
					renderMarkers(videoSpots);
					fitVideoSpotsIfNeeded();
					return;
				}
				if (map) queueBoundsSearch();
				return;
			}
			void runSearch({ q });
		}, 350);
	}

	function queueBoundsSearch() {
		if (!map) return;
		if (moveTimer) clearTimeout(moveTimer);
		moveTimer = setTimeout(() => {
			if (!map || query.trim()) return;
			const bounds = map.getBounds();
			const sw = bounds.getSouthWest();
			const ne = bounds.getNorthEast();
			void runSearch({
				minLat: String(sw.lat),
				maxLat: String(ne.lat),
				minLng: String(sw.lng),
				maxLng: String(ne.lng)
			});
		}, 500);
	}

	async function hydrateSelectedById(id: string) {
		const trimmed = id.trim();
		if (!trimmed || !browser) return;
		try {
			const res = await fetch(`/api/parkour-spot/spots/${encodeURIComponent(trimmed)}`);
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data?.error || 'Failed to fetch spot');
			const c = normalizeCandidate(data);
			if (c) {
				selected = c;
				spotId = c.id;
				results = [c];
				renderMarkers([c]);
			}
		} catch (err: any) {
			toast.error(err?.message || 'Failed to fetch spot');
		}
	}

	onMount(() => {
		if (!browser) return;
		if (!mapContainer) return;
		let disposed = false;

		void (async () => {
			leaflet = await import('leaflet');
			if (disposed || !leaflet || !mapContainer) return;

			// Fix missing marker icons when bundling with Vite.
			delete (leaflet.Icon.Default.prototype as any)._getIconUrl;
			leaflet.Icon.Default.mergeOptions({
				iconRetinaUrl: markerIcon2x,
				iconUrl: markerIcon,
				shadowUrl: markerShadow
			});

			map = leaflet.map(mapContainer, {
				center: [52.1, 5.1],
				zoom: 7,
				scrollWheelZoom: true
			});
			markersLayer = leaflet.layerGroup().addTo(map);

			leaflet
				.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution: '&copy; OpenStreetMap contributors'
				})
				.addTo(map);

			map.on('moveend', () => {
				if (movingMapProgrammatically || query.trim()) return;
				queueBoundsSearch();
			});

			if (getMediaRequestKey()) {
				renderMarkers(results);
				fitVideoSpotsIfNeeded();
			} else {
				queueBoundsSearch();
			}
		})();

		return () => {
			disposed = true;
			map?.remove();
			map = null;
			leaflet = null;
			markersLayer = null;
		};
	});

	onDestroy(() => {
		lastSearchAbort?.abort();
		videoSpotsAbort?.abort();
		if (queryTimer) clearTimeout(queryTimer);
		if (moveTimer) clearTimeout(moveTimer);
	});

	$effect(() => {
		const requestKey = getMediaRequestKey();
		untrack(() => void loadVideoSpots(requestKey));
	});

	$effect(() => {
		const id = normalizeParkourSpotId(spotId) ?? spotId.trim();
		if (!id) {
			selected = null;
			return;
		}
		if (spotId.trim() !== id) {
			spotId = id;
			return;
		}
		if (selected?.id === id) return;
		void hydrateSelectedById(id);
	});
</script>

<div class="space-y-3">
	<div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
		<label class="space-y-1">
			<span class="text-xs text-white/70">Search</span>
			<input
				type="search"
				bind:value={query}
				oninput={() => queueQuerySearch()}
				placeholder="Search spot, city or country…"
				class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-white/30 focus:outline-none"
			/>
		</label>

		<label class="space-y-1">
			<span class="text-xs text-white/70">Selected spot id</span>
			<input
				type="text"
				bind:value={spotId}
				placeholder="ID, parkour.spot URL, or pasted share text"
				class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:ring-2 focus:ring-white/30 focus:outline-none"
			/>
		</label>
	</div>

	<div class="text-[11px] text-white/50">
		Search by spot, city or country, or paste a direct Parkour·Spot id or URL. The map initially
		shows the spots in this video.
	</div>

	<div class="overflow-hidden rounded-xl border border-white/10 bg-black/30">
		<div bind:this={mapContainer} class="h-[260px] w-full"></div>
	</div>

	<div class="flex items-start justify-between gap-3">
		<div class="min-w-0">
			{#if selected}
				<div class="truncate text-sm font-medium text-white">{selected.name}</div>
				<div class="text-xs text-white/60">{selected.id}</div>
			{:else}
				<div class="text-xs text-white/60">Click a marker to select a spot.</div>
			{/if}
		</div>
		{#if isLoading}
			<div class="text-xs text-white/60">Loading…</div>
		{/if}
	</div>

	{#if results.length}
		<div class="max-h-40 overflow-y-auto rounded-xl border border-white/10 bg-white/5">
			{#each results as r (r.id)}
				<button
					type="button"
					class="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
					onclick={() => {
						selected = r;
						spotId = r.id;
						panToCandidate(r);
					}}
				>
					<span class="min-w-0 truncate">{r.name}</span>
					<span class="shrink-0 text-xs text-white/50">{r.id}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
