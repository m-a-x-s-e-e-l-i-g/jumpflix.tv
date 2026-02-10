import type { ContentItem, Episode } from './types';
import { getAllWatchProgress } from './watchHistory';
import type { WatchProgress } from './watchHistory';
import { deleteRating, getMediaRatingSummary, getUserRating, saveRating } from '$lib/ratings';
import type { RatingUpdatedDetail } from '$lib/rating-events';

type RatingSummary = { averageRating: number; ratingCount: number } | null;
export type WatchProgressSnapshot = { percent: number; isWatched: boolean; position: number } | null;

export function buildBaseId(item: ContentItem | null): string | null {
	if (!item) return null;
	return `${item.type}:${item.id}`;
}

function parseWatchedAt(value: string | undefined | null): number {
	if (!value) return 0;
	const timestamp = Date.parse(value);
	return Number.isFinite(timestamp) ? timestamp : 0;
}

function pickLatestProgress(current: WatchProgress | null, candidate: WatchProgress): WatchProgress {
	if (!current) return candidate;
	const currentTime = parseWatchedAt(current.watchedAt);
	const candidateTime = parseWatchedAt(candidate.watchedAt);
	if (candidateTime > currentTime) return candidate;
	if (candidateTime < currentTime) return current;
	return candidate.percent > current.percent ? candidate : current;
}

export function buildWatchProgressMap(browser: boolean): Map<string, WatchProgress> {
	if (!browser) return new Map();
	const entries = getAllWatchProgress();
	const next = new Map<string, WatchProgress>();
	for (const entry of entries) {
		next.set(entry.mediaId, entry);
	}
	return next;
}

export function getWatchProgressForSelection(options: {
	selected: ContentItem | null;
	selectedEpisode: Episode | null;
	watchProgressMap: Map<string, WatchProgress>;
}): WatchProgressSnapshot {
	const { selected, selectedEpisode, watchProgressMap } = options;
	if (!selected) return null;

	const baseId = buildBaseId(selected);
	if (!baseId) return null;

	const candidateIds: string[] = [];

	if (selected.type === 'movie') {
		const movie = selected as any;
		if (movie.videoId) candidateIds.push(`${baseId}:yt:${movie.videoId}`);
		if (movie.vimeoId) candidateIds.push(`${baseId}:vimeo:${movie.vimeoId}`);
	}

	if (selected.type === 'series' && selectedEpisode?.id) {
		candidateIds.push(`${baseId}:ep:${selectedEpisode.id}`);
	}

	let progress: WatchProgress | null = null;
	for (const id of candidateIds) {
		progress = watchProgressMap.get(id) ?? null;
		if (progress) break;
	}

	if (!progress) {
		const basePrefix = `${baseId}:`;
		for (const entry of watchProgressMap.values()) {
			if (entry.mediaId === baseId || entry.mediaId.startsWith(basePrefix)) {
				progress = pickLatestProgress(progress, entry);
			}
		}
	}

	if (!progress) return null;
	return {
		percent: progress.percent,
		isWatched: progress.isWatched,
		position: progress.position
	};
}

export function getEpisodeWatchProgress(options: {
	browser: boolean;
	selected: ContentItem | null;
	episodeId: string;
	watchProgressMap: Map<string, WatchProgress>;
}): { isWatched: boolean; percent: number } | null {
	const { browser, selected, episodeId, watchProgressMap } = options;
	if (!browser || !selected || selected.type !== 'series') return null;
	const baseId = buildBaseId(selected);
	if (!baseId) return null;

	const fullId = `${baseId}:ep:${episodeId}`;
	const progress = watchProgressMap.get(fullId);

	if (!progress) return null;
	return {
		isWatched: progress.isWatched,
		percent: progress.percent
	};
}

export function getPreferredMovieProgressId(selected: ContentItem | null): string | null {
	if (!selected || selected.type !== 'movie') return null;
	const baseId = buildBaseId(selected);
	if (!baseId) return null;
	const movie = selected as any;
	if (movie.videoId) return `${baseId}:yt:${movie.videoId}`;
	if (movie.vimeoId) return `${baseId}:vimeo:${movie.vimeoId}`;
	return baseId;
}

export function getInitialRatingsSummary(selected: ContentItem | null): RatingSummary {
	if (!selected) return null;
	return selected.averageRating !== undefined && selected.ratingCount !== undefined
		? { averageRating: selected.averageRating, ratingCount: selected.ratingCount }
		: null;
}

export async function fetchRatings(selectedId: ContentItem['id']) {
	const [userRating, summary] = await Promise.all([
		getUserRating(selectedId),
		getMediaRatingSummary(selectedId)
	]);
	return { userRating, summary };
}

export async function updateRating(selectedId: ContentItem['id'], rating: number) {
	await saveRating(selectedId, rating);
	return getMediaRatingSummary(selectedId);
}

export async function removeRating(selectedId: ContentItem['id']) {
	await deleteRating(selectedId);
	return getMediaRatingSummary(selectedId);
}

export function applyRatingEventUpdate(
	selectedId: ContentItem['id'],
	detail?: RatingUpdatedDetail
): { rating: number | null; summary?: RatingSummary; shouldReload: boolean } | null {
	if (!detail) return null;
	const numericId = Number(selectedId);
	if (!Number.isFinite(numericId) || detail.mediaId !== numericId) return null;
	const rating = detail.rating ?? null;
	if (detail.averageRating !== undefined && detail.ratingCount !== undefined) {
		return {
			rating,
			summary: {
				averageRating: detail.averageRating,
				ratingCount: detail.ratingCount
			},
			shouldReload: false
		};
	}
	return { rating, shouldReload: true };
}
