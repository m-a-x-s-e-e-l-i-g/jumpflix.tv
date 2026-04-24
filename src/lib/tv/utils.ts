import { getFeedBySlug } from './feeds';
import type { ContentItem, Movie, SortBy, TvState, VideoTrack } from './types';

// Deterministic seeded shuffle (xmur3 + sfc32)
function xmur3(str: string) {
	let h = 1779033703 ^ str.length;
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
		h = (h << 13) | (h >>> 19);
	}
	return function () {
		h = Math.imul(h ^ (h >>> 16), 2246822507);
		h = Math.imul(h ^ (h >>> 13), 3266489909);
		h ^= h >>> 16;
		return h >>> 0;
	};
}

function sfc32(a: number, b: number, c: number, d: number) {
	return function () {
		a >>>= 0;
		b >>>= 0;
		c >>>= 0;
		d >>>= 0;
		let t = (a + b) | 0;
		a = b ^ (b >>> 9);
		b = (c + (c << 3)) | 0;
		c = (c << 21) | (c >>> 11);
		c = (c + t) | 0;
		d = (d + 1) | 0;
		t = (t + d) | 0;
		c = (c + t) | 0;
		return (t >>> 0) / 4294967296;
	};
}

export function createSeededRng(seed: string) {
	const seedGen = xmur3(seed);
	return sfc32(seedGen(), seedGen(), seedGen(), seedGen());
}

export function shuffleDeterministic<T>(arr: T[], rng: () => number): T[] {
	const clone = [...arr];
	for (let i = clone.length - 1; i > 0; i--) {
		const j = Math.floor(rng() * (i + 1));
		[clone[i], clone[j]] = [clone[j], clone[i]];
	}
	return clone;
}

export function buildRankMap(items: ContentItem[], seed: string) {
	const rng = createSeededRng(seed + ':' + items.length);
	const shuffled = shuffleDeterministic(items, rng);
	const map = new Map<string, number>();
	shuffled.forEach((item, i) => map.set(keyFor(item), i));
	return map;
}

export function keyFor(item: ContentItem) {
	return `${item.type}:${item.id}`;
}

export function isFamilySafeContent(item: ContentItem | null | undefined) {
	if (!item) return true;
	const hasWarnings = (item.facets?.contentWarnings?.length ?? 0) > 0;
	const isExplicit = item.explicit === true;
	return !hasWarnings && !isExplicit;
}

export function parseYear(item: ContentItem): number {
	const y = parseInt((item as any).year);
	return isNaN(y) ? 0 : y;
}

export function parseDurationToMinutes(dur?: string): number {
	if (!dur || typeof dur !== 'string') return Number.POSITIVE_INFINITY;
	let minutes = 0;
	const hMatch = dur.match(/(\d+)\s*h/i);
	const mMatch = dur.match(/(\d+)\s*m/i);
	if (hMatch) minutes += parseInt(hMatch[1]) * 60;
	if (mMatch) minutes += parseInt(mMatch[1]);
	return minutes || Number.POSITIVE_INFINITY;
}

function parseAddedAt(item: ContentItem): number {
	const raw = (item as any).createdAt ?? (item as any).updatedAt;
	if (!raw || typeof raw !== 'string') return 0;
	const ts = Date.parse(raw);
	return Number.isFinite(ts) ? ts : 0;
}

function normalizeLoose(value: string): string {
	return value
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9\s]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function normalizeTitleExact(value: string): string {
	return normalizeLoose(value);
}

function tokenizeArtist(value: string): string[] {
	return normalizeLoose(value).split(' ').filter(Boolean);
}

