import { env } from '$env/dynamic/private';
import { asTrimmedString, normalizeParkourSpotId } from '$lib/utils';

const API_BASE = 'https://parkour.spot/api/v1';
const MAX_DUPLICATE_DEPTH = 10;

export type ParkourSpotResolution = {
	requestedSpotId: string;
	finalSpotId: string;
	spot: unknown;
	visitedSpotIds: string[];
	wasDuplicate: boolean;
};

function requireApiKey(): string {
	const key = env.PARKOUR_SPOT_API_KEY?.trim?.();
	if (!key) {
		throw new Error('Missing PARKOUR_SPOT_API_KEY');
	}
	return key;
}

async function parkourSpotFetch(path: string, init?: RequestInit): Promise<Response> {
	const key = requireApiKey();
	const url = path.startsWith('http') ? path : `${API_BASE}${path.startsWith('/') ? '' : '/'}${path}`;
	return fetch(url, {
		...init,
		headers: {
			accept: 'application/json',
			...(init?.headers ?? {}),
			Authorization: `Bearer ${key}`
		}
	});
}


function normalizeResolvedSpotId(raw: any, fallbackSpotId: string): string {
	return normalizeParkourSpotId(raw?.id ?? raw?.spotId ?? fallbackSpotId) ?? fallbackSpotId;
}

function extractDuplicateSpotId(raw: any): string | null {
	const direct =
		asTrimmedString(raw?.duplicateOf) ??
		asTrimmedString(raw?.duplicate_of) ??
		asTrimmedString(raw?.duplicateOf?.id) ??
		asTrimmedString(raw?.duplicate_of?.id) ??
		asTrimmedString(raw?.duplicateOf?.spotId) ??
		asTrimmedString(raw?.duplicate_of?.spotId);

	return direct ? normalizeParkourSpotId(direct) : null;
}

function withResolutionMetadata(raw: unknown, resolution: ParkourSpotResolution): unknown {
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
		return raw;
	}

	return {
		...raw,
		id: resolution.finalSpotId,
		requestedSpotId: resolution.requestedSpotId,
		resolvedSpotId: resolution.finalSpotId,
		wasDuplicate: resolution.wasDuplicate,
		visitedSpotIds: resolution.visitedSpotIds
	};
}

async function fetchSpotByIdRaw(spotId: string): Promise<unknown> {
	const id = String(spotId ?? '').trim();
	if (!id) throw new Error('Missing spotId');

	const res = await parkourSpotFetch(`/spots/${encodeURIComponent(id)}`);
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		const message = (data as any)?.error || (data as any)?.message || `parkour.spot error ${res.status}`;
		throw new Error(message);
	}
	return data;
}

export async function resolveSpotById(spotId: string): Promise<ParkourSpotResolution> {
	const requestedSpotId = normalizeParkourSpotId(spotId);
	if (!requestedSpotId) throw new Error('Missing spotId');

	const visitedSpotIds: string[] = [];
	const seen = new Set<string>();
	let currentSpotId = requestedSpotId;
	let finalSpot: unknown = null;

	for (let depth = 0; depth < MAX_DUPLICATE_DEPTH; depth += 1) {
		if (seen.has(currentSpotId)) break;
		seen.add(currentSpotId);
		visitedSpotIds.push(currentSpotId);

		const raw = await fetchSpotByIdRaw(currentSpotId);
		const resolvedCurrentId = normalizeResolvedSpotId(raw as any, currentSpotId);
		const duplicateSpotId = extractDuplicateSpotId(raw as any);

		if (!duplicateSpotId || duplicateSpotId === resolvedCurrentId || seen.has(duplicateSpotId)) {
			finalSpot = raw;
			currentSpotId = resolvedCurrentId;
			break;
		}

		currentSpotId = duplicateSpotId;
		finalSpot = raw;
	}

	const finalSpotId =
		normalizeResolvedSpotId(finalSpot as any, currentSpotId) ?? visitedSpotIds[visitedSpotIds.length - 1];

	return {
		requestedSpotId,
		finalSpotId,
		spot: withResolutionMetadata(finalSpot, {
			requestedSpotId,
			finalSpotId,
			spot: finalSpot,
			visitedSpotIds,
			wasDuplicate: finalSpotId !== requestedSpotId
		}),
		visitedSpotIds,
		wasDuplicate: finalSpotId !== requestedSpotId
	};
}

export async function resolveSpotId(spotId: string): Promise<string> {
	const resolution = await resolveSpotById(spotId);
	return resolution.finalSpotId;
}

export async function resolveSpotIds(spotIds: string[]): Promise<Map<string, string>> {
	const normalizedIds = Array.from(
		new Set(spotIds.map((spotId) => normalizeParkourSpotId(spotId)).filter((spotId): spotId is string => !!spotId))
	);
	const resolvedEntries = await Promise.all(
		normalizedIds.map(async (spotId) => {
			try {
				return [spotId, await resolveSpotId(spotId)] as const;
			} catch {
				return [spotId, spotId] as const;
			}
		})
	);

	return new Map<string, string>(resolvedEntries);
}

export async function fetchSpotById(spotId: string): Promise<unknown> {
	const resolution = await resolveSpotById(spotId);
	return resolution.spot;
}

export type SpotSearchParams = {
	q?: string;
	minLat?: string;
	maxLat?: string;
	minLng?: string;
	maxLng?: string;
	limit?: string;
};

export async function searchSpots(params: SpotSearchParams): Promise<unknown> {
	const url = new URL(`${API_BASE}/spots`);
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null) continue;
		const trimmed = String(value).trim();
		if (!trimmed) continue;
		url.searchParams.set(key, trimmed);
	}

	const res = await parkourSpotFetch(url.toString());
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		const message = (data as any)?.error || (data as any)?.message || `parkour.spot error ${res.status}`;
		throw new Error(message);
	}
	return data;
}
