<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { getParkourSpotUrl } from '$lib/utils';
	import type { PageData } from './$types';

	import 'leaflet/dist/leaflet.css';

	type MapVideo = {
		id: number;
		type: 'movie' | 'series';
		slug: string;
		title: string;
		href: string;
		thumbnail: string | null;
		year: string | null;
		duration: string | null;
	};

	type MapSpotPoint = {
		spotId: string;
		name: string;
		lat: number;
		lng: number;
		videoCount: number;
		videos: MapVideo[];
	};

	type MapData = {
		points: MapSpotPoint[];
		totalSpotChapters: number;
		totalSpotsAvailable: number;
		hiddenSpotCount: number;
		totalVideosAvailable: number;
		maxVideosPerSpot: number;
	};

	const EMPTY_MAP_DATA: MapData = {
		points: [],
		totalSpotChapters: 0,
		totalSpotsAvailable: 0,
		hiddenSpotCount: 0,
		totalVideosAvailable: 0,
		maxVideosPerSpot: 16
	};

	type SpotCluster = {
		lat: number;
		lng: number;
		spots: MapSpotPoint[];
	};

	let { data } = $props<{ data: PageData }>();

	let query = $state('');
	let selectedSpotId = $state<string | null>(null);
	let selectedClusterSpotIds = $state<string[]>([]);
	let viewportSpotIds = $state<Set<string>>(new Set());
	let isMapReady = $state(false);

	let mapContainer: HTMLDivElement | null = null;
	let leaflet: typeof import('leaflet') | null = null;
	let map: import('leaflet').Map | null = null;
	let markersLayer: import('leaflet').LayerGroup | null = null;
	let hasFitBounds = false;

	const mapData = $derived((data?.mapData ?? EMPTY_MAP_DATA) as MapData);
	const loadError = $derived(
		typeof data?.loadError === 'string' && data.loadError.trim() ? data.loadError : null
	);

	const allPoints = $derived(Array.isArray(mapData.points) ? mapData.points : []);

	const pointById = $derived(
		new Map<string, MapSpotPoint>(
			allPoints.map((point: MapSpotPoint): [string, MapSpotPoint] => [point.spotId, point])
		)
	);

	const filteredPoints = $derived(
		(() => {
			const q = query.trim().toLowerCase();
			if (!q) return allPoints;

			return allPoints.filter((point: MapSpotPoint) => {
				if (point.name.toLowerCase().includes(q)) return true;
				if (point.spotId.toLowerCase().includes(q)) return true;
				return point.videos.some((video: MapVideo) => video.title.toLowerCase().includes(q));
			});
		})()
	);

	const selectedSpot = $derived(
		(selectedSpotId ? pointById.get(selectedSpotId) ?? null : null) as MapSpotPoint | null
	);

	const selectedClusterSpots = $derived(
		selectedClusterSpotIds
			.map((spotId: string) => pointById.get(spotId) ?? null)
			.filter((point: MapSpotPoint | null): point is MapSpotPoint => point !== null)
	);

	const viewportSpots = $derived(
		(() => {
			if (viewportSpotIds.size === 0) return [];
			return filteredPoints
				.filter((point: MapSpotPoint) => viewportSpotIds.has(point.spotId))
				.sort(
					(a: MapSpotPoint, b: MapSpotPoint) =>
						b.videoCount - a.videoCount || a.name.localeCompare(b.name)
				);
		})()
	);

	const resultSpots = $derived(
		(() => {
			if (selectedSpot) return [selectedSpot];
			if (selectedClusterSpots.length > 0) {
				return [...selectedClusterSpots].sort(
					(a: MapSpotPoint, b: MapSpotPoint) =>
						b.videoCount - a.videoCount || a.name.localeCompare(b.name)
				);
			}
			if (viewportSpots.length > 0) return viewportSpots;
			return [...filteredPoints]
				.sort(
					(a: MapSpotPoint, b: MapSpotPoint) =>
						b.videoCount - a.videoCount || a.name.localeCompare(b.name)
				)
				.slice(0, 70);
		})()
	);

	function clamp(n: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, n));
	}

	function inBounds(point: MapSpotPoint, bounds: import('leaflet').LatLngBounds): boolean {
		return bounds.contains([point.lat, point.lng]);
	}

	function clusterPoints(points: MapSpotPoint[], zoom: number): SpotCluster[] {
		if (!map || points.length === 0) return [];

		const cellSize = zoom >= 13 ? 46 : zoom >= 10 ? 64 : 84;
		const buckets = new Map<string, MapSpotPoint[]>();

		for (const point of points) {
			const projected = map.project([point.lat, point.lng], zoom);
			const xCell = Math.floor(projected.x / cellSize);
			const yCell = Math.floor(projected.y / cellSize);
			const key = `${xCell}:${yCell}`;

			if (!buckets.has(key)) buckets.set(key, []);
			buckets.get(key)?.push(point);
		}

		return Array.from(buckets.values()).map((bucket) => {
			const totalWeight = bucket.reduce((sum, point) => sum + Math.max(point.videoCount, 1), 0);
			const weightedLat =
				bucket.reduce((sum, point) => sum + point.lat * Math.max(point.videoCount, 1), 0) /
				totalWeight;
			const weightedLng =
				bucket.reduce((sum, point) => sum + point.lng * Math.max(point.videoCount, 1), 0) /
				totalWeight;

			return {
				lat: weightedLat,
				lng: weightedLng,
				spots: bucket
			};
		});
	}

	function buildPinIcon(cluster: SpotCluster, isSelected: boolean): import('leaflet').DivIcon {
		if (!leaflet) throw new Error('Leaflet not initialized');

		const isGrouped = cluster.spots.length > 1;
		const clusterVideoTotal = cluster.spots.reduce(
			(sum, spot) => sum + Math.max(spot.videoCount, 1),
			0
		);
		const primaryCount = isGrouped
			? cluster.spots.length
			: Math.max(cluster.spots[0]?.videoCount ?? 1, 1);
		const labelValue = String(primaryCount);
		const intensityClass =
			clusterVideoTotal >= 90 ? 'is-intense' : clusterVideoTotal >= 35 ? 'is-strong' : 'is-soft';

		const size = isGrouped
			? clamp(34 + Math.sqrt(cluster.spots.length) * 2.2 + Math.log10(clusterVideoTotal + 1) * 1.4, 34, 54)
			: clamp(26 + Math.sqrt(primaryCount) * 1.2, 26, 34);

		const groupedClass = isGrouped ? 'is-group' : 'is-single';
		const selectedClass = isSelected ? 'is-selected' : '';
		const markerContent = isGrouped
			? `<span class="video-map-pin-shell"><span class="video-map-pin-count">${labelValue}</span></span>`
			: `<span class="video-map-pin-shell">${primaryCount > 1 ? `<span class="video-map-pin-count">${labelValue}</span>` : ''}</span>`;

		return leaflet.divIcon({
			className: 'video-map-pin-host',
			html: `<div class="video-map-pin-wrap ${groupedClass} ${selectedClass} ${intensityClass}"><span class="video-map-pin-glow" aria-hidden="true"></span>${markerContent}</div>`,
			iconSize: [size, size],
			iconAnchor: [size / 2, size / 2]
		});
	}

	function fitToPoints(points: MapSpotPoint[], maxZoom = 11) {
		if (!map || !leaflet || points.length === 0) return;

		const bounds = leaflet.latLngBounds(
			points.map((point) => [point.lat, point.lng] as [number, number])
		);

		if (!bounds.isValid()) return;
		map.fitBounds(bounds, {
			padding: [28, 28],
			maxZoom
		});
	}

	function refreshMapMarkers(clearClusterSelection = false) {
		if (!map || !markersLayer || !leaflet) return;

		const filteredSpotIdSet = new Set(filteredPoints.map((point: MapSpotPoint) => point.spotId));
		if (selectedSpotId && !filteredSpotIdSet.has(selectedSpotId)) {
			selectedSpotId = null;
		}

		if (selectedClusterSpotIds.length > 0) {
			const nextClusterIds = selectedClusterSpotIds.filter((spotId) => filteredSpotIdSet.has(spotId));
			selectedClusterSpotIds = nextClusterIds;
		}

		if (clearClusterSelection && selectedClusterSpotIds.length > 0) {
			selectedClusterSpotIds = [];
		}

		const bounds = map.getBounds().pad(0.2);
		const visible = filteredPoints.filter((point: MapSpotPoint) => inBounds(point, bounds));
		viewportSpotIds = new Set(visible.map((point: MapSpotPoint) => point.spotId));

		const clusterSelectionSet = new Set(selectedClusterSpotIds);
		const clusters = clusterSelectionSet.size > 0
			? [
					...clusterPoints(
						visible.filter((point) => !clusterSelectionSet.has(point.spotId)),
						map.getZoom()
					),
					...visible
						.filter((point) => clusterSelectionSet.has(point.spotId))
						.map((point) => ({ lat: point.lat, lng: point.lng, spots: [point] }))
				]
			: clusterPoints(visible, map.getZoom());

		markersLayer.clearLayers();

		for (const cluster of clusters) {
			const containsSelectedSpot = cluster.spots.some((spot) => spot.spotId === selectedSpotId);
			const containsClusterSelection = cluster.spots.some((spot) =>
				clusterSelectionSet.has(spot.spotId)
			);

			const marker = leaflet.marker([cluster.lat, cluster.lng], {
				icon: buildPinIcon(cluster, containsSelectedSpot || containsClusterSelection),
				riseOnHover: true
			});

			marker.on('click', () => {
				if (cluster.spots.length === 1) {
					const spot = cluster.spots[0];
					selectedSpotId = spot.spotId;
					selectedClusterSpotIds = [];
					if (map && map.getZoom() < 11) {
						map.setView([spot.lat, spot.lng], 11, { animate: true });
					}
					refreshMapMarkers(false);
					return;
				}

				selectedSpotId = null;
				selectedClusterSpotIds = cluster.spots.map((spot) => spot.spotId);

				// Always zoom to the clicked cluster so its individual spots can become visible,
				// even when the map is already relatively close to the cluster.
				fitToPoints(cluster.spots, 19);

				refreshMapMarkers(false);
			});

			marker.addTo(markersLayer);
		}
	}

	function clearSelection() {
		selectedSpotId = null;
		selectedClusterSpotIds = [];
		if (map) refreshMapMarkers(false);
	}

	function focusSpot(spot: MapSpotPoint) {
		selectedSpotId = spot.spotId;
		selectedClusterSpotIds = [];
		if (map) {
			map.setView([spot.lat, spot.lng], Math.max(11, map.getZoom()), { animate: true });
			refreshMapMarkers(false);
		}
	}

	onMount(() => {
		if (!browser || !mapContainer) return;

		let disposed = false;

		void (async () => {
			leaflet = await import('leaflet');
			if (disposed || !leaflet || !mapContainer) return;

			const worldBounds: [[number, number], [number, number]] = [
				[-82, -180],
				[82, 180]
			];

			map = leaflet.map(mapContainer, {
				center: [25, 10],
				zoom: 3,
				minZoom: 2,
				scrollWheelZoom: true,
				preferCanvas: true,
				worldCopyJump: false,
				maxBounds: worldBounds,
				maxBoundsViscosity: 1,
				attributionControl: false
			});
			leaflet.control.attribution({ prefix: false, position: 'bottomleft' }).addTo(map);

			leaflet
				.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
					attribution:
						'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
					maxZoom: 19,
					noWrap: true,
					bounds: worldBounds,
					className: 'video-map-osm-tiles'
				})
				.addTo(map);

			markersLayer = leaflet.layerGroup().addTo(map);
			isMapReady = true;

			map.on('moveend zoomend', () => {
				refreshMapMarkers(false);
			});

			if (!hasFitBounds && filteredPoints.length > 0) {
				fitToPoints(filteredPoints, 6);
				hasFitBounds = true;
			}

			refreshMapMarkers(true);
		})();

		return () => {
			disposed = true;
			map?.remove();
			map = null;
			leaflet = null;
			markersLayer = null;
			viewportSpotIds = new Set();
			isMapReady = false;
		};
	});

	$effect(() => {
		filteredPoints;
		if (!map) return;

		if (!hasFitBounds && filteredPoints.length > 0) {
			fitToPoints(filteredPoints, 6);
			hasFitBounds = true;
		}

		refreshMapMarkers(true);
	});

	const shouldShowTruncationNotice = $derived((mapData.hiddenSpotCount ?? 0) > 0);
