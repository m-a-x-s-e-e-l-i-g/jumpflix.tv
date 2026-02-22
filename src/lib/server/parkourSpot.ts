import { env } from '$env/dynamic/private';

const API_BASE = 'https://parkour.spot/api/v1';

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

export async function fetchSpotById(spotId: string): Promise<unknown> {
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
