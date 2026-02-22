import { browser } from '$app/environment';
import type { User } from '@supabase/supabase-js';
import { get, writable } from 'svelte/store';
import { supabase } from '$lib/supabaseClient';
import { user as userStore } from '$lib/stores/authStore';
import type { Database } from '$lib/supabase/types';

export interface WatchProgress {
	mediaId: string;
	type: 'movie' | 'series' | 'episode';
	position: number;
	duration: number;
	percent: number;
	isWatched: boolean;
	watchedAt: string;
}

const WATCHED_THRESHOLD = 85;
const RESUME_OFFSET = 1;
const END_CLAMP_OFFSET = 15;
const FLUSH_DEBOUNCE_MS = 2500;
const BACKGROUND_FLUSH_INTERVAL_MS = 15000;

export const PROGRESS_CHANGE_EVENT = 'jumpflix-progress-change';

// Monotonic-ish counter to allow components to react to watch-history cache updates
// even if they missed the window event during initial load.
export const watchHistoryVersion = writable(0);

export type WatchProgressEventOrigin = 'local' | 'remote';

export type WatchProgressEventDetail =
	| { kind: 'update'; progress: WatchProgress; origin: WatchProgressEventOrigin }
	| {
			kind: 'delete';
			mediaId: string;
			mediaType?: WatchProgress['type'];
			watchedAt?: string;
			origin: WatchProgressEventOrigin;
	  }
	| { kind: 'clear-all'; origin: WatchProgressEventOrigin };

type PendingRecord =
	| { kind: 'upsert'; progress: WatchProgress }
	| { kind: 'delete'; mediaId: string };

type WatchHistoryInsert = Database['public']['Tables']['watch_history']['Insert'];

const progressCache = new Map<string, WatchProgress>();
const pending = new Map<string, PendingRecord>();
let pendingClearAll = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let flushPromise: Promise<void> | null = null;
let initialized = false;
let currentUserId: string | null = null;
let unsubscribeUser: (() => void) | null = null;
let backgroundFlushTimer: ReturnType<typeof setInterval> | null = null;
let cleanupVisibilityHandlers: (() => void) | null = null;

function ensureVisibilityHandlers() {
	if (!browser || cleanupVisibilityHandlers) return;
	const doc = document;
	const handleVisibilityChange = () => {
		if (doc.visibilityState === 'hidden') {
			void flushWatchHistoryNow();
		}
	};
	const handlePageHide = () => {
		void flushWatchHistoryNow(true);
	};
	doc.addEventListener('visibilitychange', handleVisibilityChange);
	window.addEventListener('pagehide', handlePageHide);
	cleanupVisibilityHandlers = () => {
		doc.removeEventListener('visibilitychange', handleVisibilityChange);
		window.removeEventListener('pagehide', handlePageHide);
	};
}

function clearVisibilityHandlers() {
	cleanupVisibilityHandlers?.();
	cleanupVisibilityHandlers = null;
}

function startBackgroundFlushLoop() {
	if (!browser || backgroundFlushTimer) return;
	backgroundFlushTimer = setInterval(() => {
		if (pending.size === 0 && !pendingClearAll) {
			stopBackgroundFlushLoop();
			return;
		}
		void flushPending();
	}, BACKGROUND_FLUSH_INTERVAL_MS);
}

function stopBackgroundFlushLoop() {
	if (!backgroundFlushTimer) return;
	clearInterval(backgroundFlushTimer);
	backgroundFlushTimer = null;
}

function dispatchWatchProgressEvent(detail: WatchProgressEventDetail) {
	if (!browser) return;
	window.dispatchEvent(new CustomEvent(PROGRESS_CHANGE_EVENT, { detail }));
}

function bumpWatchHistoryVersion() {
	watchHistoryVersion.update((v) => v + 1);
}

function isTrackingEnabled(): boolean {
	return browser && Boolean(currentUserId);
}

export function initWatchHistory(): () => void {
	if (!browser) return () => {};
	if (initialized) return () => {};
	initialized = true;
	ensureVisibilityHandlers();

	unsubscribeUser = userStore.subscribe((value) => {
		void handleUserChange(value);
	});

	void handleUserChange(get(userStore));

	return () => {
		unsubscribeUser?.();
		unsubscribeUser = null;
		initialized = false;
		currentUserId = null;
		progressCache.clear();
		pending.clear();
		pendingClearAll = false;
		bumpWatchHistoryVersion();
		clearFlushTimer();
		stopBackgroundFlushLoop();
		clearVisibilityHandlers();
	};
}

