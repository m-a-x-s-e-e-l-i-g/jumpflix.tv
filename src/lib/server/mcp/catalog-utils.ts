import type { ContentItem, Facets, Movie, Season, Series, VideoTrack } from '$lib/tv/types';
import { getPublicProviderLinkSource, resolveMoviePlaybackSource } from '$lib/tv/playback-source';
import { parseDurationToMinutes, parseYear } from '$lib/tv/utils';
import { slugify } from '$lib/tv/slug';
import { normalizeParkourSpotPayload } from '$lib/server/parkourSpotPayload';

export type JsonObject = Record<string, unknown>;

export type CatalogCursorPage<T> = {
	page: number;
	pageSize: number;
	total: number;
	items: T[];
	hasMore: boolean;
	nextCursor: string | null;
};

export type CatalogSearchFilters = {
	query?: string;
	includePaid?: boolean;
	types?: Array<'movie' | 'series'>;
	availability?: 'available' | 'unavailable' | 'all';
	providers?: string[];
	yearMin?: number;
	yearMax?: number;
	durationMinMinutes?: number;
	durationMaxMinutes?: number;
	minimumRating?: number;
	creator?: string;
	athlete?: string;
	contentWarnings?: string[];
	excludeContentWarnings?: string[];
	facets?: Record<string, string[] | undefined>;
};

export type DiscoverOptions = CatalogSearchFilters & {
	seedSlugs?: string[];
	excludeIds?: Array<number | string>;
	limit: number;
};

export const READ_ONLY_TOOL_ANNOTATIONS = {
	readOnlyHint: true,
	destructiveHint: false,
	idempotentHint: true,
	openWorldHint: false
} as const;

export const OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS = {
	...READ_ONLY_TOOL_ANNOTATIONS,
	openWorldHint: true
} as const;

export function toCanonicalUrl(item: Pick<ContentItem, 'type' | 'slug'>): string {
	const path = item.type === 'series' ? `/series/${item.slug}` : `/movie/${item.slug}`;
	return `https://www.jumpflix.tv${path}`;
}

export function toPersonUrl(slug: string): string {
	return `https://www.jumpflix.tv/people/${encodeURIComponent(slug)}`;
}

export function mediaResourceUri(item: Pick<ContentItem, 'type' | 'slug'>): string {
	return `jumpflix://catalog/${item.type}/${encodeURIComponent(item.slug)}`;
}

export function personResourceUri(slug: string): string {
	return `jumpflix://people/${encodeURIComponent(slug)}`;
}

export function spotResourceUri(spotId: string): string {
	return `jumpflix://spots/${encodeURIComponent(spotId)}`;
}

export function feedResourceUri(slug: string): string {
	return `jumpflix://feeds/${encodeURIComponent(slug)}`;
}

function cleanStringArray(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	return value
		.filter((entry): entry is string => typeof entry === 'string')
		.map((entry) => entry.trim())
		.filter(Boolean);
}

