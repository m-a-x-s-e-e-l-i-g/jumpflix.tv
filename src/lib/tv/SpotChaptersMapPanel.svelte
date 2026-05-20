<script lang="ts">
	import { browser } from '$app/environment';
	import { onMount } from 'svelte';
	import { getParkourSpotUrl } from '$lib/utils';
	import * as m from '$lib/paraglide/messages';

	import 'leaflet/dist/leaflet.css';

	type SpotInfo = {
		id: string;
		name: string;
		lat: number;
		lng: number;
	};

	type SpotChapter = {
		suggestionId: number;
		spotId: string;
		startSeconds: number;
		endSeconds: number;
		startTimecode?: string | null;
		endTimecode?: string | null;
		spot?: SpotInfo | null;
	};

	type PointChapter = {
		suggestionId: number;
		startSeconds: number;
		endSeconds: number;
		startLabel: string;
		endLabel: string;
	};

	type MapPoint = {
		spotId: string;
		name: string;
		lat: number;
		lng: number;
		chapters: PointChapter[];
	};

	export let chapters: SpotChapter[] = [];

	let mapContainer: HTMLDivElement | null = null;
	let leaflet: typeof import('leaflet') | null = null;
	let map: import('leaflet').Map | null = null;
	let markersLayer: import('leaflet').LayerGroup | null = null;

	let selectedSpotId: string | null = null;
	let fittedSignature = '';

	function clamp(n: number, min: number, max: number): number {
		return Math.min(max, Math.max(min, n));
	}

	function formatSecondsToTimecode(totalSeconds: number): string {
		const s = Math.max(0, Math.floor(totalSeconds || 0));
		const h = Math.floor(s / 3600);
		const min = Math.floor((s % 3600) / 60);
		const sec = s % 60;
		if (h > 0) {
			return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
		}
		return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
	}

	function getTimeLabel(tc: unknown, seconds: unknown): string {
		const trimmed = typeof tc === 'string' ? tc.trim() : '';
		if (trimmed) return trimmed;
		const n = typeof seconds === 'number' ? seconds : Number(String(seconds ?? ''));
		return Number.isFinite(n) ? formatSecondsToTimecode(n) : '00:00';
	}

	function hasSpotCoordinates(spot: SpotInfo | null | undefined): spot is SpotInfo {
		const lat = Number(spot?.lat);
		const lng = Number(spot?.lng);
		return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
	}

	function toMapPoints(source: SpotChapter[]): MapPoint[] {
		const grouped = new Map<string, MapPoint>();

		for (const chapter of source) {
			const spotId = String(chapter?.spot?.id ?? chapter?.spotId ?? '').trim();
			if (!spotId || !hasSpotCoordinates(chapter?.spot)) continue;

			if (!grouped.has(spotId)) {
				grouped.set(spotId, {
					spotId,
					name: String(chapter.spot?.name ?? spotId).trim() || spotId,
					lat: Number(chapter.spot.lat),
					lng: Number(chapter.spot.lng),
					chapters: []
				});
			}

			const point = grouped.get(spotId);
			if (!point) continue;

			point.chapters.push({
				suggestionId: Number(chapter.suggestionId),
				startSeconds: Math.max(0, Math.floor(Number(chapter.startSeconds ?? 0))),
				endSeconds: Math.max(0, Math.floor(Number(chapter.endSeconds ?? 0))),
				startLabel: getTimeLabel(chapter.startTimecode, chapter.startSeconds),
				endLabel: getTimeLabel(chapter.endTimecode, chapter.endSeconds)
			});
		}

		return Array.from(grouped.values())
			.map((point) => ({
				...point,
				chapters: [...point.chapters].sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds)
			}))
			.sort((a, b) => b.chapters.length - a.chapters.length || a.name.localeCompare(b.name));
	}

	function buildPinIcon(point: MapPoint, isSelected: boolean): import('leaflet').DivIcon {
		if (!leaflet) throw new Error('Leaflet not initialized');

		const chapterCount = Math.max(1, point.chapters.length);
		const size = clamp(31 + Math.sqrt(chapterCount) * 3.4, 32, 48);
		const intensityClass = chapterCount >= 8 ? 'is-intense' : chapterCount >= 4 ? 'is-strong' : 'is-soft';
		const selectedClass = isSelected ? 'is-selected' : '';

		return leaflet.divIcon({
			className: 'detail-spot-map-pin-host',
			html: `<div class="detail-spot-map-pin-wrap ${intensityClass} ${selectedClass}"><span class="detail-spot-map-pin-glow" aria-hidden="true"></span><span class="detail-spot-map-pin-core"><span class="detail-spot-map-pin-count">${chapterCount}</span></span></div>`,
			iconSize: [size, size],
			iconAnchor: [size / 2, size / 2]
		});
	}

	function fitToPoints(points: MapPoint[], maxZoom = 8) {
		if (!map || !leaflet || points.length === 0) return;
		const bounds = leaflet.latLngBounds(points.map((point) => [point.lat, point.lng] as [number, number]));
		if (!bounds.isValid()) return;
		map.fitBounds(bounds, { padding: [26, 26], maxZoom });
	}

	function getFitMaxZoom(points: MapPoint[]): number {
		if (points.length <= 1) return 12;

		let minLat = points[0].lat;
		let maxLat = points[0].lat;
		let minLng = points[0].lng;
		let maxLng = points[0].lng;

		for (let i = 1; i < points.length; i += 1) {
			const point = points[i];
			if (point.lat < minLat) minLat = point.lat;
			if (point.lat > maxLat) maxLat = point.lat;
			if (point.lng < minLng) minLng = point.lng;
			if (point.lng > maxLng) maxLng = point.lng;
		}

		const span = Math.max(maxLat - minLat, maxLng - minLng);

		if (span < 0.008) return 14;
		if (span < 0.03) return 13;
		if (span < 0.1) return 12;
		if (span < 0.35) return 11;
		if (span < 1.2) return 10;
		if (span < 4) return 9;
		return 8;
	}

	function refreshMarkers() {
		if (!map || !leaflet || !markersLayer) return;

		markersLayer.clearLayers();

		for (const point of mapPoints) {
			const marker = leaflet.marker([point.lat, point.lng], {
				icon: buildPinIcon(point, point.spotId === selectedSpotId),
				riseOnHover: true
			});

			marker.on('click', () => {
				selectedSpotId = point.spotId;
				if (map && map.getZoom() < 11) {
					map.setView([point.lat, point.lng], 11, { animate: true });
				}
				refreshMarkers();
			});

			marker.addTo(markersLayer);
		}
	}

	function focusPoint(point: MapPoint) {
		selectedSpotId = point.spotId;
		if (!map) return;
		map.setView([point.lat, point.lng], Math.max(11, map.getZoom()), { animate: true });
		refreshMarkers();
	}

	let mapPoints: MapPoint[] = [];
	$: mapPoints = toMapPoints(chapters);
	$: selectedPoint = selectedSpotId
		? mapPoints.find((point) => point.spotId === selectedSpotId) ?? null
		: null;
	$: mappedSpotIds = new Set(mapPoints.map((point) => point.spotId));
	$: uniqueSpotIds = new Set(
		chapters
			.map((chapter) => String(chapter?.spot?.id ?? chapter?.spotId ?? '').trim())
			.filter((spotId) => spotId.length > 0)
	);
	$: missingCoordinateSpots = Math.max(0, uniqueSpotIds.size - mappedSpotIds.size);
	$: mapPointSignature = mapPoints
		.map((point) => `${point.spotId}:${point.lat.toFixed(4)}:${point.lng.toFixed(4)}:${point.chapters.length}`)
		.join('|');

	$: if (selectedSpotId && !mapPoints.some((point) => point.spotId === selectedSpotId)) {
		selectedSpotId = null;
	}

	$: if (!selectedSpotId && mapPoints.length > 0) {
		selectedSpotId = mapPoints[0].spotId;
	}

	$: if (map && markersLayer) {
		mapPoints;
		selectedSpotId;
		refreshMarkers();
	}

	$: if (map && mapPointSignature && mapPointSignature !== fittedSignature) {
		fitToPoints(mapPoints, getFitMaxZoom(mapPoints));
		fittedSignature = mapPointSignature;
	}

	$: if (!mapPointSignature) {
		fittedSignature = '';
	}

	onMount(() => {
		if (!browser || !mapContainer) return;

		let disposed = false;

		void (async () => {
			leaflet = await import('leaflet');
			if (disposed || !leaflet || !mapContainer) return;

			map = leaflet.map(mapContainer, {
				center: [22, 6],
				zoom: 3,
				scrollWheelZoom: true,
				preferCanvas: true,
				worldCopyJump: true,
				attributionControl: false
			});

			leaflet
				.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
					subdomains: 'abcd',
					maxZoom: 20,
					className: 'detail-spot-map-base'
				})
				.addTo(map);

			leaflet
				.tileLayer('https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png', {
					subdomains: 'abcd',
					maxZoom: 20,
					opacity: 0.88,
					className: 'detail-spot-map-labels'
				})
				.addTo(map);

			markersLayer = leaflet.layerGroup().addTo(map);
			map.on('moveend zoomend', () => {
				refreshMarkers();
			});
			refreshMarkers();
		})();

		return () => {
			disposed = true;
			map?.remove();
			map = null;
			leaflet = null;
			markersLayer = null;
			fittedSignature = '';
		};
	});
