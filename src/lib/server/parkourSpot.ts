import { env } from '$env/dynamic/private';
import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { normalizeParkourSpotPayload } from '$lib/server/parkourSpotPayload';
import { asTrimmedString, normalizeParkourSpotId } from '$lib/utils';

const API_BASE = 'https://parkour.spot/api/v1';
const MAX_DUPLICATE_DEPTH = 10;
const SPOT_CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30;

let spotCacheTableUnavailable = false;

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

function isMissingRelationError(error: unknown, relation: string): boolean {
	const message = String((error as any)?.message ?? error ?? '').toLowerCase();
	const relationName = relation.toLowerCase();
	return message.includes(relationName) && (message.includes('does not exist') || message.includes('relation'));
}

function shouldDisableSpotCache(error: unknown): boolean {
	if (isMissingRelationError(error, 'parkour_spot_cache')) return true;
	const message = String((error as any)?.message ?? error ?? '').toLowerCase();
	return message.includes('supabase_service_role_key') || message.includes('service role');
}

type SpotCacheEntry = {
	payload: unknown;
	fetchedAtMs: number | null;
};

async function readSpotCacheEntry(spotId: string): Promise<SpotCacheEntry | null> {
	if (spotCacheTableUnavailable) return null;

	try {
		const supabase = createSupabaseServiceClient();
		const { data, error } = await (supabase as any)
			.from('parkour_spot_cache')
			.select('payload, fetched_at')
			.eq('spot_id', spotId)
			.maybeSingle();

		if (error) {
			if (shouldDisableSpotCache(error)) {
				spotCacheTableUnavailable = true;
			}
			return null;
		}

		const payload = data?.payload;
		if (!payload) return null;

		const fetchedAtRaw = String(data?.fetched_at ?? '');
		const parsed = Date.parse(fetchedAtRaw);

		return {
			payload,
			fetchedAtMs: Number.isFinite(parsed) ? parsed : null
		};
	} catch (error: unknown) {
		if (shouldDisableSpotCache(error)) {
			spotCacheTableUnavailable = true;
		}
		return null;
	}
}

async function writeSpotCacheEntry(spotId: string, payload: unknown): Promise<void> {
	if (spotCacheTableUnavailable) return;

	try {
		const supabase = createSupabaseServiceClient();
		const normalized = normalizeParkourSpotPayload(payload, spotId);
		const resolvedSpotId = normalizeResolvedSpotId(payload as any, spotId);
		const nowIso = new Date().toISOString();

		const baseRow = {
			resolved_spot_id: resolvedSpotId,
			name: normalized?.name ?? null,
			lat: normalized?.lat ?? null,
			lng: normalized?.lng ?? null,
			payload,
			fetched_at: nowIso
		};

		const rows = [
			{ spot_id: spotId, ...baseRow },
			...(resolvedSpotId && resolvedSpotId !== spotId ? [{ spot_id: resolvedSpotId, ...baseRow }] : [])
		];

		for (const row of rows) {
			const { error } = await (supabase as any)
				.from('parkour_spot_cache')
				.upsert(row, { onConflict: 'spot_id' });

			if (error) {
				if (shouldDisableSpotCache(error)) {
					spotCacheTableUnavailable = true;
				}
				return;
			}
		}
	} catch (error: unknown) {
		if (shouldDisableSpotCache(error)) {
			spotCacheTableUnavailable = true;
		}
	}
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
	const normalizedSpotId = normalizeParkourSpotId(id) ?? id;

	const cachedEntry = await readSpotCacheEntry(normalizedSpotId);
	if (
		cachedEntry?.payload &&
		cachedEntry.fetchedAtMs !== null &&
		Date.now() - cachedEntry.fetchedAtMs <= SPOT_CACHE_TTL_MS
	) {
		return cachedEntry.payload;
	}

	const res = await parkourSpotFetch(`/spots/${encodeURIComponent(normalizedSpotId)}`);
	const data = await res.json().catch(() => null);
	if (!res.ok) {
		if (cachedEntry?.payload) {
			// Fallback to stale cache when upstream is temporarily unavailable.
			return cachedEntry.payload;
		}
		const message = (data as any)?.error || (data as any)?.message || `parkour.spot error ${res.status}`;
		throw new Error(message);
	}

	await writeSpotCacheEntry(normalizedSpotId, data);
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