</script>

<svelte:head>
	<title>Video Map - Spot-linked Parkour Films and Series | JUMPFLIX</title>
	<meta
		name="description"
		content="Explore parkour films and series by location. Browse grouped map pins and open the videos linked to each spot."
	/>
	<link rel="canonical" href="https://www.jumpflix.tv/video-map" />
</svelte:head>

<div class="video-map-page">
	<section class="video-map-hero">
		<p class="video-map-kicker">Explore by location</p>
		<h1>Video Map</h1>
		<p class="video-map-intro">
			Find films and series through the spots they feature. Zoom into grouped pins and open videos directly
			from each location.
		</p>

		<div class="video-map-stats" role="list" aria-label="Map totals">
			<div role="listitem" class="video-map-stat">
				<span class="label">Mapped spots</span>
				<strong>{mapData.points.length}</strong>
			</div>
			<div role="listitem" class="video-map-stat">
				<span class="label">Unique videos</span>
				<strong>{mapData.totalVideosAvailable}</strong>
			</div>
			<div role="listitem" class="video-map-stat">
				<span class="label">Approved chapters</span>
				<strong>{mapData.totalSpotChapters}</strong>
			</div>
		</div>

		<div class="video-map-controls">
			<label class="video-map-search">
				<span class="sr-only">Search spots and videos</span>
				<input
					type="search"
					bind:value={query}
					placeholder="Search by spot name, ID, or video title"
				/>
			</label>

			<button type="button" class="video-map-btn" onclick={clearSelection} disabled={!selectedSpotId && selectedClusterSpotIds.length === 0}>
				Clear selection
			</button>

			<button
				type="button"
				class="video-map-btn"
				onclick={() => {
					if (!map || filteredPoints.length === 0) return;
					fitToPoints(filteredPoints, 6);
					clearSelection();
				}}
				disabled={!isMapReady || filteredPoints.length === 0}
			>
				Fit all filtered
			</button>
		</div>

		{#if shouldShowTruncationNotice}
			<p class="video-map-note">
				Showing {mapData.points.length} spots on the map (top by linked videos).
				{mapData.hiddenSpotCount} additional spots are currently hidden for performance.
			</p>
		{/if}

		{#if loadError}
			<p class="video-map-error">Map data could not fully load: {loadError}</p>
		{/if}
	</section>

	<section class="video-map-layout">
		<div class="video-map-map-column">
			<div class="video-map-map-shell">
				<div bind:this={mapContainer} class="video-map-canvas" role="region" aria-label="Spot video map"></div>
				<div class="video-map-cinematic-mask" aria-hidden="true"></div>
				{#if selectedSpot || selectedClusterSpots.length > 1}
					<div class="video-map-map-overlay">
						{#if selectedSpot}
							<strong>{selectedSpot.name}</strong>
							<span>{selectedSpot.videoCount} linked videos</span>
						{:else if selectedClusterSpots.length > 1}
							<strong>{selectedClusterSpots.length} nearby spots selected</strong>
							<span>Zoom in or choose a spot from results.</span>
						{/if}
					</div>
				{/if}
			</div>
		</div>

		<aside class="video-map-results" aria-label="Video results by spot">
			<header>
				<h2>Results</h2>
				<p>
					{#if selectedSpot}
						Showing videos from the selected spot.
					{:else if selectedClusterSpots.length > 1}
						Showing spots from the selected group.
					{:else if viewportSpots.length > 0}
						Showing spots in the current map view.
					{:else}
						Showing filtered spots.
					{/if}
				</p>
			</header>

			{#if resultSpots.length === 0}
				<div class="video-map-empty">
					<p>No spots match the current filter.</p>
				</div>
			{:else}
				<ul class="video-map-spot-list">
					{#each resultSpots as spot (spot.spotId)}
						<li class:selected={selectedSpotId === spot.spotId}>
							<div class="video-map-spot-header">
								<button type="button" class="spot-focus" onclick={() => focusSpot(spot)}>
									<strong>{spot.name}</strong>
									<span>{spot.videoCount} videos</span>
								</button>

								<a
									href={getParkourSpotUrl(spot.spotId)}
									target="_blank"
									rel="noreferrer"
									class="spot-link"
									title="Open on parkour.spot"
								>
									<img
										src="/icons/brand-parkour-dot-spot.svg"
										alt=""
										class="spot-link-logo"
										aria-hidden="true"
									/>
									<span>parkour.spot</span>
								</a>
							</div>

							<div class="video-card-list">
								{#each spot.videos as video (`${video.type}:${video.id}`)}
									<a href={video.href} class="video-card">
										{#if video.thumbnail}
											<img src={video.thumbnail} alt={video.title} loading="lazy" decoding="async" />
										{:else}
											<div class="video-thumb-fallback" aria-hidden="true">No image</div>
										{/if}

										<div class="video-meta">
											<p class="video-title">{video.title}</p>
											<p class="video-subtitle">
												{video.type === 'movie' ? 'Film' : 'Series'}
												{#if video.year}
													- {video.year}
												{/if}
												{#if video.duration}
													- {video.duration}
												{/if}
											</p>
										</div>
									</a>
								{/each}
							</div>

							{#if spot.videoCount > spot.videos.length}
								<p class="video-overflow-note">
									+{spot.videoCount - spot.videos.length} more videos linked to this spot.
								</p>
							{/if}
						</li>
					{/each}
				</ul>
			{/if}
		</aside>
	</section>
</div>

<style>
	.video-map-page {
		--vm-bg: #070a0f;
		--vm-bg-soft: #101622;
		--vm-card: #131b2a;
		--vm-border: rgba(221, 70, 62, 0.26);
		--vm-border-soft: rgba(255, 255, 255, 0.1);
		--vm-text: #f4f6fa;
		--vm-muted: #b0b6c5;
		--vm-accent: #dd463e;
		--vm-accent-soft: rgba(221, 70, 62, 0.15);
		--vm-map-glow: rgba(221, 70, 62, 0.18);
		padding: 5rem clamp(1rem, 2.8vw, 2.4rem) 2.2rem;
		min-height: 100vh;
		background:
			radial-gradient(circle at 16% 6%, rgba(221, 70, 62, 0.24), transparent 44%),
			radial-gradient(circle at 88% 94%, rgba(116, 153, 255, 0.2), transparent 42%),
			linear-gradient(175deg, var(--vm-bg) 0%, #080d16 58%, #0a0f19 100%);
		color: var(--vm-text);
	}

	.video-map-hero {
		max-width: 1180px;
		margin: 0 auto 1rem;
	}

	.video-map-kicker {
		margin: 0;
		font-size: 0.76rem;
		letter-spacing: 0.17em;
		text-transform: uppercase;
		font-weight: 700;
		color: color-mix(in oklch, var(--vm-accent) 76%, white 24%);
	}

	h1 {
		margin: 0.35rem 0 0;
		font-size: clamp(2rem, 5vw, 3.2rem);
		line-height: 1.03;
		letter-spacing: -0.02em;
	}

	.video-map-intro {
		max-width: 68ch;
		margin: 0.85rem 0 0;
		color: var(--vm-muted);
	}

	.video-map-stats {
		display: flex;
		flex-wrap: wrap;
		gap: 0.65rem;
		margin-top: 1rem;
	}

	.video-map-stat {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
		min-width: 9.4rem;
		padding: 0.55rem 0.7rem;
		border-radius: 0.7rem;
		border: 1px solid var(--vm-border-soft);
		background: color-mix(in oklch, var(--vm-bg-soft) 85%, black 15%);
	}

	.video-map-stat .label {
		font-size: 0.72rem;
		text-transform: uppercase;
		letter-spacing: 0.09em;
		color: color-mix(in oklch, var(--vm-muted) 84%, white 16%);
	}

	.video-map-stat strong {
		font-size: 1.04rem;
	}

	.video-map-controls {
		display: flex;
		flex-wrap: wrap;
		gap: 0.55rem;
		margin-top: 1rem;
	}

	.video-map-search {
		flex: 1 1 17rem;
	}

	.video-map-search input {
		width: 100%;
		min-height: 2.6rem;
		padding: 0.52rem 0.8rem;
		border-radius: 0.68rem;
		border: 1px solid var(--vm-border-soft);
		background: rgba(10, 16, 27, 0.92);
		color: var(--vm-text);
		outline: none;
	}

	.video-map-search input:focus-visible {
		border-color: color-mix(in oklch, var(--vm-accent) 66%, white 34%);
		box-shadow: 0 0 0 2px rgba(221, 70, 62, 0.28);
	}

	.video-map-btn {
		min-height: 2.6rem;
		padding: 0.5rem 0.85rem;
		border-radius: 0.66rem;
		border: 1px solid var(--vm-border-soft);
		background: rgba(12, 18, 31, 0.88);
		color: var(--vm-text);
		font-weight: 600;
		cursor: pointer;
		transition: transform 120ms ease, border-color 120ms ease, background 120ms ease;
	}

	.video-map-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		border-color: var(--vm-border);
		background: color-mix(in oklch, var(--vm-bg-soft) 65%, var(--vm-accent) 35%);
	}

	.video-map-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.video-map-note,
	.video-map-error {
		margin: 0.72rem 0 0;
		font-size: 0.9rem;
	}

	.video-map-note {
		color: var(--vm-muted);
	}

	.video-map-error {
		color: color-mix(in oklch, var(--vm-accent) 68%, white 32%);
	}

	.video-map-layout {
		max-width: 1180px;
		margin: 1rem auto 0;
		display: grid;
		grid-template-columns: minmax(0, 1.75fr) minmax(300px, 1fr);
		gap: 0.85rem;
	}

	.video-map-map-column {
		display: grid;
		gap: 0;
		align-content: start;
	}

	.video-map-map-shell {
		position: relative;
		border-radius: 1rem;
		overflow: hidden;
		border: 1px solid color-mix(in oklch, var(--vm-accent) 40%, rgba(255, 255, 255, 0.16));
		background: #0c1320;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.05),
			0 24px 60px -36px rgba(0, 0, 0, 0.72),
			0 0 0 1px rgba(221, 70, 62, 0.16);
		min-height: 70vh;
	}

	.video-map-canvas {
		height: 100%;
		min-height: 70vh;
	}

	.video-map-cinematic-mask {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 420;
		background:
			radial-gradient(circle at 22% 16%, rgba(221, 70, 62, 0.14), transparent 45%),
			radial-gradient(circle at 82% 84%, rgba(221, 70, 62, 0.08), transparent 40%),
			linear-gradient(
				180deg,
				rgba(8, 11, 17, 0.08) 0%,
				rgba(8, 11, 17, 0.18) 78%,
				rgba(8, 11, 17, 0.26) 100%
			),
			radial-gradient(circle at center, transparent 68%, rgba(2, 3, 5, 0.24) 100%);
	}

	.video-map-map-overlay {
		position: absolute;
		left: 0.75rem;
		bottom: 0.75rem;
		display: grid;
		gap: 0.1rem;
		max-width: min(430px, calc(100% - 1.5rem));
		padding: 0.58rem 0.7rem;
		border-radius: 0.65rem;
		background: rgba(10, 14, 24, 0.84);
		backdrop-filter: blur(6px);
		border: 1px solid rgba(255, 255, 255, 0.16);
		z-index: 500;
	}

	.video-map-map-overlay strong {
		font-size: 0.9rem;
	}

	.video-map-map-overlay span {
		font-size: 0.77rem;
		color: var(--vm-muted);
	}

	.video-map-results {
		border-radius: 1rem;
		border: 1px solid var(--vm-border-soft);
		background: rgba(9, 14, 23, 0.94);
		display: flex;
		flex-direction: column;
		max-height: 70vh;
		min-height: 70vh;
	}

	.video-map-results header {
		padding: 0.82rem 0.85rem 0.7rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.08);
	}

	.video-map-results h2 {
		margin: 0;
		font-size: 1rem;
	}

	.video-map-results p {
		margin: 0.25rem 0 0;
		font-size: 0.82rem;
		color: var(--vm-muted);
	}

	.video-map-empty {
		padding: 1rem;
	}

	.video-map-spot-list {
		list-style: none;
		padding: 0;
		margin: 0;
		overflow: auto;
	}

	.video-map-spot-list li {
		padding: 0.72rem;
		border-bottom: 1px solid rgba(255, 255, 255, 0.06);
		background: transparent;
	}

	.video-map-spot-list li.selected {
		background: linear-gradient(155deg, rgba(221, 70, 62, 0.14), rgba(92, 129, 255, 0.08));
	}

	.video-map-spot-header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.45rem;
	}

	.spot-focus {
		appearance: none;
		border: 0;
		background: transparent;
		padding: 0;
		text-align: left;
		color: inherit;
		cursor: pointer;
		display: grid;
		gap: 0.12rem;
	}

	.spot-focus strong {
		font-size: 0.95rem;
		line-height: 1.24;
	}

	.spot-focus span {
		font-size: 0.76rem;
		color: var(--vm-muted);
	}

	.spot-link {
		display: inline-flex;
		align-items: center;
		gap: 0.34rem;
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.01em;
		line-height: 1;
		text-decoration: none;
		padding: 0.3rem 0.52rem;
		border-radius: 999px;
		border: 1px solid color-mix(in oklch, var(--vm-accent) 44%, rgba(255, 255, 255, 0.22));
		background:
			linear-gradient(160deg, rgba(235, 91, 82, 0.22), rgba(135, 28, 23, 0.35)),
			rgba(25, 8, 10, 0.9);
		color: #ffeceb;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.08),
			0 8px 18px -12px rgba(0, 0, 0, 0.9);
		transition: border-color 120ms ease, transform 120ms ease, background-color 120ms ease;
	}

	.spot-link:hover {
		transform: translateY(-1px);
		border-color: color-mix(in oklch, var(--vm-accent) 66%, rgba(255, 255, 255, 0.34));
	}

	.spot-link-logo {
		width: 0.92rem;
		height: 0.92rem;
		flex: 0 0 auto;
		filter: invert(1) brightness(1.05);
		opacity: 0.95;
	}

	.spot-link span {
		display: inline-block;
		transform: translateY(0.5px);
	}

	.video-card-list {
		margin-top: 0.5rem;
		display: grid;
		gap: 0.44rem;
	}

	.video-card {
		display: grid;
		grid-template-columns: 64px minmax(0, 1fr);
		gap: 0.48rem;
		padding: 0.34rem;
		border-radius: 0.58rem;
		text-decoration: none;
		color: inherit;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(16, 23, 37, 0.8);
		transition: border-color 120ms ease, transform 120ms ease;
	}

	.video-card:hover {
		border-color: var(--vm-border);
		transform: translateY(-1px);
	}

	.video-card img,
	.video-thumb-fallback {
		display: block;
		width: 64px;
		height: 95px;
		border-radius: 0.44rem;
		object-fit: cover;
	}

	.video-thumb-fallback {
		display: grid;
		place-items: center;
		font-size: 0.66rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		background: linear-gradient(155deg, #253041, #0f1520);
		color: var(--vm-muted);
	}

	.video-meta {
		min-width: 0;
		align-self: center;
	}

	.video-title {
		margin: 0;
		font-size: 0.86rem;
		line-height: 1.3;
		font-weight: 700;
		display: -webkit-box;
		line-clamp: 2;
		-webkit-line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
	}

	.video-subtitle {
		margin: 0.2rem 0 0;
		font-size: 0.74rem;
		color: var(--vm-muted);
	}

	.video-overflow-note {
		margin: 0.48rem 0 0;
		font-size: 0.75rem;
		color: var(--vm-muted);
	}

	:global(.video-map-pin-host) {
		background: none;
		border: 0;
		overflow: visible;
	}

	:global(.video-map-pin-wrap) {
		position: relative;
		width: 100%;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		filter: drop-shadow(0 3px 7px rgba(0, 0, 0, 0.38));
	}

	:global(.video-map-pin-glow) {
		position: absolute;
		inset: -18%;
		border-radius: 999px;
		opacity: 0.16;
		background: radial-gradient(
			circle,
			rgba(221, 70, 62, 0.34) 0%,
			rgba(221, 70, 62, 0.08) 48%,
			rgba(221, 70, 62, 0) 72%
		);
		transform: scale(0.9);
		transition: opacity 160ms ease, transform 160ms ease;
	}

	:global(.video-map-pin-shell) {
		position: relative;
		z-index: 1;
		display: grid;
		place-items: center;
		width: 100%;
		height: 100%;
		border: 1px solid rgba(255, 235, 231, 0.58);
		border-radius: 50%;
		background: rgba(21, 24, 34, 0.58);
		box-shadow:
			inset 0 0 0 3px rgba(221, 70, 62, 0.12),
			inset 0 1px 0 rgba(255, 255, 255, 0.16),
			0 2px 7px rgba(0, 0, 0, 0.42);
		backdrop-filter: blur(4px);
		transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
	}

	:global(.video-map-pin-wrap.is-single .video-map-pin-shell) {
		width: 64%;
		height: 64%;
		border-color: rgba(255, 226, 221, 0.64);
		background: rgba(196, 58, 51, 0.62);
		box-shadow:
			inset 0 0 0 2px rgba(255, 238, 234, 0.08),
			0 2px 5px rgba(0, 0, 0, 0.34);
	}

	:global(.video-map-pin-wrap.is-group .video-map-pin-shell::before),
	:global(.video-map-pin-wrap.is-group .video-map-pin-shell::after) {
		content: '';
		position: absolute;
		z-index: 0;
		inset: 0.16rem;
		border: 1px solid rgba(221, 70, 62, 0.18);
		border-radius: 50%;
		background: transparent;
	}

	:global(.video-map-pin-wrap.is-group .video-map-pin-shell::before) {
		transform: translate(-0.14rem, 0.14rem);
		opacity: 0.75;
	}

	:global(.video-map-pin-wrap.is-group .video-map-pin-shell::after) {
		transform: translate(-0.26rem, 0.26rem);
		opacity: 0.45;
	}

	:global(.video-map-pin-count) {
		position: relative;
		z-index: 1;
		display: block;
		font-size: 0.68rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: -0.02em;
		color: rgba(255, 245, 242, 0.92);
		text-align: center;
		text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	}

	:global(.video-map-pin-wrap.is-single .video-map-pin-count) {
		font-size: 0.58rem;
		font-weight: 750;
	}

	:global(.video-map-pin-wrap:hover .video-map-pin-shell) {
		transform: scale(1.06);
		border-color: rgba(255, 247, 244, 0.82);
	}

	:global(.video-map-pin-wrap:hover .video-map-pin-glow) {
		transform: scale(1.04);
		opacity: 0.26;
	}

	:global(.video-map-pin-wrap.is-selected .video-map-pin-shell) {
		border-color: rgba(255, 248, 245, 0.96);
		box-shadow:
			0 0 0 2px rgba(255, 255, 255, 0.24),
			0 0 0 4px rgba(221, 70, 62, 0.16),
			0 3px 8px rgba(0, 0, 0, 0.42);
	}

	:global(.video-map-pin-wrap.is-selected .video-map-pin-glow) {
		opacity: 0.32;
		transform: scale(1.04);
	}

	:global(.video-map-pin-wrap.is-soft .video-map-pin-glow) {
		opacity: 0.1;
	}

	:global(.video-map-pin-wrap.is-strong .video-map-pin-glow) {
		opacity: 0.14;
	}

	:global(.video-map-pin-wrap.is-intense .video-map-pin-glow) {
		opacity: 0.18;
	}
	:global(.video-map-canvas .video-map-osm-tiles) {
		filter: invert(0.94) hue-rotate(180deg) saturate(0.42) brightness(0.62) contrast(1.18);
	}

	:global(.video-map-canvas .leaflet-control-zoom) {
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.78rem;
		overflow: hidden;
		box-shadow:
			0 14px 26px -16px rgba(0, 0, 0, 0.88),
			0 0 0 1px rgba(221, 70, 62, 0.24);
	}

	:global(.video-map-canvas .leaflet-control-zoom a) {
		width: 2.2rem;
		height: 2.2rem;
		line-height: 2.2rem;
		background: rgba(18, 25, 37, 0.92);
		color: rgba(246, 249, 255, 0.92);
		border-bottom-color: rgba(255, 255, 255, 0.14);
	}

	:global(.video-map-canvas .leaflet-control-zoom a:hover) {
		background: rgba(42, 18, 22, 0.94);
		color: #fff;
	}

	:global(.video-map-canvas .leaflet-control-zoom a.leaflet-disabled) {
		color: rgba(237, 179, 174, 0.5);
		background: rgba(18, 20, 28, 0.9);
	}

	:global(.video-map-canvas .leaflet-control-attribution) {
		background: transparent;
		color: rgba(236, 222, 219, 0.48);
		padding: 0.08rem 0.18rem;
		border: 0;
		font-size: 0.58rem;
		line-height: 1.15;
		opacity: 0.72;
		box-shadow: none;
		backdrop-filter: none;
	}

	:global(.video-map-canvas .leaflet-control-attribution a) {
		color: color-mix(in oklch, var(--vm-accent) 58%, white 42%);
	}

	@media (max-width: 1020px) {
		.video-map-layout {
			grid-template-columns: minmax(0, 1fr);
		}

		.video-map-map-shell,
		.video-map-canvas {
			min-height: 55vh;
		}

		.video-map-results {
			min-height: 45vh;
			max-height: none;
		}
	}

	@media (max-width: 620px) {
		.video-map-page {
			padding-top: 4.45rem;
		}

		.video-map-controls {
			gap: 0.48rem;
		}

		.video-map-btn {
			flex: 1 1 auto;
		}

		.video-map-map-shell,
		.video-map-canvas {
			min-height: 48vh;
		}

		.video-card {
			grid-template-columns: 56px minmax(0, 1fr);
		}

		.video-card img,
		.video-thumb-fallback {
			width: 56px;
			height: 82px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.video-map-pin-wrap .video-map-pin-shell),
		:global(.video-map-pin-wrap .video-map-pin-glow) {
			transition: none;
		}

		:global(.video-map-pin-wrap.is-selected .video-map-pin-shell) {
			animation: none;
		}
	}
</style>
