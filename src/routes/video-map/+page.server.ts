import type { PageServerLoad } from './$types';
import { createSupabaseClient } from '$lib/server/supabaseClient';
import { canonicalizeSpotChapterRows } from '$lib/server/spotChapters';
import { fetchSpotById } from '$lib/server/parkourSpot';
import { normalizeParkourSpotPayload } from '$lib/server/parkourSpotPayload';
import { normalizeParkourSpotId } from '$lib/utils';

const MAX_SPOTS_TO_HYDRATE = 700;
const MAX_VIDEOS_PER_SPOT = 16;
const SPOT_FETCH_CONCURRENCY = 10;
const MEDIA_QUERY_CHUNK_SIZE = 250;

type SpotChapterRow = {
	id: number;
	media_id: number;
	media_type: 'movie' | 'series';
	spot_id: string;
};

type MediaRow = {
	id: number;
	type: 'movie' | 'series';
	slug: string;
	title: string;
	thumbnail: string | null;
	year: string | null;
	duration: string | null;
};

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

type NormalizedSpot = {
	id: string;
	name: string;
	lat: number;
	lng: number;
};

type HydrateSpotsResult = {
	spots: Map<string, NormalizedSpot>;
	unresolvedCount: number;
};

function createEmptyMapData(): MapData {
	return {
		points: [],
		totalSpotChapters: 0,
		totalSpotsAvailable: 0,
		hiddenSpotCount: 0,
		totalVideosAvailable: 0,
		maxVideosPerSpot: MAX_VIDEOS_PER_SPOT
	};
}

function parseYearSortKey(value: string | null | undefined): number {
	if (!value) return 0;
	const match = String(value).match(/\b(19\d{2}|20\d{2})\b/);
	if (!match) return 0;
	const year = Number(match[1]);
	return Number.isFinite(year) ? year : 0;
}

function buildMediaKey(mediaType: 'movie' | 'series', mediaId: number): string {
	return `${mediaType}:${mediaId}`;
}

function buildMediaHref(media: MediaRow): string {
	return media.type === 'series' ? `/series/${media.slug}` : `/movie/${media.slug}`;
}

function chunkArray<T>(input: T[], size: number): T[][] {
	if (!input.length) return [];
	const chunks: T[][] = [];
	for (let index = 0; index < input.length; index += size) {
		chunks.push(input.slice(index, index + size));
	}
	return chunks;
}

async function hydrateSpots(spotIds: string[]): Promise<HydrateSpotsResult> {
	const out = new Map<string, NormalizedSpot>();
	if (spotIds.length === 0) return { spots: out, unresolvedCount: 0 };
	let unresolvedCount = 0;

	const queue = [...spotIds];
	const workers = Array.from(
		{ length: Math.min(SPOT_FETCH_CONCURRENCY, queue.length) },
		() =>
			(async () => {
				while (queue.length > 0) {
					const spotId = queue.shift();
					if (!spotId) continue;
					try {
						const raw = await fetchSpotById(spotId);
						const normalized = normalizeParkourSpotPayload(raw, spotId);
						if (!normalized) {
							unresolvedCount += 1;
							continue;
						}

						out.set(spotId, {
							id: normalized.id,
							name: normalized.name,
							lat: normalized.lat,
							lng: normalized.lng
						});
					} catch {
						unresolvedCount += 1;
						// Ignore spot-level failures so one bad spot does not break the page.
					}
				}
			})()
	);

	await Promise.all(workers);
	return { spots: out, unresolvedCount };
}

async function loadMediaByKey(mediaIds: number[]): Promise<Map<string, MediaRow>> {
	const out = new Map<string, MediaRow>();
	if (mediaIds.length === 0) return out;

	const supabase = createSupabaseClient();
	const chunks = chunkArray(mediaIds, MEDIA_QUERY_CHUNK_SIZE);

	for (const ids of chunks) {
		const { data, error } = await supabase
			.from('media_items')
			.select('id, type, slug, title, thumbnail, year, duration')
			.in('id', ids);

		if (error) {
			throw new Error(error.message || 'Failed to load media for map');
		}

		for (const row of Array.isArray(data) ? (data as any[]) : []) {
			const mediaId = Number(row?.id);
			const mediaType = row?.type;
			const slug = String(row?.slug ?? '').trim();
			const title = String(row?.title ?? '').trim();
			if (!Number.isFinite(mediaId) || (mediaType !== 'movie' && mediaType !== 'series')) continue;
			if (!slug || !title) continue;

			const normalizedRow: MediaRow = {
				id: mediaId,
				type: mediaType,
				slug,
				title,
				thumbnail: typeof row?.thumbnail === 'string' && row.thumbnail.trim() ? row.thumbnail : null,
				year: typeof row?.year === 'string' && row.year.trim() ? row.year : null,
				duration: typeof row?.duration === 'string' && row.duration.trim() ? row.duration : null
			};

			out.set(buildMediaKey(normalizedRow.type, normalizedRow.id), normalizedRow);
		}
	}

	return out;
}

