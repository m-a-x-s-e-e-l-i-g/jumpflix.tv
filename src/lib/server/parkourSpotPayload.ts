import { asTrimmedString } from '$lib/utils';

type Coordinates = { lat: number; lng: number };

export type NormalizedParkourSpot = {
	id: string;
	name: string;
	lat: number;
	lng: number;
	raw: unknown;
};

function asFiniteNumber(value: unknown): number | null {
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : null;
	}
	if (typeof value === 'string') {
		const parsed = Number(value.trim());
		return Number.isFinite(parsed) ? parsed : null;
	}
	return null;
}

function isValidLatLng(lat: number, lng: number): boolean {
	return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function coordinatesFromTuple(values: unknown): Coordinates | null {
	if (!Array.isArray(values) || values.length < 2) return null;

	const first = asFiniteNumber(values[0]);
	const second = asFiniteNumber(values[1]);
	if (first === null || second === null) return null;

	// GeoJSON is [lng, lat].
	if (isValidLatLng(second, first)) {
		return { lat: second, lng: first };
	}

	// Fallback for APIs returning [lat, lng].
	if (isValidLatLng(first, second)) {
		return { lat: first, lng: second };
	}

	return null;
}

function extractCoordinates(raw: any): Coordinates | null {
	const directLat =
		asFiniteNumber(raw?.lat) ??
		asFiniteNumber(raw?.latitude) ??
		asFiniteNumber(raw?.location?.lat) ??
		asFiniteNumber(raw?.location?.latitude) ??
		asFiniteNumber(raw?.center?.lat) ??
		asFiniteNumber(raw?.center?.latitude) ??
		asFiniteNumber(raw?.position?.lat) ??
		asFiniteNumber(raw?.position?.latitude) ??
		asFiniteNumber(raw?.geo?.lat) ??
		asFiniteNumber(raw?.geo?.latitude);

	const directLng =
		asFiniteNumber(raw?.lng) ??
		asFiniteNumber(raw?.lon) ??
		asFiniteNumber(raw?.long) ??
		asFiniteNumber(raw?.longitude) ??
		asFiniteNumber(raw?.location?.lng) ??
		asFiniteNumber(raw?.location?.lon) ??
		asFiniteNumber(raw?.location?.long) ??
		asFiniteNumber(raw?.location?.longitude) ??
		asFiniteNumber(raw?.center?.lng) ??
		asFiniteNumber(raw?.center?.longitude) ??
		asFiniteNumber(raw?.position?.lng) ??
		asFiniteNumber(raw?.position?.longitude) ??
		asFiniteNumber(raw?.geo?.lng) ??
		asFiniteNumber(raw?.geo?.longitude);

	if (directLat !== null && directLng !== null && isValidLatLng(directLat, directLng)) {
		return { lat: directLat, lng: directLng };
	}

	const tupleCandidates = [
		raw?.coordinates,
		raw?.location?.coordinates,
		raw?.center?.coordinates,
		raw?.geometry?.coordinates,
		raw?.geo?.coordinates,
		raw?.point?.coordinates,
		raw?.position?.coordinates,
		raw?.location
	];

	for (const candidate of tupleCandidates) {
		const parsed = coordinatesFromTuple(candidate);
		if (parsed) return parsed;
	}

	return null;
}

export function unwrapParkourSpotPayload(payload: unknown): any {
	if (!payload || typeof payload !== 'object') return payload;

	const stack: any[] = [payload];
	const visited = new Set<any>();

	while (stack.length > 0) {
		const current = stack.shift();
		if (!current || typeof current !== 'object' || visited.has(current)) continue;
		visited.add(current);

		const currentCoordinates = extractCoordinates(current);
		if (currentCoordinates) return current;

		const wrappers = [current?.spot, current?.data, current?.result, current?.item, current?.attributes];
		for (const wrapper of wrappers) {
			if (!wrapper) continue;
			if (Array.isArray(wrapper)) {
				if (wrapper.length === 1) stack.push(wrapper[0]);
				continue;
			}
			stack.push(wrapper);
		}
	}

	return payload;
}

export function normalizeParkourSpotPayload(
	payload: unknown,
	fallbackSpotId?: string
): NormalizedParkourSpot | null {
	const raw = unwrapParkourSpotPayload(payload) as any;
	if (!raw || typeof raw !== 'object') return null;

	const id =
		asTrimmedString(raw?.id) ??
		asTrimmedString(raw?.spotId) ??
		asTrimmedString(raw?.spot_id) ??
		asTrimmedString(raw?.uuid) ??
		asTrimmedString(raw?.properties?.id) ??
		asTrimmedString(raw?.properties?.spotId) ??
		asTrimmedString(fallbackSpotId) ??
		null;
	if (!id) return null;

	const name =
		asTrimmedString(raw?.name) ??
		asTrimmedString(raw?.title) ??
		asTrimmedString(raw?.displayName) ??
		asTrimmedString(raw?.spotName) ??
		asTrimmedString(raw?.label) ??
		asTrimmedString(raw?.properties?.name) ??
		asTrimmedString(raw?.properties?.title) ??
		id;

	const coordinates = extractCoordinates(raw);
	if (!coordinates) return null;

	return {
		id,
		name,
		lat: coordinates.lat,
		lng: coordinates.lng,
		raw
	};
}