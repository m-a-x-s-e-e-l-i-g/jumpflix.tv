import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { fetchSpotById, resolveSpotIds } from '$lib/server/parkourSpot';
import { asTrimmedString, asSafeInt, normalizeParkourSpotId } from '$lib/utils';

export type SpotInfo = {
	id: string;
	name: string;
	lat: number;
	lng: number;
	countries?: SpotCountry[];
};

export type SpotCountry = {
	code?: string | null;
	name?: string | null;
};

export type ApprovedSpotChapter = {
	suggestionId: number;
	spotId: string;
	startSeconds: number;
	endSeconds: number;
	startTimecode?: string | null;
	endTimecode?: string | null;
	note?: string | null;
	playbackKey?: string | null;
	spot?: SpotInfo | null;
};

function extractCountryNameFromAddress(raw: unknown): string | null {
	if (typeof raw !== 'string') return null;
	const parts = raw
		.split(',')
		.map((part) => part.trim())
		.filter(Boolean);
	if (parts.length < 2) return null;
	const last = parts[parts.length - 1];
	if (!/[A-Za-z]/.test(last)) return null;
	return last;
}

function normalizeSpotCountry(raw: any): SpotCountry | null {
	if (!raw) return null;

	if (typeof raw === 'string') {
		const trimmed = raw.trim();
		if (!trimmed) return null;
		if (/^[A-Za-z]{2}$/.test(trimmed)) {
			return { code: trimmed.toUpperCase() };
		}
		const name = extractCountryNameFromAddress(trimmed) ?? trimmed;
		return name ? { name } : null;
	}

	if (typeof raw !== 'object' || Array.isArray(raw)) return null;

	const code = asTrimmedString(raw?.code ?? raw?.countryCode ?? raw?.country_code ?? raw?.isoCode ?? raw?.iso_code);
	const name = asTrimmedString(raw?.name ?? raw?.countryName ?? raw?.country_name ?? raw?.label ?? raw?.title);

	if (!code && !name) return null;
	return {
		code: code ? code.toUpperCase() : null,
		name: name ?? null
	};
}

