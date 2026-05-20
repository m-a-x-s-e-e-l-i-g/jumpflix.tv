import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as z from 'zod/v4';
import {
	CONTENT_WARNING_DESCRIPTIONS,
	CONTENT_WARNING_LABELS,
	CONTENT_WARNING_OPTIONS,
	FACET_ENVIRONMENT_DESCRIPTIONS,
	FACET_ENVIRONMENT_LABELS,
	FACET_ENVIRONMENT_OPTIONS,
	FACET_FOCUS_DESCRIPTIONS,
	FACET_FOCUS_LABELS,
	FACET_FOCUS_OPTIONS,
	FACET_MEDIUM_DESCRIPTIONS,
	FACET_MEDIUM_LABELS,
	FACET_MEDIUM_OPTIONS,
	FACET_MOVEMENT_DESCRIPTIONS,
	FACET_MOVEMENT_LABELS,
	FACET_MOVEMENT_OPTIONS,
	FACET_PRESENTATION_DESCRIPTIONS,
	FACET_PRESENTATION_LABELS,
	FACET_PRESENTATION_OPTIONS,
	FACET_PRODUCTION_DESCRIPTIONS,
	FACET_PRODUCTION_LABELS,
	FACET_PRODUCTION_OPTIONS,
	FACET_TYPE_DESCRIPTIONS,
	FACET_TYPE_LABELS,
	FACET_TYPE_OPTIONS
} from '$lib/tv/facet-options';
import { FEEDS } from '$lib/tv/feeds';
import { fetchAllContent } from '$lib/server/content-service';
import { suggestPeopleNames } from '$lib/server/people-suggest';
import { createSupabaseClient } from '$lib/server/supabaseClient';
import { fetchSpotById, resolveSpotId } from '$lib/server/parkourSpot';
import { canonicalizeSpotChapterRows } from '$lib/server/spotChapters';
import { env } from '$env/dynamic/private';
import { matchesFacets, matchesFeed, matchesSearch, parseDurationToMinutes, parseYear } from '$lib/tv/utils';
import type { ContentItem, FacetEra, FacetLength, SortBy } from '$lib/tv/types';
import { normalizeParkourSpotId } from '$lib/utils';
import { slugify } from '$lib/tv/slug';

type SortOption = SortBy;
type JsonObject = Record<string, unknown>;

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DEFAULT_GET_TRACKS_LIMIT = 80;
const MAX_GET_TRACKS_LIMIT = 200;
const DEFAULT_GET_SEASONS_LIMIT = 30;
const MAX_GET_SEASONS_LIMIT = 100;
const DEFAULT_SPOT_CHAPTERS_PER_ITEM_LIMIT = 40;
const MAX_SPOT_CHAPTERS_PER_ITEM_LIMIT = 200;
const DEFAULT_MAX_STRUCTURED_CONTENT_CHARS = 120_000;
const DEFAULT_MAX_TEXT_CONTENT_CHARS = 2_000;
const MIN_MAX_STRUCTURED_CONTENT_CHARS = 20_000;
const MAX_MAX_STRUCTURED_CONTENT_CHARS = 1_000_000;
const MIN_MAX_TEXT_CONTENT_CHARS = 200;
const MAX_MAX_TEXT_CONTENT_CHARS = 20_000;

const MAX_STRUCTURED_CONTENT_CHARS = parseConfiguredLimit(
	env.JUMPFLIX_MCP_MAX_STRUCTURED_CONTENT_CHARS,
	DEFAULT_MAX_STRUCTURED_CONTENT_CHARS,
	MIN_MAX_STRUCTURED_CONTENT_CHARS,
	MAX_MAX_STRUCTURED_CONTENT_CHARS
);

const MAX_TEXT_CONTENT_CHARS = parseConfiguredLimit(
	env.JUMPFLIX_MCP_MAX_TEXT_CONTENT_CHARS,
	DEFAULT_MAX_TEXT_CONTENT_CHARS,
	MIN_MAX_TEXT_CONTENT_CHARS,
	MAX_MAX_TEXT_CONTENT_CHARS
);