async function handleUserChange(userValue: User | null) {
	const nextUserId = userValue?.id ?? null;
	if (nextUserId === currentUserId) return;

	await flushPending(true);

	currentUserId = nextUserId;
	progressCache.clear();
	pending.clear();
	pendingClearAll = false;
	clearFlushTimer();
	stopBackgroundFlushLoop();
	bumpWatchHistoryVersion();
	dispatchWatchProgressEvent({ kind: 'clear-all', origin: 'remote' });

	if (!currentUserId) return;

	const { data, error } = await supabase
		.from('watch_history')
		.select(
			'user_id, media_id, media_type, position_seconds, duration_seconds, percent_watched, is_watched, watched_at'
		)
		.eq('user_id', currentUserId)
		.eq('status', 'active');

	if (error) {
		console.error('Failed to load watch history:', error);
		return;
	}

	for (const row of data ?? []) {
		const progress = fromRow(row);
		progressCache.set(progress.mediaId, progress);
		dispatchWatchProgressEvent({ kind: 'update', progress, origin: 'remote' });
	}
	bumpWatchHistoryVersion();
}

function ensureInitialized() {
	if (!browser) return;
	if (initialized) return;
	initWatchHistory();
}

function fromRow(row: {
	media_id: string;
	media_type: string;
	position_seconds: number | null;
	duration_seconds: number | null;
	percent_watched: number | null;
	is_watched: boolean | null;
	watched_at: string | null;
}): WatchProgress {
	return {
		mediaId: row.media_id,
		type: (row.media_type as WatchProgress['type']) ?? 'movie',
		position: Math.max(0, row.position_seconds ?? 0),
		duration: Math.max(0, row.duration_seconds ?? 0),
		percent: Math.min(100, Math.max(0, row.percent_watched ?? 0)),
		isWatched: Boolean(row.is_watched),
		watchedAt: row.watched_at ?? new Date().toISOString()
	};
}

function toRow(progress: WatchProgress): WatchHistoryInsert {
	if (!currentUserId)
		throw new Error('Cannot persist watch progress without an authenticated user');
	const row: Database['public']['Tables']['watch_history']['Insert'] = {
		user_id: currentUserId,
		media_id: progress.mediaId,
		media_type: progress.type,
		position_seconds: Math.round(progress.position),
		duration_seconds: Math.round(progress.duration),
		percent_watched: progress.percent,
		is_watched: progress.isWatched,
		status: 'active',
		watched_at: progress.watchedAt
	};
	return row;
}

export function parseWatchedAt(value: string | undefined | null): number {
	if (!value) return 0;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : 0;
}

export function pickLatestProgress(
	current: WatchProgress | null,
	candidate: WatchProgress
): WatchProgress {
	if (!current) return candidate;
	const currentTime = parseWatchedAt(current.watchedAt);
	const candidateTime = parseWatchedAt(candidate.watchedAt);
	if (candidateTime > currentTime) return candidate;
	if (candidateTime < currentTime) return current;
	return candidate.percent > current.percent ? candidate : current;
}

function progressMatchesBaseId(entryId: string, baseId: string): boolean {
	if (entryId === baseId) return true;
	if (!baseId) return false;
	return entryId.startsWith(`${baseId}:`);
}

export function getWatchProgress(mediaId: string): WatchProgress | null {
	ensureInitialized();
	return progressCache.get(mediaId) ?? null;
}

export function updateWatchProgress(
	mediaId: string,
	type: 'movie' | 'series' | 'episode',
	position: number,
	duration: number
): WatchProgress {
	ensureInitialized();

	const percent = duration > 0 ? Math.min(100, (position / duration) * 100) : 0;
	const isWatched = percent >= WATCHED_THRESHOLD;

	const progress: WatchProgress = {
		mediaId,
		type,
		position,
		duration,
		percent,
		isWatched,
		watchedAt: new Date().toISOString()
	};

	if (!isTrackingEnabled()) {
		return progress;
	}

	progressCache.set(mediaId, progress);
	bumpWatchHistoryVersion();
	dispatchWatchProgressEvent({ kind: 'update', progress, origin: 'local' });

	if (!currentUserId) return progress;

	queueUpsert(progress, isWatched);
	return progress;
}