export function matchesSearch(item: ContentItem, q: string): boolean {
	if (!q) return true;
	const needle = q.toLowerCase();
	const trimmed = q.trim();
	// Music search (videos only):
	// - exact match on song title
	// - token match on artist words
	if (trimmed && item.type === 'movie') {
		const movie: Movie = item;
		const tracks: VideoTrack[] | undefined = movie.tracks;
		if (Array.isArray(tracks) && tracks.length) {
			const qTitle = normalizeTitleExact(trimmed);
			if (qTitle) {
				const exactSongTitleMatch = tracks.some((t) => {
					const title = t.song?.title;
					if (typeof title !== 'string' || !title.trim()) return false;
					return normalizeTitleExact(title) === qTitle;
				});
				if (exactSongTitleMatch) return true;

				const qTokens = tokenizeArtist(trimmed);
				if (qTokens.length) {
					const artistTokenMatch = tracks.some((t) => {
						const artist = t.song?.artist;
						if (typeof artist !== 'string' || !artist.trim()) return false;
						const artistTokens = new Set(tokenizeArtist(artist));
						return qTokens.every((tok) => artistTokens.has(tok));
					});
					if (artistTokenMatch) return true;
				}
			}
		}
	}

	const haystacks: string[] = [];
	if (item.title) haystacks.push(item.title);
	if ((item as any).description) haystacks.push((item as any).description);
	// new creators array
	if ((item as any).creators && Array.isArray((item as any).creators))
		haystacks.push(...(item as any).creators);
	// starring array
	if ((item as any).starring && Array.isArray((item as any).starring))
		haystacks.push(...(item as any).starring);
	return haystacks.some((h) => (h || '').toLowerCase().includes(needle));
}

export function matchesFacets(
	item: ContentItem,
	selectedFacets?: TvState['selectedFacets']
): boolean {
	if (!selectedFacets) return true;

	const hasActiveSelection = Object.values(selectedFacets).some(
		(v) => Array.isArray(v) && v.length > 0
	);
	if (!hasActiveSelection) return true;

	const facets = item.facets;
	if (!facets) return false;

	// Check each facet category - all selected facets must match (AND logic within category, OR logic for values)
	if (selectedFacets.type && selectedFacets.type.length > 0) {
		if (!facets.type || !selectedFacets.type.includes(facets.type)) return false;
	}

	if (selectedFacets.focus && selectedFacets.focus.length > 0) {
		if (!facets.focus || !selectedFacets.focus.includes(facets.focus)) return false;
	}

	if (selectedFacets.movement && selectedFacets.movement.length > 0) {
		if (!facets.movement || !facets.movement.some((m) => selectedFacets.movement!.includes(m)))
			return false;
	}

	if (selectedFacets.environment && selectedFacets.environment.length > 0) {
		if (!facets.environment || !selectedFacets.environment.includes(facets.environment))
			return false;
	}

	if (selectedFacets.production && selectedFacets.production.length > 0) {
		if (!facets.production || !selectedFacets.production.includes(facets.production)) return false;
	}

	if (selectedFacets.presentation && selectedFacets.presentation.length > 0) {
		if (!facets.presentation || !selectedFacets.presentation.includes(facets.presentation))
			return false;
	}

	if (selectedFacets.medium && selectedFacets.medium.length > 0) {
		if (!facets.medium || !selectedFacets.medium.includes(facets.medium)) return false;
	}

	if (selectedFacets.era && selectedFacets.era.length > 0) {
		if (!facets.era || !selectedFacets.era.includes(facets.era)) return false;
	}

	if (selectedFacets.length && selectedFacets.length.length > 0) {
		if (!facets.length || !selectedFacets.length.includes(facets.length)) return false;
	}

	return true;
}