function descriptionSnippet(value: unknown, maxLength = 280): string | undefined {
	if (typeof value !== 'string') return undefined;
	const compact = value.replace(/\s+/g, ' ').trim();
	if (!compact) return undefined;
	if (compact.length <= maxLength) return compact;
	return `${compact.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function publicOfficialSource(item: ContentItem): JsonObject | null {
	const externalUrl = typeof item.externalUrl === 'string' ? item.externalUrl.trim() : '';
	if (externalUrl) {
		return {
			kind: 'external',
			url: externalUrl,
			provider: item.provider ?? null
		};
	}

	if (item.type !== 'movie') return null;
	const source = getPublicProviderLinkSource(resolveMoviePlaybackSource(item));
	if (!source) return null;
	return {
		kind: source.kind,
		url: source.url,
		provider: item.provider ?? source.kind
	};
}

export function toMediaSummary(item: ContentItem): JsonObject {
	const warnings = cleanStringArray(item.facets?.contentWarnings);
	return {
		id: item.id,
		slug: item.slug,
		type: item.type,
		title: item.title,
		url: toCanonicalUrl(item),
		resourceUri: mediaResourceUri(item),
		thumbnail: item.thumbnail ?? null,
		descriptionSnippet: descriptionSnippet(item.description) ?? null,
		year: item.type === 'movie' ? (item.year ?? null) : null,
		duration: item.type === 'movie' ? (item.duration ?? null) : null,
		episodeCount: item.type === 'series' ? (item.episodeCount ?? null) : null,
		paid: item.paid ?? false,
		provider: item.provider ?? null,
		availabilityStatus: item.availabilityStatus ?? 'available',
		averageRating: item.averageRating ?? null,
		ratingCount: item.ratingCount ?? 0,
		creators: cleanStringArray(item.creators),
		starring: cleanStringArray(item.starring),
		explicit: item.explicit ?? warnings.length > 0,
		contentWarnings: warnings,
		facets: item.facets ?? {},
		createdAt: item.createdAt ?? null,
		updatedAt: item.updatedAt ?? null
	};
}

function toTrack(track: VideoTrack): JsonObject {
	return {
		startAtSeconds: track.startAtSeconds ?? null,
		startTimecode: track.startTimecode ?? null,
		source: track.source,
		importSource: track.importSource ?? null,
		song: {
			id: track.song.id,
			spotifyTrackId: track.song.spotifyTrackId ?? null,
			spotifyUrl: track.song.spotifyUrl ?? null,
			title: track.song.title,
			artist: track.song.artist,
			durationMs: track.song.durationMs ?? null,
			explicit: track.song.explicit ?? false
		}
	};
}

function toSeason(season: Season): JsonObject {
	return {
		id: season.id ?? null,
		seasonNumber: season.seasonNumber,
		customName: season.customName ?? null,
		episodeCount: Array.isArray(season.episodes) ? season.episodes.length : null
	};
}

export function toMediaDetail(
	item: ContentItem,
	limits: { maxTracks: number; maxSeasons: number }
): { item: JsonObject; resultLimit?: JsonObject } {
	const base: JsonObject = {
		...toMediaSummary(item),
		description: item.description ?? null,
		officialSource: publicOfficialSource(item),
		traktUrl: item.trakt ?? null
	};

	const nestedCollections: JsonObject = {};
	if (item.type === 'movie') {
		const tracks = Array.isArray(item.tracks) ? item.tracks : [];
		base.tracks = tracks.slice(0, limits.maxTracks).map(toTrack);
		if (tracks.length > limits.maxTracks) {
			nestedCollections.tracks = {
				returned: limits.maxTracks,
				total: tracks.length,
				limit: limits.maxTracks
			};
		}
	} else {
		const seasons = Array.isArray(item.seasons) ? item.seasons : [];
		base.seasons = seasons.slice(0, limits.maxSeasons).map(toSeason);
		if (seasons.length > limits.maxSeasons) {
			nestedCollections.seasons = {
				returned: limits.maxSeasons,
				total: seasons.length,
				limit: limits.maxSeasons
			};
		}
	}

	return {
		item: base,
		...(Object.keys(nestedCollections).length ? { resultLimit: { nestedCollections } } : {})
	};
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

function textValues(item: ContentItem): string[] {
	const tracks = item.type === 'movie' && Array.isArray(item.tracks) ? item.tracks : [];
	return [
		item.title,
		item.description ?? '',
		...cleanStringArray(item.creators),
		...cleanStringArray(item.starring),
		...tracks.flatMap((track) => [track.song.title, track.song.artist])
	].filter(Boolean);
}

export function searchRelevanceScore(item: ContentItem, query: string): number {
	const normalizedQuery = normalizeLoose(query);
	if (!normalizedQuery) return 0;
	const tokens = normalizedQuery.split(' ').filter(Boolean);
	const title = normalizeLoose(item.title);
	const description = normalizeLoose(item.description ?? '');
	const people = normalizeLoose(
		[...cleanStringArray(item.creators), ...cleanStringArray(item.starring)].join(' ')
	);
	const allText = normalizeLoose(textValues(item).join(' '));

	let score = 0;
	if (title === normalizedQuery) score += 100;
	else if (title.startsWith(normalizedQuery)) score += 60;
	else if (title.includes(normalizedQuery)) score += 45;
	if (people.includes(normalizedQuery)) score += 35;
	if (description.includes(normalizedQuery)) score += 20;
	for (const token of tokens) {
		if (title.includes(token)) score += 10;
		if (people.includes(token)) score += 7;
		if (description.includes(token)) score += 3;
		if (allText.includes(token)) score += 1;
	}
	return score;
}

function matchesPerson(values: unknown, query: string | undefined): boolean {
	if (!query?.trim()) return true;
	const target = slugify(query);
	return cleanStringArray(values).some((value) => {
		const candidate = slugify(value);
		return candidate === target || candidate.includes(target) || target.includes(candidate);
	});
}

function facetMatches(
	itemFacets: Facets | undefined,
	selected?: Record<string, string[] | undefined>
): boolean {
	if (!selected) return true;
	for (const [key, selectedValues] of Object.entries(selected)) {
		if (!selectedValues?.length) continue;
		const itemValue = itemFacets?.[key as keyof Facets];
		if (Array.isArray(itemValue)) {
			if (!itemValue.some((value) => selectedValues.includes(String(value)))) return false;
		} else if (!itemValue || !selectedValues.includes(String(itemValue))) {
			return false;
		}
	}
	return true;
}

export function matchesCatalogFilters(item: ContentItem, filters: CatalogSearchFilters): boolean {
	if (filters.includePaid === false && item.paid) return false;
	if (filters.types?.length && !filters.types.includes(item.type)) return false;
	if (
		filters.availability &&
		filters.availability !== 'all' &&
		(item.availabilityStatus ?? 'available') !== filters.availability
	) {
		return false;
	}
	if (filters.providers?.length) {
		const provider = normalizeLoose(item.provider ?? '');
		if (!filters.providers.some((value) => provider.includes(normalizeLoose(value)))) return false;
	}

	const year = parseYear(item);
	if (filters.yearMin !== undefined && (year <= 0 || year < filters.yearMin)) return false;
	if (filters.yearMax !== undefined && (year <= 0 || year > filters.yearMax)) return false;

	const duration = parseDurationToMinutes(item.type === 'movie' ? item.duration : undefined);
	if (
		filters.durationMinMinutes !== undefined &&
		(!Number.isFinite(duration) || duration < filters.durationMinMinutes)
	) {
		return false;
	}
	if (
		filters.durationMaxMinutes !== undefined &&
		(!Number.isFinite(duration) || duration > filters.durationMaxMinutes)
	) {
		return false;
	}
	if (filters.minimumRating !== undefined && (item.averageRating ?? 0) < filters.minimumRating)
		return false;
	if (!matchesPerson(item.creators, filters.creator)) return false;
	if (!matchesPerson(item.starring, filters.athlete)) return false;
	if (!facetMatches(item.facets, filters.facets)) return false;

	const warnings = new Set(cleanStringArray(item.facets?.contentWarnings));
	if (
		filters.contentWarnings?.length &&
		!filters.contentWarnings.every((warning) => warnings.has(warning))
	) {
		return false;
	}
	if (filters.excludeContentWarnings?.some((warning) => warnings.has(warning))) return false;

	const query = filters.query?.trim() ?? '';
	if (query && searchRelevanceScore(item, query) <= 0) return false;
	return true;
}

export function sortCatalogItems(items: ContentItem[], sort: string, query = ''): ContentItem[] {
	const sorted = [...items];
	const compareNullableNumber = (
		left: number | null | undefined,
		right: number | null | undefined
	) => (left ?? Number.NEGATIVE_INFINITY) - (right ?? Number.NEGATIVE_INFINITY);

	switch (sort) {
		case 'relevance':
		case 'default':
			if (query.trim()) {
				sorted.sort(
					(a, b) =>
						searchRelevanceScore(b, query) - searchRelevanceScore(a, query) ||
						a.title.localeCompare(b.title)
				);
				break;
			}
			sorted.sort((a, b) => a.title.localeCompare(b.title));
			break;
		case 'added-desc':
			sorted.sort(
				(a, b) =>
					Date.parse(b.createdAt ?? b.updatedAt ?? '') -
					Date.parse(a.createdAt ?? a.updatedAt ?? '')
			);
			break;
		case 'year-desc':
			sorted.sort((a, b) => parseYear(b) - parseYear(a));
			break;
		case 'year-asc':
			sorted.sort((a, b) => parseYear(a) - parseYear(b));
			break;
		case 'duration-asc':
			sorted.sort(
				(a, b) =>
					parseDurationToMinutes(a.type === 'movie' ? a.duration : undefined) -
					parseDurationToMinutes(b.type === 'movie' ? b.duration : undefined)
			);
			break;
		case 'duration-desc':
			sorted.sort(
				(a, b) =>
					parseDurationToMinutes(b.type === 'movie' ? b.duration : undefined) -
					parseDurationToMinutes(a.type === 'movie' ? a.duration : undefined)
			);
			break;
		case 'rating-desc':
			sorted.sort(
				(a, b) =>
					compareNullableNumber(b.averageRating, a.averageRating) ||
					(b.ratingCount ?? 0) - (a.ratingCount ?? 0)
			);
			break;
		case 'rating-asc':
			sorted.sort(
				(a, b) =>
					compareNullableNumber(a.averageRating, b.averageRating) ||
					(b.ratingCount ?? 0) - (a.ratingCount ?? 0)
			);
			break;
		default:
			sorted.sort((a, b) => a.title.localeCompare(b.title));
	}
	return sorted;
}

function decodeCursor(cursor: string | undefined): number | null {
	if (!cursor?.trim()) return null;
	try {
		const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
			offset?: unknown;
		};
		const offset = Number(parsed.offset);
		return Number.isInteger(offset) && offset >= 0 ? offset : null;
	} catch {
		return null;
	}
}

function encodeCursor(offset: number): string {
	return Buffer.from(JSON.stringify({ offset }), 'utf8').toString('base64url');
}

export function paginateWithCursor<T>(
	items: T[],
	options: { page: number; pageSize: number; cursor?: string; maxPageSize: number }
): CatalogCursorPage<T> {
	const pageSize = Math.max(1, Math.min(Math.floor(options.pageSize || 1), options.maxPageSize));
	const requestedPage = Math.max(1, Math.floor(options.page || 1));
	const cursorOffset = decodeCursor(options.cursor);
	if (options.cursor && cursorOffset === null) throw new Error('Invalid pagination cursor.');
	const offset = cursorOffset ?? (requestedPage - 1) * pageSize;
	const page = cursorOffset === null ? requestedPage : Math.floor(offset / pageSize) + 1;
	const pageItems = items.slice(offset, offset + pageSize);
	const nextOffset = offset + pageItems.length;
	const hasMore = nextOffset < items.length;
	return {
		page,
		pageSize,
		total: items.length,
		items: pageItems,
		hasMore,
		nextCursor: hasMore ? encodeCursor(nextOffset) : null
	};
}

function sharedValues(left: string[], right: string[]): string[] {
	const rightSet = new Set(right.map(normalizeLoose));
	return left.filter((value) => rightSet.has(normalizeLoose(value)));
}

function facetEntries(item: ContentItem): string[] {
	const facets = item.facets ?? {};
	return Object.entries(facets).flatMap(([key, value]) =>
		Array.isArray(value)
			? value.map((entry) => `${key}:${String(entry)}`)
			: value
				? [`${key}:${String(value)}`]
				: []
	);
}

export function discoverCatalog(
	items: ContentItem[],
	options: DiscoverOptions
): Array<{
	item: ContentItem;
	score: number;
	reasons: string[];
}> {
	const excludedIds = new Set((options.excludeIds ?? []).map(String));
	const seeds = items.filter((item) => options.seedSlugs?.includes(item.slug));
	const seedFacets = Array.from(new Set(seeds.flatMap(facetEntries)));
	const seedPeople = Array.from(
		new Set(
			seeds.flatMap((item) => [
				...cleanStringArray(item.creators),
				...cleanStringArray(item.starring)
			])
		)
	);

	return items
		.filter((item) => !excludedIds.has(String(item.id)))
		.filter((item) => !seeds.some((seed) => String(seed.id) === String(item.id)))
		.filter((item) => matchesCatalogFilters(item, options))
		.map((item) => {
			const reasons: string[] = [];
			let score = 0;
			const relevance = searchRelevanceScore(item, options.query ?? '');
			if (relevance > 0) {
				score += Math.min(100, relevance);
				reasons.push('matches the requested title, description, people, or music');
			}

			const matchingFacets = sharedValues(facetEntries(item), seedFacets);
			if (matchingFacets.length) {
				score += matchingFacets.length * 8;
				reasons.push(`shares ${matchingFacets.slice(0, 3).join(', ')} with the seed title`);
			}
			const matchingPeople = sharedValues(
				[...cleanStringArray(item.creators), ...cleanStringArray(item.starring)],
				seedPeople
			);
			if (matchingPeople.length) {
				score += matchingPeople.length * 12;
				reasons.push(`features ${matchingPeople.slice(0, 3).join(', ')}`);
			}

			if (item.averageRating !== undefined && item.averageRating !== null) {
				score += item.averageRating * Math.min(2, Math.log10((item.ratingCount ?? 0) + 1));
				if (item.averageRating >= 7.5 && (item.ratingCount ?? 0) > 0)
					reasons.push('well rated by the community');
			}
			if (item.availabilityStatus !== 'unavailable') score += 3;
			if (!item.paid) score += 2;
			if (!reasons.length) reasons.push('fits the requested catalog constraints');

			return { item, score: Number(score.toFixed(2)), reasons };
		})
		.sort((a, b) => b.score - a.score || a.item.title.localeCompare(b.item.title))
		.slice(0, options.limit);
}

function findArrayPayload(payload: unknown): unknown[] {
	if (Array.isArray(payload)) return payload;
	if (!payload || typeof payload !== 'object') return [];
	const record = payload as Record<string, unknown>;
	for (const key of ['spots', 'items', 'results', 'features', 'data']) {
		const candidate = record[key];
		if (Array.isArray(candidate)) return candidate;
		if (candidate && typeof candidate === 'object') {
			const nested = findArrayPayload(candidate);
			if (nested.length) return nested;
		}
	}
	return [];
}

export function normalizeSpotSearchResults(payload: unknown): JsonObject[] {
	return findArrayPayload(payload)
		.map((entry) => normalizeParkourSpotPayload(entry))
		.filter((entry): entry is NonNullable<typeof entry> => entry !== null)
		.map((entry) => ({
			id: entry.id,
			name: entry.name,
			lat: entry.lat,
			lng: entry.lng,
			resourceUri: spotResourceUri(entry.id)
		}));
}

export function buildPeopleIndex(items: ContentItem[]): Array<{
	name: string;
	slug: string;
	roles: { creator: boolean; athlete: boolean };
	mediaCount: number;
}> {
	const people = new Map<
		string,
		{
			nameCounts: Map<string, number>;
			roles: { creator: boolean; athlete: boolean };
			mediaIds: Set<string>;
		}
	>();
	for (const item of items) {
		for (const [role, values] of [
			['creator', cleanStringArray(item.creators)],
			['athlete', cleanStringArray(item.starring)]
		] as const) {
			for (const name of values) {
				const slug = slugify(name);
				if (!slug) continue;
				const current = people.get(slug) ?? {
					nameCounts: new Map<string, number>(),
					roles: { creator: false, athlete: false },
					mediaIds: new Set<string>()
				};
				current.nameCounts.set(name, (current.nameCounts.get(name) ?? 0) + 1);
				current.roles[role] = true;
				current.mediaIds.add(`${item.type}:${item.id}`);
				people.set(slug, current);
			}
		}
	}
	return Array.from(people.entries())
		.map(([slug, entry]) => ({
			slug,
			name:
				Array.from(entry.nameCounts.entries()).sort(
					(a, b) => b[1] - a[1] || a[0].localeCompare(b[0])
				)[0]?.[0] ?? slug,
			roles: entry.roles,
			mediaCount: entry.mediaIds.size
		}))
		.sort((a, b) => a.name.localeCompare(b.name));
}

export function latestCatalogUpdate(items: ContentItem[]): string | null {
	const timestamps = items
		.flatMap((item) => [item.updatedAt, item.createdAt])
		.filter((value): value is string => typeof value === 'string')
		.map(Date.parse)
		.filter(Number.isFinite);
	return timestamps.length ? new Date(Math.max(...timestamps)).toISOString() : null;
}

export function responseMetadata(items: ContentItem[]): JsonObject {
	return {
		source: 'jumpflix-catalog',
		generatedAt: new Date().toISOString(),
		catalogUpdatedAt: latestCatalogUpdate(items)
	};
}

export function isSeries(item: ContentItem): item is Series {
	return item.type === 'series';
}

export function isMovie(item: ContentItem): item is Movie {
	return item.type === 'movie';
}
