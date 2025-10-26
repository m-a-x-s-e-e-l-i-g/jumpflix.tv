/**
 * Watch History Service
 * Manages playback progress and watched state in localStorage
 */

import { browser } from '$app/environment';

export interface WatchProgress {
	mediaId: string;
	type: 'movie' | 'series' | 'episode';
	position: number; // seconds
	duration: number; // seconds
	percent: number; // 0-100
	isWatched: boolean;
	watchedAt: string; // ISO timestamp
}

const STORAGE_KEY = 'jumpflix-watch-history';
const WATCHED_THRESHOLD = 85; // percent
const RESUME_OFFSET = 1; // seconds to subtract when resuming
const END_CLAMP_OFFSET = 15; // max seconds from end for resume

/**
 * Get all watch history from localStorage
 */
function getAllProgress(): Map<string, WatchProgress> {
	if (!browser) return new Map();
	try {
		const data = localStorage.getItem(STORAGE_KEY);
		if (!data) return new Map();
		const obj = JSON.parse(data);
		return new Map(Object.entries(obj));
	} catch {
		return new Map();
	}
}

/**
 * Save all watch history to localStorage
 */
function saveAllProgress(progressMap: Map<string, WatchProgress>): void {
	if (!browser) return;
	try {
		const obj = Object.fromEntries(progressMap);
		localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
	} catch (e) {
		console.error('Failed to save watch progress:', e);
	}
}

/**
 * Get watch progress for a specific media item
 */
export function getWatchProgress(mediaId: string): WatchProgress | null {
	const allProgress = getAllProgress();
	return allProgress.get(mediaId) || null;
}

/**
 * Update watch progress for a media item
 */
export function updateWatchProgress(
	mediaId: string,
	type: 'movie' | 'series' | 'episode',
	position: number,
	duration: number
): WatchProgress {
	const allProgress = getAllProgress();
	
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
	
	allProgress.set(mediaId, progress);
	saveAllProgress(allProgress);
	
	return progress;
}

/**
 * Mark a media item as watched or unwatched manually
 */
export function setWatchedStatus(
	mediaId: string,
	type: 'movie' | 'series' | 'episode',
	watched: boolean,
	duration?: number
): WatchProgress {
	const allProgress = getAllProgress();
	const existing = allProgress.get(mediaId);
	
	const progress: WatchProgress = {
		mediaId,
		type,
		position: watched ? 0 : (existing?.position || 0),
		duration: duration || existing?.duration || 0,
		percent: watched ? 100 : (existing?.percent || 0),
		isWatched: watched,
		watchedAt: new Date().toISOString()
	};
	
	allProgress.set(mediaId, progress);
	saveAllProgress(allProgress);
	
	return progress;
}

/**
 * Get resume position for a media item
 * Returns null if should start from beginning
 * Clamps to duration - END_CLAMP_OFFSET to avoid ending right away
 */
export function getResumePosition(mediaId: string, duration: number): number | null {
	const progress = getWatchProgress(mediaId);
	if (!progress || progress.percent >= WATCHED_THRESHOLD) {
		return null; // Start from beginning
	}
	
	// Resume from saved position minus offset
	let resumePos = Math.max(0, progress.position - RESUME_OFFSET);
	
	// Clamp to avoid resuming too close to the end
	const maxResumePos = Math.max(0, duration - END_CLAMP_OFFSET);
	resumePos = Math.min(resumePos, maxResumePos);
	
	return resumePos;
}

/**
 * Clear watch progress for a specific media item
 */
export function clearWatchProgress(mediaId: string): void {
	if (!browser) return;
	const allProgress = getAllProgress();
	allProgress.delete(mediaId);
	saveAllProgress(allProgress);
}

/**
 * Clear all watch history
 */
export function clearAllWatchProgress(): void {
	if (!browser) return;
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch (e) {
		console.error('Failed to clear watch history:', e);
	}
}

/**
 * Get all watch progress items (for potential future use)
 */
export function getAllWatchProgress(): WatchProgress[] {
	const allProgress = getAllProgress();
	return Array.from(allProgress.values());
}
