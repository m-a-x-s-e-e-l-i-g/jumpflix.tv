import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { fetchSpotById } from '$lib/server/parkourSpot';

export type SpotInfo = {
	id: string;
	name: string;
	lat: number;
	lng: number;
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

function asTrimmedString(value: unknown): string | null {
	if (typeof value !== 'string') return null;
	const trimmed = value.trim();
	return trimmed ? trimmed : null;
}

function asSafeInt(value: unknown): number | null {
	if (value === null || value === undefined) return null;
	const n = typeof value === 'number' ? value : Number(String(value));
	if (!Number.isFinite(n)) return null;
	return Math.max(0, Math.floor(n));
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

	return { id, name, lat, lng };
}

function normalizeChapterFromSpotChapterRow(row: any): ApprovedSpotChapter | null {
	const id = Number(row?.id);
	if (!Number.isFinite(id)) return null;

	const spotId = asTrimmedString(row?.spot_id ?? row?.spotId);
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
	const out: ApprovedSpotChapter[] = [];
	for (const row of raw) {
		const c = normalizeChapterFromSpotChapterRow(row);
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