</script>

{#if mapPoints.length === 0}
	<p class="detail-muted">Spots are linked to this video, but map coordinates are unavailable right now.</p>
{:else}
	<div class="detail-spot-map-panel">
		<div class="detail-spot-map-shell">
			<div bind:this={mapContainer} class="detail-spot-map-canvas" role="region" aria-label="Spots map"></div>
			<div class="detail-spot-map-mask" aria-hidden="true"></div>
			<div class="detail-spot-map-summary">
				<strong>{mapPoints.length} mapped {mapPoints.length === 1 ? 'spot' : 'spots'}</strong>
				{#if missingCoordinateSpots > 0}
					<span>{missingCoordinateSpots} spots without coordinates</span>
				{/if}
			</div>
		</div>

		<ul class="detail-spot-map-spots" aria-label="Mapped spots">
			{#each mapPoints as point (point.spotId)}
				<li>
					<button
						type="button"
						class:selected={selectedSpotId === point.spotId}
						onclick={() => focusPoint(point)}
					>
						<span class="name">{point.name}</span>
						<span class="count">{point.chapters.length}</span>
					</button>
				</li>
			{/each}
		</ul>

		{#if selectedPoint}
			<div class="detail-spot-map-details">
				<div class="detail-spot-map-details-header">
					<div class="detail-spot-map-title-wrap">
						<strong>{selectedPoint.name}</strong>
						<p>{selectedPoint.chapters.length} chapter links</p>
					</div>
					<a
						href={getParkourSpotUrl(selectedPoint.spotId)}
						target="_blank"
						rel="noreferrer"
						class="detail-spot-map-open"
						title={m.tv_openOnParkourSpot()}
					>
						<img
							src="/icons/brand-parkour-dot-spot.svg"
							alt=""
							class="detail-spot-map-open-logo"
							aria-hidden="true"
						/>
						<span>{m.tv_open()}</span>
					</a>
				</div>

				<ul class="detail-spot-map-chapter-list">
					{#each selectedPoint.chapters as chapter (chapter.suggestionId)}
						<li>
							<span class="time">{chapter.startLabel} - {chapter.endLabel}</span>
						</li>
					{/each}
				</ul>
			</div>
		{/if}
	</div>
{/if}

<style>
	.detail-spot-map-panel {
		display: grid;
		gap: 0.58rem;
		margin-top: 0.35rem;
	}

	.detail-spot-map-shell {
		position: relative;
		min-height: 17rem;
		border-radius: 0.9rem;
		overflow: hidden;
		border: 1px solid rgba(142, 207, 242, 0.28);
		background: #0f1724;
		box-shadow:
			inset 0 0 0 1px rgba(255, 255, 255, 0.05),
			0 22px 40px -28px rgba(0, 0, 0, 0.72);
	}

	.detail-spot-map-canvas {
		height: 17rem;
		width: 100%;
	}

	.detail-spot-map-mask {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 410;
		background:
			radial-gradient(circle at 20% 16%, rgba(142, 207, 242, 0.14), transparent 44%),
			radial-gradient(circle at 82% 84%, rgba(221, 70, 62, 0.1), transparent 38%),
			linear-gradient(180deg, rgba(8, 12, 19, 0.02) 0%, rgba(8, 12, 19, 0.14) 100%);
	}

	.detail-spot-map-summary {
		position: absolute;
		left: 0.62rem;
		bottom: 0.62rem;
		display: grid;
		gap: 0.1rem;
		padding: 0.45rem 0.55rem;
		border-radius: 0.62rem;
		background: rgba(10, 16, 26, 0.82);
		border: 1px solid rgba(255, 255, 255, 0.14);
		backdrop-filter: blur(5px);
		z-index: 500;
	}

	.detail-spot-map-summary strong {
		font-size: 0.76rem;
		line-height: 1.2;
	}

	.detail-spot-map-summary span {
		font-size: 0.68rem;
		color: rgba(229, 235, 244, 0.76);
		line-height: 1.2;
	}

	.detail-spot-map-spots {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-wrap: wrap;
		gap: 0.42rem;
	}

	.detail-spot-map-spots li {
		margin: 0;
		padding: 0;
	}

	.detail-spot-map-spots button {
		appearance: none;
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		max-width: 100%;
		border: 1px solid rgba(142, 207, 242, 0.25);
		background: rgba(16, 24, 38, 0.75);
		color: rgba(239, 244, 251, 0.94);
		padding: 0.28rem 0.48rem;
		border-radius: 999px;
		font-size: 0.72rem;
		cursor: pointer;
		transition: border-color 120ms ease, background-color 120ms ease;
	}

	.detail-spot-map-spots button .name {
		max-width: 18ch;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.detail-spot-map-spots button .count {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 1.1rem;
		height: 1.1rem;
		padding: 0 0.24rem;
		border-radius: 999px;
		background: rgba(142, 207, 242, 0.22);
		font-weight: 700;
	}

	.detail-spot-map-spots button:hover,
	.detail-spot-map-spots button.selected {
		border-color: rgba(142, 207, 242, 0.62);
		background: rgba(28, 43, 64, 0.86);
	}

	.detail-spot-map-details {
		border: 1px solid rgba(255, 255, 255, 0.09);
		background: rgba(16, 23, 36, 0.72);
		border-radius: 0.75rem;
		padding: 0.62rem;
		display: grid;
		gap: 0.48rem;
	}

	.detail-spot-map-details-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.58rem;
	}

	.detail-spot-map-title-wrap strong {
		display: block;
		font-size: 0.84rem;
		line-height: 1.3;
	}

	.detail-spot-map-title-wrap p {
		margin: 0.08rem 0 0;
		font-size: 0.72rem;
		color: rgba(227, 233, 241, 0.72);
	}

	.detail-spot-map-open {
		display: inline-flex;
		align-items: center;
		gap: 0.32rem;
		flex-shrink: 0;
		text-decoration: none;
		border: 1px solid rgba(142, 207, 242, 0.42);
		background: rgba(142, 207, 242, 0.14);
		color: #bfe6fb;
		padding: 0.24rem 0.42rem;
		border-radius: 999px;
		font-size: 0.7rem;
		font-weight: 700;
	}

	.detail-spot-map-open:hover {
		border-color: rgba(142, 207, 242, 0.66);
		background: rgba(142, 207, 242, 0.2);
	}

	.detail-spot-map-open-logo {
		width: 0.88rem;
		height: 0.88rem;
		filter: invert(1) brightness(1.05);
	}

	.detail-spot-map-chapter-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: grid;
		gap: 0.35rem;
	}

	.detail-spot-map-chapter-list li {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.6rem;
		padding: 0.36rem 0.44rem;
		border-radius: 0.52rem;
		border: 1px solid rgba(255, 255, 255, 0.08);
		background: rgba(9, 14, 24, 0.74);
	}

	.detail-spot-map-chapter-list .time {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
		font-size: 0.72rem;
		color: rgba(229, 236, 246, 0.92);
	}

	:global(.detail-spot-map-canvas .detail-spot-map-base) {
		filter: saturate(1.08) contrast(1.08) brightness(1.08);
	}

	:global(.detail-spot-map-canvas .detail-spot-map-labels) {
		filter: saturate(0.92) contrast(1.14) brightness(1.22);
	}

	:global(.detail-spot-map-canvas .leaflet-control-zoom) {
		border: 1px solid rgba(255, 255, 255, 0.2);
		border-radius: 0.72rem;
		overflow: hidden;
		box-shadow:
			0 14px 22px -16px rgba(0, 0, 0, 0.86),
			0 0 0 1px rgba(142, 207, 242, 0.23);
	}

	:global(.detail-spot-map-canvas .leaflet-control-zoom a) {
		width: 2rem;
		height: 2rem;
		line-height: 2rem;
		background: rgba(17, 24, 35, 0.92);
		color: rgba(244, 248, 255, 0.94);
		border-bottom-color: rgba(255, 255, 255, 0.14);
	}

	:global(.detail-spot-map-canvas .leaflet-control-zoom a:hover) {
		background: rgba(28, 39, 57, 0.94);
		color: #fff;
	}

	:global(.detail-spot-map-pin-host) {
		background: none;
		border: 0;
	}

	:global(.detail-spot-map-pin-wrap) {
		position: relative;
		width: 100%;
		height: 100%;
		display: grid;
		place-items: center;
		filter: drop-shadow(0 8px 12px rgba(0, 0, 0, 0.45));
	}

	:global(.detail-spot-map-pin-glow) {
		position: absolute;
		inset: -8%;
		border-radius: 999px;
		opacity: 0.28;
		background: radial-gradient(circle, rgba(142, 207, 242, 0.62) 0%, rgba(142, 207, 242, 0.18) 56%, rgba(142, 207, 242, 0) 78%);
	}

	:global(.detail-spot-map-pin-core) {
		position: relative;
		z-index: 2;
		width: 74%;
		height: 74%;
		display: grid;
		place-items: center;
		border-radius: 999px;
		border: 1px solid rgba(237, 248, 255, 0.76);
		background: radial-gradient(circle at 35% 24%, #d7f2ff, #5eaed6 56%, #1f4c66 100%);
	}

	:global(.detail-spot-map-pin-count) {
		font-size: 0.74rem;
		font-weight: 800;
		line-height: 1;
		color: rgba(248, 253, 255, 0.98);
		text-shadow: 0 1px 4px rgba(0, 0, 0, 0.45);
	}

	:global(.detail-spot-map-pin-wrap.is-soft .detail-spot-map-pin-glow) {
		opacity: 0.24;
	}

	:global(.detail-spot-map-pin-wrap.is-strong .detail-spot-map-pin-glow) {
		opacity: 0.34;
	}

	:global(.detail-spot-map-pin-wrap.is-intense .detail-spot-map-pin-glow) {
		opacity: 0.44;
	}

	:global(.detail-spot-map-pin-wrap.is-selected .detail-spot-map-pin-core) {
		border-color: #fff;
		box-shadow:
			0 0 0 3px rgba(255, 255, 255, 0.24),
			0 0 0 7px rgba(142, 207, 242, 0.24);
	}

	@media (max-width: 640px) {
		.detail-spot-map-canvas {
			height: 15rem;
		}

		.detail-spot-map-shell {
			min-height: 15rem;
		}
	}
</style>