export function matchesFeed(item: ContentItem, activeFeedSlug?: string | null): boolean {
	const feed = getFeedBySlug(activeFeedSlug);
	if (!feed) return true;

	const { filter } = feed;

	if (filter.itemTypes && filter.itemTypes.length > 0 && !filter.itemTypes.includes(item.type)) {
		return false;
	}

	if (filter.yearMin !== undefined || filter.yearMax !== undefined) {
		const itemYear = parseYear(item);
		if (itemYear <= 0) return false;
		if (filter.yearMin !== undefined && itemYear < filter.yearMin) return false;
		if (filter.yearMax !== undefined && itemYear > filter.yearMax) return false;
	}

	if (filter.durationMinMinutes !== undefined || filter.durationMaxMinutes !== undefined) {
		const durationMinutes = parseDurationToMinutes((item as any).duration);
		if (
			filter.durationMinMinutes !== undefined &&
			(durationMinutes === Number.POSITIVE_INFINITY || durationMinutes < filter.durationMinMinutes)
		) {
			return false;
		}
		if (
			filter.durationMaxMinutes !== undefined &&
			(durationMinutes === Number.POSITIVE_INFINITY || durationMinutes > filter.durationMaxMinutes)
		) {
			return false;
		}
	}

	const feedFacets = filter.facets;
	const facets = item.facets;
	if (feedFacets) {
		if (!facets) return false;

		if (feedFacets.type && feedFacets.type.length > 0) {
			if (!facets.type || !feedFacets.type.includes(facets.type)) return false;
		}

		if (feedFacets.focus && feedFacets.focus.length > 0) {
			if (!facets.focus || !feedFacets.focus.includes(facets.focus)) return false;
		}

		if (feedFacets.movement && feedFacets.movement.length > 0) {
			if (
				!facets.movement ||
				!facets.movement.some((movement) => feedFacets.movement!.includes(movement))
			) {
				return false;
			}
		}

		if (feedFacets.environment && feedFacets.environment.length > 0) {
			if (!facets.environment || !feedFacets.environment.includes(facets.environment)) return false;
		}

		if (feedFacets.production && feedFacets.production.length > 0) {
			if (!facets.production || !feedFacets.production.includes(facets.production)) return false;
		}

		if (feedFacets.presentation && feedFacets.presentation.length > 0) {
			if (!facets.presentation || !feedFacets.presentation.includes(facets.presentation))
				return false;
		}

		if (feedFacets.medium && feedFacets.medium.length > 0) {
			if (!facets.medium || !feedFacets.medium.includes(facets.medium)) return false;
		}

		if (feedFacets.era && feedFacets.era.length > 0) {
			if (!facets.era || !feedFacets.era.includes(facets.era)) return false;
		}

		if (feedFacets.length && feedFacets.length.length > 0) {
			if (!facets.length || !feedFacets.length.includes(facets.length)) return false;
		}
	}

	const excludedFacets = filter.excludeFacets;
	if (!excludedFacets) return true;
	if (!facets) return true;

	if (excludedFacets.type && excludedFacets.type.length > 0) {
		if (facets.type && excludedFacets.type.includes(facets.type)) return false;
	}

	if (excludedFacets.focus && excludedFacets.focus.length > 0) {
		if (facets.focus && excludedFacets.focus.includes(facets.focus)) return false;
	}

	if (excludedFacets.movement && excludedFacets.movement.length > 0) {
		if (facets.movement?.some((movement) => excludedFacets.movement!.includes(movement))) return false;
	}

	if (excludedFacets.environment && excludedFacets.environment.length > 0) {
		if (facets.environment && excludedFacets.environment.includes(facets.environment)) return false;
	}

	if (excludedFacets.production && excludedFacets.production.length > 0) {
		if (facets.production && excludedFacets.production.includes(facets.production)) return false;
	}

	if (excludedFacets.presentation && excludedFacets.presentation.length > 0) {
		if (facets.presentation && excludedFacets.presentation.includes(facets.presentation)) return false;
	}

	if (excludedFacets.medium && excludedFacets.medium.length > 0) {
		if (facets.medium && excludedFacets.medium.includes(facets.medium)) return false;
	}

	if (excludedFacets.era && excludedFacets.era.length > 0) {
		if (facets.era && excludedFacets.era.includes(facets.era)) return false;
	}

	if (excludedFacets.length && excludedFacets.length.length > 0) {
		if (facets.length && excludedFacets.length.includes(facets.length)) return false;
	}

	return true;
}