function parseConfiguredLimit(value: string | undefined, fallback: number, min: number, max: number): number {
	if (!value) return fallback;
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	const integer = Math.floor(parsed);
	if (integer < min) return min;
	if (integer > max) return max;
	return integer;
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
	if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
	if (value < 1) return fallback;
	return Math.min(Math.floor(value), max);
}

function truncateArray<T>(input: T[], limit: number): { items: T[]; truncatedCount: number } {
	if (input.length <= limit) return { items: input, truncatedCount: 0 };
	return {
		items: input.slice(0, limit),
		truncatedCount: input.length - limit
	};
}

function isRecord(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function safeJsonSize(value: unknown): number {
	try {
		return JSON.stringify(value).length;
	} catch {
		return Number.MAX_SAFE_INTEGER;
	}
}

function truncateText(text: string): string {
	if (text.length <= MAX_TEXT_CONTENT_CHARS) return text;
	const suffix = '... (truncated)';
	const maxLength = Math.max(0, MAX_TEXT_CONTENT_CHARS - suffix.length);
	return `${text.slice(0, maxLength)}${suffix}`;
}

function applyStructuredContentLimit(toolName: string, data: JsonObject): { payload: JsonObject; truncated: boolean } {
	const originalSize = safeJsonSize(data);
	if (originalSize <= MAX_STRUCTURED_CONTENT_CHARS) {
		return { payload: data, truncated: false };
	}

	let payload = structuredClone(data) as JsonObject;
	const notes: string[] = [];

	const trimTopLevelItems = (minimum: number) => {
		const currentItems = payload.items;
		if (!Array.isArray(currentItems)) return;

		const originalLength = currentItems.length;
		let items = currentItems;
		while (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS && items.length > minimum) {
			const nextLength = Math.max(minimum, Math.floor(items.length * 0.75));
			if (nextLength === items.length) break;
			items = items.slice(0, nextLength);
			payload.items = items;
		}

		if (items.length < originalLength) {
			notes.push(`items trimmed to ${items.length}/${originalLength}`);
		}
	};

	const trimNestedArray = (target: JsonObject, field: string, minimum: number) => {
		const current = target[field];
		if (!Array.isArray(current)) return;

		const originalLength = current.length;
		let values = current;
		while (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS && values.length > minimum) {
			const nextLength = Math.max(minimum, Math.floor(values.length * 0.75));
			if (nextLength === values.length) break;
			values = values.slice(0, nextLength);
			target[field] = values;
		}

		if (values.length < originalLength) {
			notes.push(`${field} trimmed to ${values.length}/${originalLength}`);
		}
	};

	if (toolName === 'catalog_search' || toolName === 'catalog_by_person') {
		trimTopLevelItems(1);
	}

	if (toolName === 'catalog_get' && isRecord(payload.item)) {
		trimNestedArray(payload.item, 'tracks', 1);
		trimNestedArray(payload.item, 'seasons', 1);

		if (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS && 'tracks' in payload.item) {
			delete payload.item.tracks;
			notes.push('tracks removed to fit transport size limit');
		}

		if (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS && 'seasons' in payload.item) {
			delete payload.item.seasons;
			notes.push('seasons removed to fit transport size limit');
		}
	}

	if (toolName === 'catalog_by_spot') {
		const currentItems = payload.items;
		if (Array.isArray(currentItems)) {
			let chapterListsTrimmed = 0;
			for (const entry of currentItems) {
				if (!isRecord(entry)) continue;
				const chapters = entry.chapters;
				if (!Array.isArray(chapters) || chapters.length < 2) continue;

				const originalLength = chapters.length;
				let trimmed = chapters;
				while (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS && trimmed.length > 1) {
					const nextLength = Math.max(1, Math.floor(trimmed.length * 0.75));
					if (nextLength === trimmed.length) break;
					trimmed = trimmed.slice(0, nextLength);
					entry.chapters = trimmed;
				}

				if (trimmed.length < originalLength) chapterListsTrimmed += 1;
			}

			if (chapterListsTrimmed > 0) {
				notes.push(`chapter lists trimmed on ${chapterListsTrimmed} media item(s)`);
			}
		}

		trimTopLevelItems(1);

		if (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS && 'spot' in payload) {
			delete payload.spot;
			notes.push('spot details removed to fit transport size limit');
		}
	}

	if (toolName === 'catalog_facets') {
		const manual = payload.manual;
		if (isRecord(manual)) {
			let descriptionsRemoved = 0;
			for (const section of Object.values(manual)) {
				if (!isRecord(section)) continue;
				if ('descriptions' in section) {
					delete section.descriptions;
					descriptionsRemoved += 1;
				}
			}
			if (descriptionsRemoved > 0) {
				notes.push(`manual facet descriptions removed from ${descriptionsRemoved} section(s)`);
			}
		}

		const contentWarnings = payload.contentWarnings;
		if (isRecord(contentWarnings) && 'descriptions' in contentWarnings) {
			delete contentWarnings.descriptions;
			notes.push('content warning descriptions removed to fit transport size limit');
		}
	}

	trimTopLevelItems(0);

	if (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS) {
		payload = {
			truncated: true,
			tool: toolName,
			reason: 'Structured content exceeded transport size limit.',
			maxSizeChars: MAX_STRUCTURED_CONTENT_CHARS
		};
		notes.push('returned fallback summary payload');
	}

	const finalSize = safeJsonSize(payload);
	payload = {
		...payload,
		transportLimit: {
			truncated: true,
			originalSizeChars: originalSize,
			finalSizeChars: finalSize,
			maxSizeChars: MAX_STRUCTURED_CONTENT_CHARS,
			notes
		}
	};

	return { payload, truncated: true };
}

function clampPageSize(pageSize: number): number {
	if (!Number.isFinite(pageSize) || pageSize < 1) return DEFAULT_PAGE_SIZE;
	return Math.min(Math.floor(pageSize), MAX_PAGE_SIZE);
}

function clampPage(page: number): number {
	if (!Number.isFinite(page) || page < 1) return 1;
	return Math.floor(page);
}

function toCanonicalUrl(item: ContentItem): string {
	const path = item.type === 'series' ? `/series/${item.slug}` : `/movie/${item.slug}`;
	return `https://www.jumpflix.tv${path}`;
}

function toSummary(item: ContentItem) {
	return {
		id: item.id,
		slug: item.slug,
		type: item.type,
		title: item.title,
		url: toCanonicalUrl(item),
		thumbnail: item.thumbnail,
		year: (item as any).year,
		duration: (item as any).duration,
		paid: item.paid,
		provider: item.provider,
		availabilityStatus: item.availabilityStatus,
		averageRating: item.averageRating,
		ratingCount: item.ratingCount,
		creators: (item as any).creators,
		starring: (item as any).starring,
		facets: item.facets,
		createdAt: item.createdAt,
		updatedAt: item.updatedAt
	};
}

function summarizeResult(title: string, total: number, page: number, pageSize: number): string {
	return `${title}: ${total} result${total === 1 ? '' : 's'} (page ${page}, size ${pageSize}).`;
}

function jsonToolResult<T extends JsonObject>(toolName: string, data: T, text: string) {
	const limited = applyStructuredContentLimit(toolName, data);
	const limitedText = truncateText(text);
	const textWithNotice = limited.truncated
		? truncateText(`${limitedText} Response truncated to stay within transport limits.`)
		: limitedText;

	return {
		content: [{ type: 'text' as const, text: textWithNotice }],
		structuredContent: limited.payload
	};
}

function parseTimestamp(value: string | undefined): number {
	if (!value) return 0;
	const parsed = Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function sortItems(items: ContentItem[], sort: SortOption): ContentItem[] {
	const sorted = [...items];
	switch (sort) {
		case 'title-asc':
			sorted.sort((a, b) => a.title.localeCompare(b.title));
			break;
		case 'year-desc':
			sorted.sort((a, b) => parseYear(b) - parseYear(a));
			break;
		case 'year-asc':
			sorted.sort((a, b) => parseYear(a) - parseYear(b));
			break;
		case 'duration-asc':
			sorted.sort(
				(a, b) => parseDurationToMinutes((a as any).duration) - parseDurationToMinutes((b as any).duration)
			);
			break;
		case 'duration-desc':
			sorted.sort(
				(a, b) => parseDurationToMinutes((b as any).duration) - parseDurationToMinutes((a as any).duration)
			);
			break;
		case 'rating-desc':
			sorted.sort((a, b) => {
				const ratingDiff = (b.averageRating ?? 5.5) - (a.averageRating ?? 5.5);
				if (ratingDiff !== 0) return ratingDiff;
				return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
			});
			break;
		case 'rating-asc':
			sorted.sort((a, b) => {
				const ratingDiff = (a.averageRating ?? 5.5) - (b.averageRating ?? 5.5);
				if (ratingDiff !== 0) return ratingDiff;
				return (b.ratingCount ?? 0) - (a.ratingCount ?? 0);
			});
			break;
		case 'added-desc':
			sorted.sort(
				(a, b) =>
					parseTimestamp((b as any).createdAt ?? (b as any).updatedAt) -
					parseTimestamp((a as any).createdAt ?? (a as any).updatedAt)
			);
			break;
		default:
			sorted.sort((a, b) => a.title.localeCompare(b.title));
	}
	return sorted;
}

function paginate<T>(items: T[], page: number, pageSize: number) {
	const safePage = clampPage(page);
	const safeSize = clampPageSize(pageSize);
	const offset = (safePage - 1) * safeSize;
	return {
		page: safePage,
		pageSize: safeSize,
		total: items.length,
		items: items.slice(offset, offset + safeSize)
	};
}

const searchInputSchema = {
	query: z.string().trim().optional(),
	feed: z.string().trim().optional(),
	includePaid: z.boolean().default(true),
	types: z.array(z.enum(['movie', 'series'])).optional(),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
	sort: z
		.enum([
			'default',
			'added-desc',
			'title-asc',
			'year-desc',
			'year-asc',
			'duration-asc',
			'duration-desc',
			'rating-desc',
			'rating-asc'
		])
		.default('title-asc'),
	facets: z
		.object({
			type: z.array(z.enum(FACET_TYPE_OPTIONS)).optional(),
			focus: z.array(z.enum(FACET_FOCUS_OPTIONS)).optional(),
			movement: z.array(z.enum(FACET_MOVEMENT_OPTIONS)).optional(),
			environment: z.array(z.enum(FACET_ENVIRONMENT_OPTIONS)).optional(),
			production: z.array(z.enum(FACET_PRODUCTION_OPTIONS)).optional(),
			presentation: z.array(z.enum(FACET_PRESENTATION_OPTIONS)).optional(),
			medium: z.array(z.enum(FACET_MEDIUM_OPTIONS)).optional(),
			era: z.array(z.enum(['pre-2000', '2000s', '2010s', '2020s', '2030s'] as [FacetEra, ...FacetEra[]])).optional(),
			length: z
				.array(z.enum(['short-form', 'medium-form', 'long-form'] as [FacetLength, ...FacetLength[]]))
				.optional()
		})
		.optional()
};

const getInputSchema = {
	id: z.number().int().positive().optional(),
	slug: z.string().trim().optional(),
	type: z.enum(['movie', 'series']).optional(),
	maxTracks: z.number().int().min(1).max(MAX_GET_TRACKS_LIMIT).optional(),
	maxSeasons: z.number().int().min(1).max(MAX_GET_SEASONS_LIMIT).optional()
};

const byPersonInputSchema = {
	person: z.string().trim().min(1),
	role: z.enum(['creator', 'athlete', 'any']).default('any'),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE)
};

const bySpotInputSchema = {
	spotId: z.string().trim().min(1),
	page: z.number().int().min(1).default(1),
	pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
	maxChaptersPerItem: z.number().int().min(1).max(MAX_SPOT_CHAPTERS_PER_ITEM_LIMIT).optional()
};

const facetsInputSchema = {
	includeDescriptions: z.boolean().default(true)
};

export function createJumpflixMcpServer(): McpServer {
	const server = new McpServer(
		{
			name: 'jumpflix-catalog-mcp',
			version: '0.1.0'
		},
		{
			instructions:
				'Read-only JumpFlix catalog MCP server for parkour and freerunning films. Use catalog_search first, then catalog_get for details.'
		}
	);

	server.registerTool(
		'catalog_search',
		{
			title: 'Catalog Search',
			description:
				'Search JumpFlix content by text, feed presets, and facet filters. Returns paginated summaries.',
			inputSchema: searchInputSchema
		},
		async (args) => {
			const content = await fetchAllContent();
			const selectedFacets = args.facets && Object.keys(args.facets).length > 0 ? args.facets : undefined;

			let filtered = content
				.filter((item) => (args.includePaid ? true : !item.paid))
				.filter((item) => (args.types && args.types.length > 0 ? args.types.includes(item.type) : true))
				.filter((item) => matchesFeed(item, args.feed))
				.filter((item) => matchesSearch(item, args.query || ''))
				.filter((item) => matchesFacets(item, selectedFacets));

			filtered = sortItems(filtered, args.sort as SortOption);

			const page = paginate(filtered, args.page, args.pageSize);
			const payload = {
				query: args.query || '',
				feed: args.feed || null,
				sort: args.sort,
				total: page.total,
				page: page.page,
				pageSize: page.pageSize,
				items: page.items.map(toSummary)
			};

			return jsonToolResult(
				'catalog_search',
				payload,
				summarizeResult('catalog_search', page.total, page.page, page.pageSize)
			);
		}
	);

	server.registerTool(
		'catalog_get',
		{
			title: 'Catalog Get',
			description: 'Get one catalog item by numeric id or slug.',
			inputSchema: getInputSchema
		},
		async (args) => {
			if (!args.id && !args.slug) {
				return {
					isError: true,
					content: [{ type: 'text', text: 'Provide either id or slug.' }]
				};
			}

			const content = await fetchAllContent();
			let item: ContentItem | undefined;

			if (args.id) {
				item = content.find((entry) => Number(entry.id) === Number(args.id));
			} else if (args.slug) {
				const slug = args.slug.trim();
				const matches = content.filter(
					(entry) => entry.slug === slug && (!args.type || entry.type === args.type)
				);
				if (matches.length > 1) {
					return {
						isError: true,
						content: [
							{
								type: 'text',
								text: 'Slug matched multiple items. Provide type to disambiguate.'
							}
						]
					};
				}
				item = matches[0];
			}

			if (!item) {
				return {
					isError: true,
					content: [{ type: 'text', text: 'Catalog item not found.' }]
				};
			}

			const maxTracks = clampLimit(args.maxTracks, DEFAULT_GET_TRACKS_LIMIT, MAX_GET_TRACKS_LIMIT);
			const maxSeasons = clampLimit(args.maxSeasons, DEFAULT_GET_SEASONS_LIMIT, MAX_GET_SEASONS_LIMIT);
			const payloadItem: JsonObject = {
				...toSummary(item)
			};
			const nestedLimitMeta: JsonObject = {};

			if (item.type === 'movie') {
				const tracks = Array.isArray((item as any).tracks) ? ((item as any).tracks as unknown[]) : [];
				const limitedTracks = truncateArray(tracks, maxTracks);
				payloadItem.tracks = limitedTracks.items;

				if (limitedTracks.truncatedCount > 0) {
					nestedLimitMeta.tracks = {
						returned: limitedTracks.items.length,
						total: tracks.length,
						limit: maxTracks
					};
				}
			}

			if (item.type === 'series') {
				const seasons = Array.isArray((item as any).seasons) ? ((item as any).seasons as unknown[]) : [];
				const limitedSeasons = truncateArray(seasons, maxSeasons);
				payloadItem.seasons = limitedSeasons.items;

				if (limitedSeasons.truncatedCount > 0) {
					nestedLimitMeta.seasons = {
						returned: limitedSeasons.items.length,
						total: seasons.length,
						limit: maxSeasons
					};
				}
			}

			const payload: JsonObject = {
				item: payloadItem
			};

			if (Object.keys(nestedLimitMeta).length > 0) {
				payload.resultLimit = {
					nestedCollections: nestedLimitMeta
				};
			}

			return jsonToolResult('catalog_get', payload, `catalog_get: found ${item.type} \"${item.title}\".`);
		}
	);

	server.registerTool(
		'catalog_by_person',
		{
			title: 'Catalog By Person',
			description: 'Find media by creator and/or athlete name.',
			inputSchema: byPersonInputSchema
		},
		async (args) => {
			const querySlug = slugify(args.person);
			if (!querySlug) {
				return {
					isError: true,
					content: [{ type: 'text', text: 'Could not derive a person slug from input.' }]
				};
			}

			const content = await fetchAllContent();
			const displayNameCounts = new Map<string, number>();
			let matchedCreator = false;
			let matchedAthlete = false;
			const matches: ContentItem[] = [];

			for (const item of content) {
				let include = false;
				const creators = Array.isArray((item as any).creators) ? ((item as any).creators as unknown[]) : [];
				const starring = Array.isArray((item as any).starring) ? ((item as any).starring as unknown[]) : [];

				if (args.role === 'creator' || args.role === 'any') {
					for (const creator of creators) {
						if (typeof creator !== 'string') continue;
						if (slugify(creator) !== querySlug) continue;
						include = true;
						matchedCreator = true;
						displayNameCounts.set(creator, (displayNameCounts.get(creator) ?? 0) + 1);
					}
				}

				if (args.role === 'athlete' || args.role === 'any') {
					for (const athlete of starring) {
						if (typeof athlete !== 'string') continue;
						if (slugify(athlete) !== querySlug) continue;
						include = true;
						matchedAthlete = true;
						displayNameCounts.set(athlete, (displayNameCounts.get(athlete) ?? 0) + 1);
					}
				}

				if (include) matches.push(item);
			}

			const resolvedName =
				Array.from(displayNameCounts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || args.person;
			const suggestions = await suggestPeopleNames({ query: args.person, role: args.role, limit: 5 });

			const sortedMatches = sortItems(matches, 'title-asc');
			const page = paginate(sortedMatches, args.page, args.pageSize);
			const payload = {
				person: args.person,
				resolvedName,
				slug: querySlug,
				roles: {
					creator: matchedCreator,
					athlete: matchedAthlete
				},
				total: page.total,
				page: page.page,
				pageSize: page.pageSize,
				items: page.items.map(toSummary),
				suggestions
			};

			return jsonToolResult(
				'catalog_by_person',
				payload,
				summarizeResult('catalog_by_person', page.total, page.page, page.pageSize)
			);
		}
	);

	server.registerTool(
		'catalog_by_spot',
		{
			title: 'Catalog By Spot',
			description: 'Find catalog items containing a parkour.spot chapter.',
			inputSchema: bySpotInputSchema
		},
		async (args) => {
			const requestedSpotId = normalizeParkourSpotId(args.spotId) ?? args.spotId.trim();
			if (!requestedSpotId) {
				return {
					isError: true,
					content: [{ type: 'text', text: 'Invalid spotId.' }]
				};
			}

			const maxChaptersPerItem = clampLimit(
				args.maxChaptersPerItem,
				DEFAULT_SPOT_CHAPTERS_PER_ITEM_LIMIT,
				MAX_SPOT_CHAPTERS_PER_ITEM_LIMIT
			);

			let resolvedSpotId = requestedSpotId;
			let resolutionError: string | null = null;

			try {
				resolvedSpotId = await resolveSpotId(requestedSpotId);
			} catch (error) {
				resolutionError = error instanceof Error ? error.message : 'Failed to resolve spot.';
			}

			const supabase = createSupabaseClient();
			const spotIdsToMatch = Array.from(new Set([requestedSpotId, resolvedSpotId]));
			const { data: chapters, error: chaptersError } = await supabase
				.from('spot_chapters')
				.select('id, media_id, media_type, playback_key, spot_id, start_seconds, end_seconds')
				.in('spot_id', spotIdsToMatch)
				.order('start_seconds', { ascending: true });

			if (chaptersError) {
				const msg = String(chaptersError.message ?? '').toLowerCase();
				if (
					msg.includes('spot_chapters') &&
					(msg.includes('does not exist') || msg.includes('relation'))
				) {
					return jsonToolResult(
						'catalog_by_spot',
						{
							requestedSpotId,
							resolvedSpotId,
							resolutionError,
							total: 0,
							items: []
						},
						'catalog_by_spot: no spot chapters table found.'
					);
				}

				return {
					isError: true,
					content: [{ type: 'text', text: chaptersError.message || 'Failed to load spot chapters.' }]
				};
			}

			const rows = Array.isArray(chapters) ? chapters : [];
			const canonicalByRowId = await canonicalizeSpotChapterRows(
				rows.map((row) => ({
					id: Number(row.id),
					media_id: Number(row.media_id),
					media_type: row.media_type as 'movie' | 'series',
					playback_key: String(row.playback_key ?? ''),
					spot_id: String(row.spot_id ?? ''),
					start_seconds: Number(row.start_seconds),
					end_seconds: Number(row.end_seconds)
				}))
			);

			const targetSpotId = normalizeParkourSpotId(resolvedSpotId) ?? resolvedSpotId;
			const matchingRows = rows.filter((row) => {
				const canonical = canonicalByRowId.get(Number(row.id));
				const fallback = normalizeParkourSpotId(row.spot_id) ?? String(row.spot_id ?? '').trim();
				return (canonical ?? fallback) === targetSpotId;
			});

			const content = await fetchAllContent();
			const byId = new Map<number, ContentItem>();
			for (const item of content) {
				const id = Number(item.id);
				if (Number.isFinite(id)) byId.set(id, item);
			}

			type SpotChapterHit = {
				id: number;
				spotId: string;
				startSeconds: number;
				endSeconds: number;
				mediaType: 'movie' | 'series';
				playbackKey?: string;
			};

			const chaptersByMedia = new Map<number, SpotChapterHit[]>();
			for (const row of matchingRows) {
				const mediaId = Number(row.media_id);
				if (!Number.isFinite(mediaId)) continue;
				const spotId =
					canonicalByRowId.get(Number(row.id)) ??
					(normalizeParkourSpotId(row.spot_id) ?? String(row.spot_id ?? '').trim());

				if (!chaptersByMedia.has(mediaId)) chaptersByMedia.set(mediaId, []);
				chaptersByMedia.get(mediaId)!.push({
					id: Number(row.id),
					spotId,
					startSeconds: Number(row.start_seconds),
					endSeconds: Number(row.end_seconds),
					mediaType: row.media_type as 'movie' | 'series',
					...(row.playback_key ? { playbackKey: String(row.playback_key) } : {})
				});
			}

			let chapterGroupsTruncated = 0;
			let chaptersRemoved = 0;

			const items = Array.from(chaptersByMedia.entries())
				.map(([mediaId, mediaChapters]) => {
					const item = byId.get(mediaId);
					if (!item) return null;

					const sortedChapters = mediaChapters.sort((a, b) => a.startSeconds - b.startSeconds);
					const limitedChapters = truncateArray(sortedChapters, maxChaptersPerItem);
					if (limitedChapters.truncatedCount > 0) {
						chapterGroupsTruncated += 1;
						chaptersRemoved += limitedChapters.truncatedCount;
					}

					return {
						media: toSummary(item),
						chapters: limitedChapters.items
					};
				})
				.filter((entry): entry is NonNullable<typeof entry> => entry !== null);

			const page = paginate(items, args.page, args.pageSize);

			let spot: unknown = null;
			try {
				spot = await fetchSpotById(targetSpotId);
			} catch {
				spot = null;
			}

			const payload: JsonObject = {
				requestedSpotId,
				resolvedSpotId: targetSpotId,
				resolutionError,
				spot,
				total: page.total,
				page: page.page,
				pageSize: page.pageSize,
				items: page.items
			};

			if (chaptersRemoved > 0) {
				payload.resultLimit = {
					chaptersPerMedia: {
						limit: maxChaptersPerItem,
						truncatedMediaItems: chapterGroupsTruncated,
						removedChapters: chaptersRemoved
					}
				};
			}

			return jsonToolResult(
				'catalog_by_spot',
				payload,
				summarizeResult('catalog_by_spot', page.total, page.page, page.pageSize)
			);
		}
	);

	server.registerTool(
		'catalog_facets',
		{
			title: 'Catalog Facets',
			description: 'Return machine-readable facet taxonomy options and descriptions.',
			inputSchema: facetsInputSchema
		},
		async (args) => {
			const includeDescriptions = args.includeDescriptions;
			const payload = {
				manual: {
					type: {
						options: FACET_TYPE_OPTIONS,
						labels: FACET_TYPE_LABELS,
						...(includeDescriptions ? { descriptions: FACET_TYPE_DESCRIPTIONS } : {})
					},
					focus: {
						options: FACET_FOCUS_OPTIONS,
						labels: FACET_FOCUS_LABELS,
						...(includeDescriptions ? { descriptions: FACET_FOCUS_DESCRIPTIONS } : {})
					},
					movement: {
						options: FACET_MOVEMENT_OPTIONS,
						labels: FACET_MOVEMENT_LABELS,
						...(includeDescriptions ? { descriptions: FACET_MOVEMENT_DESCRIPTIONS } : {})
					},
					environment: {
						options: FACET_ENVIRONMENT_OPTIONS,
						labels: FACET_ENVIRONMENT_LABELS,
						...(includeDescriptions ? { descriptions: FACET_ENVIRONMENT_DESCRIPTIONS } : {})
					},
					production: {
						options: FACET_PRODUCTION_OPTIONS,
						labels: FACET_PRODUCTION_LABELS,
						...(includeDescriptions ? { descriptions: FACET_PRODUCTION_DESCRIPTIONS } : {})
					},
					presentation: {
						options: FACET_PRESENTATION_OPTIONS,
						labels: FACET_PRESENTATION_LABELS,
						...(includeDescriptions ? { descriptions: FACET_PRESENTATION_DESCRIPTIONS } : {})
					},
					medium: {
						options: FACET_MEDIUM_OPTIONS,
						labels: FACET_MEDIUM_LABELS,
						...(includeDescriptions ? { descriptions: FACET_MEDIUM_DESCRIPTIONS } : {})
					}
				},
				computed: {
					era: ['pre-2000', '2000s', '2010s', '2020s', '2030s'],
					length: ['short-form', 'medium-form', 'long-form']
				},
				contentWarnings: {
					options: CONTENT_WARNING_OPTIONS,
					labels: CONTENT_WARNING_LABELS,
					...(includeDescriptions ? { descriptions: CONTENT_WARNING_DESCRIPTIONS } : {})
				}
			};

			return jsonToolResult('catalog_facets', payload, 'catalog_facets: returned current facet taxonomy.');
		}
	);

	server.registerTool(
		'catalog_feeds',
		{
			title: 'Catalog Feeds',
			description: 'List named JumpFlix feed presets and their filter definitions.',
			inputSchema: {}
		},
		async () => {
			const payload = {
				feeds: FEEDS.map((feed) => ({
					slug: feed.slug,
					filter: feed.filter,
					title: feed.title(),
					description: feed.description()
				}))
			};

			return jsonToolResult(
				'catalog_feeds',
				payload,
				`catalog_feeds: ${payload.feeds.length} feed preset${payload.feeds.length === 1 ? '' : 's'}.`
			);
		}
	);

	return server;
}
