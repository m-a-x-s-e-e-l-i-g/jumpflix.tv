<script lang="ts">
	import { browser } from '$app/environment';
	import { onDestroy, onMount } from 'svelte';
	import { toast } from 'svelte-sonner';

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

	let { spotId = $bindable('') } = $props<{ spotId?: string }>();

	let query = $state('');
	let results = $state<SpotCandidate[]>([]);
	let selected = $state<SpotCandidate | null>(null);
	let isLoading = $state(false);

	let mapContainer: HTMLDivElement | null = null;
	let leaflet: typeof import('leaflet') | null = null;
	let map: import('leaflet').Map | null = null;
	let markersLayer: import('leaflet').LayerGroup | null = null;

	let lastSearchAbort: AbortController | null = null;
	let queryTimer: ReturnType<typeof setTimeout> | null = null;
	let moveTimer: ReturnType<typeof setTimeout> | null = null;

	function normalizeCandidate(raw: any): SpotCandidate | null {
		const id = String(raw?.id ?? raw?.spotId ?? '').trim();
		if (!id) return null;
		const name = String(raw?.name ?? raw?.title ?? raw?.displayName ?? id).trim() || id;

		const latRaw = raw?.lat ?? raw?.latitude ?? raw?.location?.lat ?? raw?.location?.latitude;
		const lngRaw = raw?.lng ?? raw?.lon ?? raw?.longitude ?? raw?.location?.lng ?? raw?.location?.longitude;
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
			if (!abort.signal.aborted) isLoading = false;
		}
	}

	function queueQuerySearch() {
		if (queryTimer) clearTimeout(queryTimer);
		queryTimer = setTimeout(() => {
			const q = query.trim();
			if (!q) return;
			void runSearch({ q });
		}, 350);
	}

	function queueBoundsSearch() {
		if (!map) return;
		if (moveTimer) clearTimeout(moveTimer);
		moveTimer = setTimeout(() => {
			if (!map) return;
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
				results = [c];
				renderMarkers([c]);
				if (map) map.setView([c.lat, c.lng], Math.max(map.getZoom(), 14));
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
				if (query.trim()) return;
				queueBoundsSearch();
			});

			queueBoundsSearch();

			if (spotId.trim()) {
				await hydrateSelectedById(spotId);
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
		if (queryTimer) clearTimeout(queryTimer);
		if (moveTimer) clearTimeout(moveTimer);
	});

	$effect(() => {
		const id = spotId.trim();
		if (!id) {
			selected = null;
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
				placeholder="Search for a spot…"
				class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
			/>
		</label>

		<label class="space-y-1">
			<span class="text-xs text-white/70">Selected spot id</span>
			<input
				type="text"
				bind:value={spotId}
				placeholder="e.g. nuZdQoc4IXzw36ZIWvYs"
				class="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-white/30"
			/>
		</label>
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
						map?.setView([r.lat, r.lng], Math.max(map?.getZoom?.() ?? 12, 14));
					}}
				>
					<span class="min-w-0 truncate">{r.name}</span>
					<span class="shrink-0 text-xs text-white/50">{r.id}</span>
				</button>
			{/each}
		</div>
	{/if}
</div>