export function filterAndSortContent(
	all: ContentItem[],
	rankMap: Map<string, number>,
	state: TvState
): ContentItem[] {
	const filtered = all
		.filter((item) => (state.showPaid ? true : !item.paid))
		.filter((item) => matchesFeed(item, state.activeFeedSlug))
		.filter((item) => matchesSearch(item, state.searchQuery))
		.filter((item) => matchesFacets(item, state.selectedFacets));

	const sorted = [...filtered];
	const watchedSet = state.watchedBaseIds;
	const shouldPushWatchedToEnd = state.showWatched === false;
	const inProgressSet = state.inProgressBaseIds;
	const isWatched = (item: ContentItem) => Boolean(watchedSet && watchedSet.has(keyFor(item)));
	const isInProgress = (item: ContentItem) =>
		Boolean(inProgressSet && inProgressSet.has(keyFor(item)));
	const compareWithPriorities =
		(compareFn: (a: ContentItem, b: ContentItem) => number) => (a: ContentItem, b: ContentItem) => {
			if (shouldPushWatchedToEnd) {
				const watchedDiff = Number(isWatched(a)) - Number(isWatched(b));
				if (watchedDiff !== 0) return watchedDiff;
			}
			const progressDiff = Number(isInProgress(b)) - Number(isInProgress(a));
			if (progressDiff !== 0) return progressDiff;
			const posterDiff = Number(hasPoster(b)) - Number(hasPoster(a));
			if (posterDiff !== 0) return posterDiff;
			return compareFn(a, b);
		};
	switch (state.sortBy) {
		case 'added-desc':
			sorted.sort(compareWithPriorities((a, b) => parseAddedAt(b) - parseAddedAt(a)));
			break;
		case 'title-asc':
			sorted.sort(compareWithPriorities((a, b) => (a.title || '').localeCompare(b.title || '')));
			break;
		case 'year-desc':
			sorted.sort(compareWithPriorities((a, b) => parseYear(b) - parseYear(a)));
			break;
		case 'year-asc':
			sorted.sort(compareWithPriorities((a, b) => parseYear(a) - parseYear(b)));
			break;
		case 'duration-asc':
			sorted.sort(
				compareWithPriorities(
					(a, b) =>
						parseDurationToMinutes((a as any).duration) -
						parseDurationToMinutes((b as any).duration)
				)
			);
			break;
		case 'duration-desc':
			sorted.sort(
				compareWithPriorities(
					(a, b) =>
						parseDurationToMinutes((b as any).duration) -
						parseDurationToMinutes((a as any).duration)
				)
			);
			break;
		case 'rating-desc':
			sorted.sort(
				compareWithPriorities((a, b) => {
					const ratingDiff = (b.averageRating ?? 5.5) - (a.averageRating ?? 5.5);
					if (ratingDiff !== 0) return ratingDiff;
					return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
				})
			);
			break;
		case 'rating-asc':
			sorted.sort(
				compareWithPriorities((a, b) => {
					const ratingDiff = (a.averageRating ?? 5.5) - (b.averageRating ?? 5.5);
					if (ratingDiff !== 0) return ratingDiff;
					return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
				})
			);
			break;
		default:
			sorted.sort(
				compareWithPriorities(
					(a, b) => (rankMap.get(keyFor(a)) ?? 0) - (rankMap.get(keyFor(b)) ?? 0)
				)
			);
	}
	return sorted;
}

import { resolveMoviePlaybackSource } from './playback-source';

export function isInlinePlayable(content: ContentItem | null | undefined) {
	if (!content) return false;
	if (content.type === 'movie') return Boolean(resolveMoviePlaybackSource(content));
	if (content.type === 'series') {
		const series = content as any;
		return Boolean(series.playlistId || series.seasons?.some((s: any) => s?.playlistId));
	}
	return false;
}

export function isImage(src?: string) {
	return !!src && (src.startsWith('http') || src.startsWith('/'));
}

export function hasPoster(item: ContentItem) {
	return typeof item.thumbnail === 'string' && item.thumbnail.includes('/images/posters/');
}