function extractSpotCountries(raw: any): SpotCountry[] {
	const primaryCode = asTrimmedString(
		raw?.countryCode ?? raw?.country_code ?? raw?.country?.code ?? raw?.address?.countryCode ?? raw?.address?.country_code
	);
	const primaryName =
		asTrimmedString(raw?.countryName ?? raw?.country_name ?? raw?.country?.name) ??
		extractCountryNameFromAddress(raw?.address);

	const candidates = [
		primaryCode || primaryName
			? {
				...(primaryCode ? { code: primaryCode } : {}),
				...(primaryName ? { name: primaryName } : {})
			}
			: null,
		raw?.countries,
		raw?.country,
		raw?.location?.countries,
		raw?.location?.country,
		raw?.location?.countryName,
		raw?.location?.country_name,
		raw?.location?.countryCode,
		raw?.location?.country_code,
		raw?.address?.country,
		raw?.address?.countryName,
		raw?.address?.country_name,
		raw?.address?.countryCode,
		raw?.address?.country_code,
		raw?.geocoding?.country,
		raw?.geocoding?.countryName,
		raw?.geocoding?.country_name,
		raw?.geocoding?.countryCode,
		raw?.geocoding?.country_code,
		raw?.reverseGeocode?.country,
		raw?.reverseGeocode?.countryName,
		raw?.reverseGeocode?.country_name,
		raw?.reverseGeocode?.countryCode,
		raw?.reverseGeocode?.country_code
	];

	const out: SpotCountry[] = [];
	const seen = new Set<string>();

	for (const candidate of candidates) {
		const items = Array.isArray(candidate) ? candidate : candidate ? [candidate] : [];
		for (const item of items) {
			const normalized = normalizeSpotCountry(item);
			if (!normalized) continue;
			const key = `${normalized.code ?? ''}|${(normalized.name ?? '').toLowerCase()}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(normalized);
		}
	}

	return out;
}

export function collectSpotCountries(spots: Array<SpotInfo | null | undefined>): SpotCountry[] {
	const out: SpotCountry[] = [];
	const seen = new Set<string>();

	for (const spot of spots) {
		for (const country of spot?.countries ?? []) {
			const key = `${country.code ?? ''}|${(country.name ?? '').toLowerCase()}`;
			if (seen.has(key)) continue;
			seen.add(key);
			out.push(country);
		}
	}

	return out;
}

function normalizeSpot(raw: any, spotIdFallback?: string): SpotInfo | null {
	const id = asTrimmedString(raw?.id) ?? asTrimmedString(raw?.spotId) ?? spotIdFallback ?? null;
	if (!id) return null;
	const name =
		asTrimmedString(raw?.name) ??
		asTrimmedString(raw?.title) ??
		asTrimmedString(raw?.displayName) ??
		id;

	const latRaw = raw?.lat ?? raw?.latitude ?? raw?.location?.lat ?? raw?.location?.latitude;
	const lngRaw = raw?.lng ?? raw?.lon ?? raw?.longitude ?? raw?.location?.lng ?? raw?.location?.longitude;
	const lat = typeof latRaw === 'number' ? latRaw : Number(String(latRaw ?? ''));
	const lng = typeof lngRaw === 'number' ? lngRaw : Number(String(lngRaw ?? ''));
	if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
	const countries = extractSpotCountries(raw);

	return { id, name, lat, lng, ...(countries.length ? { countries } : {}) };
}

function normalizeChapterFromSpotChapterRow(row: any): ApprovedSpotChapter | null {
	const id = Number(row?.id);
	if (!Number.isFinite(id)) return null;

	const spotIdRaw = asTrimmedString(row?.spot_id ?? row?.spotId);
	const spotId = spotIdRaw ? normalizeParkourSpotId(spotIdRaw) : null;
	const startSeconds = asSafeInt(row?.start_seconds ?? row?.startSeconds);
	const endSeconds = asSafeInt(row?.end_seconds ?? row?.endSeconds);
	if (!spotId || startSeconds === null || endSeconds === null) return null;
	if (endSeconds <= startSeconds) return null;

	const playbackKey = asTrimmedString(row?.playback_key ?? row?.playbackKey);

	return {
		suggestionId: id,
		spotId,
		startSeconds,
		endSeconds,
		startTimecode: null,
		endTimecode: null,
		note: null,
		playbackKey,
		spot: null
	};
}

export type ApprovedSpotChaptersQuery = {
	mediaId: number;
	mediaType: 'movie' | 'series';
	playbackKey?: string | null;
};

type SpotChapterRow = {
	id: number;
	spot_id: string;
	media_id?: number;
	media_type?: 'movie' | 'series';
	playback_key?: string | null;
	start_seconds?: number;
	end_seconds?: number;
};

export async function canonicalizeSpotChapterRows(rows: SpotChapterRow[]): Promise<Map<number, string>> {
	const normalizedRows = rows.filter((row) => Number.isFinite(Number(row?.id)) && !!normalizeParkourSpotId(row?.spot_id));
	if (normalizedRows.length === 0) return new Map<number, string>();

	const supabase = createSupabaseServiceClient();
	const resolvedSpotIds = await resolveSpotIds(
		normalizedRows
			.map((row) => normalizeParkourSpotId(row.spot_id))
			.filter((spotId): spotId is string => !!spotId)
	);

	const updatedSpotIds = new Map<number, string>();
	await Promise.all(
		normalizedRows.map(async (row) => {
			const originalSpotId = normalizeParkourSpotId(row.spot_id);
			if (!originalSpotId) return;
			const finalSpotId = resolvedSpotIds.get(originalSpotId) ?? originalSpotId;
			updatedSpotIds.set(Number(row.id), finalSpotId);

			if (finalSpotId === originalSpotId) return;

			await (supabase as any).from('spot_chapters').update({ spot_id: finalSpotId }).eq('id', row.id);
		})
	);

	return updatedSpotIds;
}

export async function loadApprovedSpotChapters(
	query: ApprovedSpotChaptersQuery
): Promise<ApprovedSpotChapter[]> {
	const { mediaId, mediaType, playbackKey } = query;
	const supabase = createSupabaseServiceClient();

	const trimmedKey = playbackKey?.trim?.() ? String(playbackKey).trim() : null;
	if (mediaType === 'series' && !trimmedKey) return [];
	const seriesPlaybackKey = mediaType === 'series' ? trimmedKey : null;
	const moviePlaybackKey = '';

	let q = (supabase as any)
		.from('spot_chapters')
		.select('id, media_id, media_type, playback_key, spot_id, start_seconds, end_seconds, approved_at')
		.eq('media_id', mediaId)
		.eq('media_type', mediaType);

	if (mediaType === 'series') {
		if (!seriesPlaybackKey) return [];
		q = q.eq('playback_key', seriesPlaybackKey);
	} else {
		q = q.eq('playback_key', moviePlaybackKey);
	}

	const { data, error } = await q
		.order('start_seconds', { ascending: true })
		.order('end_seconds', { ascending: true })
		.limit(200);

	if (error) {
		const msg = String(error.message ?? '').toLowerCase();
		if (msg.includes('spot_chapters') && (msg.includes('does not exist') || msg.includes('relation'))) {
			return [];
		}
		throw new Error(error.message);
	}

	const raw = Array.isArray(data) ? (data as any[]) : [];
	const canonicalSpotIds = await canonicalizeSpotChapterRows(
		raw.map((row) => ({
			id: Number(row?.id),
			spot_id: String(row?.spot_id ?? ''),
			media_id: Number(row?.media_id),
			media_type: row?.media_type,
			playback_key: row?.playback_key ?? null,
			start_seconds: Number(row?.start_seconds),
			end_seconds: Number(row?.end_seconds)
		}))
	);
	const out: ApprovedSpotChapter[] = [];
	for (const row of raw) {
		const canonicalSpotId = canonicalSpotIds.get(Number(row?.id));
		const c = normalizeChapterFromSpotChapterRow({
			...row,
			spot_id: canonicalSpotId ?? row?.spot_id
		});
		if (c) out.push(c);
	}
	out.sort((a, b) => a.startSeconds - b.startSeconds || a.endSeconds - b.endSeconds);
	return out;
}

export async function hydrateSpotInfo(chapters: ApprovedSpotChapter[]): Promise<ApprovedSpotChapter[]> {
	const ids = Array.from(new Set(chapters.map((c) => c.spotId)));
	const spotById = new Map<string, SpotInfo | null>();

	await Promise.all(
		ids.map(async (id) => {
			try {
				const raw = await fetchSpotById(id);
				spotById.set(id, normalizeSpot(raw as any, id));
			} catch {
				spotById.set(id, null);
			}
		})
	);

	return chapters.map((c) => ({ ...c, spot: spotById.get(c.spotId) ?? null }));
}

export function vttTimestamp(seconds: number): string {
	const s = Math.max(0, seconds);
	const totalMs = Math.floor(s * 1000);
	const ms = totalMs % 1000;
	const totalSeconds = Math.floor(totalMs / 1000);
	const sec = totalSeconds % 60;
	const totalMinutes = Math.floor(totalSeconds / 60);
	const min = totalMinutes % 60;
	const hr = Math.floor(totalMinutes / 60);
	return `${String(hr).padStart(2, '0')}:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${String(ms).padStart(3, '0')}`;
}

export function asVtt(chapters: ApprovedSpotChapter[]): string {
	const lines: string[] = ['WEBVTT', ''];
	let cue = 1;
	for (const c of chapters) {
		const title = (c.spot?.name ?? `Spot ${c.spotId}`).replace(/[\r\n]+/g, ' ').trim();
		// Use cue identifier to carry the chapter + spot ids for in-player linking/editing.
		// Format: chapter:<spotChapterId>:spot:<spotId>:<n>
		lines.push(`chapter:${c.suggestionId}:spot:${c.spotId}:${cue++}`);
		lines.push(`${vttTimestamp(c.startSeconds)} --> ${vttTimestamp(c.endSeconds)}`);
		lines.push(title || `Spot ${c.spotId}`);
		lines.push('');
	}
	return lines.join('\n');
}