export function setWatchedStatus(
	mediaId: string,
	type: 'movie' | 'series' | 'episode',
	watched: boolean,
	duration?: number
): WatchProgress {
	ensureInitialized();
	const existing = progressCache.get(mediaId);

	const progress: WatchProgress = {
		mediaId,
		type,
		position: watched ? (existing?.duration ?? duration ?? 0) : 0,
		duration: duration ?? existing?.duration ?? 0,
		percent: watched ? 100 : 0,
		isWatched: watched,
		watchedAt: new Date().toISOString()
	};

	if (!isTrackingEnabled()) {
		return progress;
	}

	progressCache.set(mediaId, progress);
	bumpWatchHistoryVersion();
	dispatchWatchProgressEvent({ kind: 'update', progress, origin: 'local' });

	if (!currentUserId) return progress;

	queueUpsert(progress, true);
	void flushWatchHistoryNow();
	return progress;
}

export function getResumePosition(mediaId: string, duration: number): number | null {
	ensureInitialized();
	const progress = progressCache.get(mediaId);
	if (!progress || progress.percent >= WATCHED_THRESHOLD) {
		return null;
	}

	let resumePos = Math.max(0, progress.position - RESUME_OFFSET);
	const maxResumePos = Math.max(0, duration - END_CLAMP_OFFSET);
	resumePos = Math.min(resumePos, maxResumePos);

	return resumePos;
}

export function clearWatchProgress(
	mediaId: string,
	options?: {
		origin?: WatchProgressEventOrigin;
		mediaType?: WatchProgress['type'];
		watchedAt?: string;
	}
): void {
	ensureInitialized();
	if (!isTrackingEnabled()) return;
	const origin = options?.origin ?? 'local';
	const existing = progressCache.get(mediaId) ?? null;
	progressCache.delete(mediaId);
	bumpWatchHistoryVersion();
	dispatchWatchProgressEvent({
		kind: 'delete',
		mediaId,
		mediaType: options?.mediaType ?? existing?.type ?? undefined,
		watchedAt: options?.watchedAt ?? existing?.watchedAt,
		origin
	});

	if (!currentUserId) return;

	pending.set(mediaId, { kind: 'delete', mediaId });
	startBackgroundFlushLoop();
	void flushWatchHistoryNow();
}

export function clearAllWatchProgress(origin: WatchProgressEventOrigin = 'local'): void {
	ensureInitialized();
	if (!isTrackingEnabled()) return;
	progressCache.clear();
	bumpWatchHistoryVersion();
	dispatchWatchProgressEvent({ kind: 'clear-all', origin });

	if (!currentUserId) return;

	pending.clear();
	pendingClearAll = true;
	startBackgroundFlushLoop();
	void flushWatchHistoryNow(true);
}

export function getAllWatchProgress(): WatchProgress[] {
	ensureInitialized();
	return Array.from(progressCache.values());
}

export interface SeriesProgressSummary {
	totalEpisodes: number | null;
	trackedEpisodes: number;
	watchedEpisodes: number;
	partiallyWatchedEpisodes: number;
	percent: number;
	isWatched: boolean;
}

export function getSeriesProgressSummary(
	baseId: string,
	options?: { totalEpisodes?: number | null }
): SeriesProgressSummary | null {
	ensureInitialized();
	if (!baseId) return null;

	const hintedTotal = options?.totalEpisodes;
	const totalEpisodes =
		typeof hintedTotal === 'number' && Number.isFinite(hintedTotal) && hintedTotal > 0
			? Math.floor(hintedTotal)
			: null;

	const prefix = `${baseId}:ep:`;
	let tracked = 0;
	let watched = 0;
	let partial = 0;
	let totalPercent = 0;

	for (const [mediaId, progress] of progressCache.entries()) {
		if (!mediaId.startsWith(prefix)) continue;
		tracked += 1;
		const clampedPercent = Math.min(100, Math.max(0, progress.percent));
		totalPercent += clampedPercent;
		if (progress.isWatched) {
			watched += 1;
		} else if (clampedPercent > 0) {
			partial += 1;
		}
	}

	const seriesEntry = progressCache.get(baseId);

	if (tracked === 0) {
		if (!seriesEntry || seriesEntry.type !== 'series') {
			return null;
		}
		const clampedSeriesPercent = Math.min(100, Math.max(0, seriesEntry.percent));
		return {
			totalEpisodes,
			trackedEpisodes: 0,
			watchedEpisodes: seriesEntry.isWatched ? (totalEpisodes ?? 0) : 0,
			partiallyWatchedEpisodes: 0,
			percent: clampedSeriesPercent,
			isWatched: seriesEntry.isWatched
		};
	}

	const denominator = totalEpisodes ?? tracked;
	if (denominator <= 0) {
		return null;
	}
	const cappedTotalPercent = Math.min(totalPercent, denominator * 100);
	const percent = Math.min(100, cappedTotalPercent / denominator);

	let isWatched = false;
	if (totalEpisodes !== null) {
		isWatched = watched >= totalEpisodes && totalEpisodes > 0;
	} else if (seriesEntry?.type === 'series') {
		isWatched = Boolean(seriesEntry.isWatched);
	} else {
		isWatched = watched >= tracked && tracked > 0;
	}

	return {
		totalEpisodes,
		trackedEpisodes: tracked,
		watchedEpisodes: watched,
		partiallyWatchedEpisodes: partial,
		percent,
		isWatched
	};
}