export const load: PageServerLoad = async ({ setHeaders }) => {
	setHeaders({
		'Cache-Control': 'public, max-age=120, s-maxage=600'
	});

	try {
		const supabase = createSupabaseClient();
		const { data, error } = await supabase
			.from('spot_chapters')
			.select('id, media_id, media_type, spot_id');

		if (error) {
			const message = String(error.message ?? '').toLowerCase();
			if (
				message.includes('spot_chapters') &&
				(message.includes('does not exist') || message.includes('relation'))
			) {
				return { mapData: createEmptyMapData(), loadError: null };
			}
			throw new Error(error.message || 'Failed to load map chapters');
		}

		const rows = (Array.isArray(data) ? data : [])
			.map((row) => {
				const id = Number(row.id);
				const mediaId = Number(row.media_id);
				const mediaType = row.media_type;
				const spotId = String(row.spot_id ?? '').trim();

				if (!Number.isFinite(id) || !Number.isFinite(mediaId)) return null;
				if (mediaType !== 'movie' && mediaType !== 'series') return null;
				if (!spotId) return null;

				return {
					id,
					media_id: mediaId,
					media_type: mediaType,
					spot_id: spotId
				} as SpotChapterRow;
			})
			.filter((row): row is SpotChapterRow => row !== null);

		if (rows.length === 0) {
			return { mapData: createEmptyMapData(), loadError: null };
		}

		const canonicalByRow = await canonicalizeSpotChapterRows(
			rows.map((row) => ({
				id: row.id,
				media_id: row.media_id,
				media_type: row.media_type,
				spot_id: row.spot_id
			}))
		);

		const mediaKeysBySpotId = new Map<string, Set<string>>();

		for (const row of rows) {
			const normalizedOriginalSpotId =
				normalizeParkourSpotId(row.spot_id) ?? String(row.spot_id ?? '').trim();
			const canonicalSpotId =
				canonicalByRow.get(row.id) ?? normalizedOriginalSpotId;

			if (!canonicalSpotId) continue;

			if (!mediaKeysBySpotId.has(canonicalSpotId)) {
				mediaKeysBySpotId.set(canonicalSpotId, new Set<string>());
			}

			mediaKeysBySpotId
				.get(canonicalSpotId)
				?.add(buildMediaKey(row.media_type, row.media_id));
		}

		if (mediaKeysBySpotId.size === 0) {
			return { mapData: createEmptyMapData(), loadError: null };
		}

		const rankedSpotIds = Array.from(mediaKeysBySpotId.entries())
			.sort((a, b) => b[1].size - a[1].size)
			.map(([spotId]) => spotId);

		const spotIdsForMap = rankedSpotIds.slice(0, MAX_SPOTS_TO_HYDRATE);
		const hiddenSpotCount = Math.max(0, rankedSpotIds.length - spotIdsForMap.length);

		const mediaIds = Array.from(
			new Set(
				spotIdsForMap.flatMap((spotId) =>
					Array.from(mediaKeysBySpotId.get(spotId) ?? [])
						.map((key) => Number(key.split(':')[1]))
						.filter((id) => Number.isFinite(id))
				)
			)
		);

		const [mediaByKey, spotHydration] = await Promise.all([
			loadMediaByKey(mediaIds),
			hydrateSpots(spotIdsForMap)
		]);
		const spotById = spotHydration.spots;

		const points: MapSpotPoint[] = [];
		const uniqueMediaKeys = new Set<string>();

		for (const spotId of spotIdsForMap) {
			const spot = spotById.get(spotId);
			if (!spot) continue;

			const mediaKeys = Array.from(mediaKeysBySpotId.get(spotId) ?? [])
				.filter((key) => mediaByKey.has(key))
				.sort((a, b) => {
					const mediaA = mediaByKey.get(a);
					const mediaB = mediaByKey.get(b);
					if (!mediaA || !mediaB) return 0;
					const yearDiff = parseYearSortKey(mediaB.year) - parseYearSortKey(mediaA.year);
					if (yearDiff !== 0) return yearDiff;
					return mediaA.title.localeCompare(mediaB.title);
				});

			if (mediaKeys.length === 0) continue;

			const videos: MapVideo[] = mediaKeys.slice(0, MAX_VIDEOS_PER_SPOT).flatMap((key) => {
				const media = mediaByKey.get(key);
				if (!media) return [];
				return [
					{
						id: media.id,
						type: media.type,
						slug: media.slug,
						title: media.title,
						href: buildMediaHref(media),
						thumbnail: media.thumbnail,
						year: media.year,
						duration: media.duration
					}
				];
			});

			for (const mediaKey of mediaKeys) uniqueMediaKeys.add(mediaKey);

			points.push({
				spotId: spot.id,
				name: spot.name,
				lat: spot.lat,
				lng: spot.lng,
				videoCount: mediaKeys.length,
				videos
			});
		}

		points.sort((a, b) => b.videoCount - a.videoCount || a.name.localeCompare(b.name));

		const loadError =
			spotIdsForMap.length > 0 && spotById.size === 0
				? 'No spot locations could be resolved from parkour.spot. Check PARKOUR_SPOT_API_KEY and/or parkour_spot_cache.'
				: null;

		return {
			mapData: {
				points,
				totalSpotChapters: rows.length,
				totalSpotsAvailable: rankedSpotIds.length,
				hiddenSpotCount,
				totalVideosAvailable: uniqueMediaKeys.size,
				maxVideosPerSpot: MAX_VIDEOS_PER_SPOT
			} satisfies MapData,
			loadError
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : 'Failed to load map data';
		console.error('[video-map] Failed to load map data:', message);
		return {
			mapData: createEmptyMapData(),
			loadError: message
		};
	}
};