export function getLatestWatchProgressByBaseId(baseId: string): WatchProgress | null {
	ensureInitialized();
	if (!baseId) return null;
	let latest: WatchProgress | null = null;
	for (const [entryId, progress] of progressCache.entries()) {
		if (!progressMatchesBaseId(entryId, baseId)) continue;
		latest = pickLatestProgress(latest, progress);
	}
	return latest;
}

function queueUpsert(progress: WatchProgress, immediate = false) {
	if (!currentUserId) return;
	pending.set(progress.mediaId, { kind: 'upsert', progress });
	startBackgroundFlushLoop();
	if (immediate) {
		void flushWatchHistoryNow();
	} else {
		scheduleFlush();
	}
}

function scheduleFlush() {
	if (!currentUserId) return;
	if (flushTimer) return;
	flushTimer = setTimeout(() => {
		flushTimer = null;
		void flushPending();
	}, FLUSH_DEBOUNCE_MS);
}

function clearFlushTimer() {
	if (!flushTimer) return;
	clearTimeout(flushTimer);
	flushTimer = null;
}

async function flushPending(force = false) {
	if (!currentUserId) return;
	if (!force && pending.size === 0 && !pendingClearAll) return;
	if (flushPromise) {
		if (force) {
			await flushPromise;
		}
		return;
	}

	const payloadEntries = Array.from(pending.entries());
	const clearAll = pendingClearAll;
	pending.clear();
	pendingClearAll = false;

	flushPromise = (async () => {
		try {
			if (clearAll) {
				const { error: clearError } = await supabase
					.from('watch_history')
					.delete()
					.eq('user_id', currentUserId);
				if (clearError) throw clearError;
			}

			const upserts = [] as ReturnType<typeof toRow>[];
			const deleteIds = new Set<string>();

			for (const [, record] of payloadEntries) {
				if (record.kind === 'upsert') {
					upserts.push(toRow(record.progress));
					deleteIds.delete(record.progress.mediaId);
				} else if (!clearAll) {
					deleteIds.add(record.mediaId);
				}
			}

			if (upserts.length > 0) {
				const { error: upsertError } = await supabase
					.from('watch_history')
					.upsert(upserts, { onConflict: 'user_id,media_id' });
				if (upsertError) throw upsertError;
			}

			if (!clearAll && deleteIds.size > 0) {
				const { error: deleteError } = await supabase
					.from('watch_history')
					.delete()
					.eq('user_id', currentUserId)
					.in('media_id', Array.from(deleteIds));
				if (deleteError) throw deleteError;
			}
		} catch (err) {
			for (const [mediaId, record] of payloadEntries) {
				pending.set(mediaId, record);
			}
			pendingClearAll = pendingClearAll || clearAll;
			console.error('Failed to persist watch history:', err);
		} finally {
			flushPromise = null;
			if (pending.size === 0 && !pendingClearAll) {
				stopBackgroundFlushLoop();
			}
		}
	})();

	if (force) {
		await flushPromise;
	}
}

export function flushWatchHistoryNow(force = false): Promise<void> {
	ensureInitialized();
	clearFlushTimer();
	return flushPending(force);
}

if (browser) {
	ensureInitialized();
}
