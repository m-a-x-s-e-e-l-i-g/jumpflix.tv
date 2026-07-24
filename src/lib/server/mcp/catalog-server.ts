import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ResourceLink } from '@modelcontextprotocol/sdk/types.js';
import * as z from 'zod/v4';
import { env } from '$env/dynamic/private';
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
import { FEEDS, getFeedBySlug } from '$lib/tv/feeds';
import {
	fetchAllContent,
	fetchEpisodesBySeasonId,
	getContentServiceStatus
} from '$lib/server/content-service';
import { createSupabaseClient } from '$lib/server/supabaseClient';
import { fetchSpotById, resolveSpotId, searchSpots } from '$lib/server/parkourSpot';
import { canonicalizeSpotChapterRows, hydrateSpotInfo } from '$lib/server/spotChapters';
import { normalizeParkourSpotPayload } from '$lib/server/parkourSpotPayload';
import { matchesFeed } from '$lib/tv/utils';
import { slugify } from '$lib/tv/slug';
import { normalizeParkourSpotId } from '$lib/utils';
import type { ContentItem, FacetEra, FacetLength, VideoTrack } from '$lib/tv/types';
import {
	OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS,
	READ_ONLY_TOOL_ANNOTATIONS,
	buildPeopleIndex,
	discoverCatalog,
	feedResourceUri,
	isMovie,
	isSeries,
	matchesCatalogFilters,
	mediaResourceUri,
	normalizeSpotSearchResults,
	paginateWithCursor,
	personResourceUri,
	responseMetadata,
	sortCatalogItems,
	spotResourceUri,
	toMediaDetail,
	toMediaSummary,
	toPersonUrl,
	type JsonObject
} from './catalog-utils';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const DEFAULT_TRACK_LIMIT = 80;
const MAX_TRACK_LIMIT = 200;
const DEFAULT_SEASON_LIMIT = 30;
const MAX_SEASON_LIMIT = 100;
const DEFAULT_EPISODE_LIMIT = 100;
const MAX_EPISODE_LIMIT = 250;
const DEFAULT_CHAPTER_LIMIT = 80;
const MAX_CHAPTER_LIMIT = 250;
const DEFAULT_MAX_STRUCTURED_CONTENT_CHARS = 120_000;
const DEFAULT_MAX_TEXT_CONTENT_CHARS = 2_000;

const MAX_STRUCTURED_CONTENT_CHARS = parseConfiguredLimit(
	env.JUMPFLIX_MCP_MAX_STRUCTURED_CONTENT_CHARS,
	DEFAULT_MAX_STRUCTURED_CONTENT_CHARS,
	20_000,
	1_000_000
);
const MAX_TEXT_CONTENT_CHARS = parseConfiguredLimit(
	env.JUMPFLIX_MCP_MAX_TEXT_CONTENT_CHARS,
	DEFAULT_MAX_TEXT_CONTENT_CHARS,
	200,
	20_000
);
const MCP_SERVER_VERSION = env.JUMPFLIX_MCP_VERSION?.trim() || '0.2.0';

type PublicReviewRow = {
	id: number | string;
	author_name: string | null;
	body: string;
	created_at: string;
	updated_at: string;
};

type ToolPayload = { data: JsonObject; text: string; links?: ResourceLink[] };

function parseConfiguredLimit(
	value: string | undefined,
	fallback: number,
	min: number,
	max: number
): number {
	const parsed = Number(value);
	if (!Number.isFinite(parsed)) return fallback;
	return Math.max(min, Math.min(max, Math.floor(parsed)));
}

function clampLimit(value: number | undefined, fallback: number, max: number): number {
	if (!Number.isFinite(value) || Number(value) < 1) return fallback;
	return Math.min(Math.floor(Number(value)), max);
}

function cursorOffset(cursor: string | undefined, fallback: number): number {
	if (!cursor?.trim()) return fallback;
	try {
		const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
			offset?: unknown;
		};
		const offset = Number(parsed.offset);
		if (Number.isInteger(offset) && offset >= 0) return offset;
	} catch {
		// handled below
	}
	throw new Error('Invalid pagination cursor.');
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
	const suffix = '… (truncated)';
	return `${text.slice(0, Math.max(0, MAX_TEXT_CONTENT_CHARS - suffix.length))}${suffix}`;
}

function isRecord(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function applyStructuredContentLimit(
	toolName: string,
	data: JsonObject
): { payload: JsonObject; truncated: boolean } {
	const originalSize = safeJsonSize(data);
	if (originalSize <= MAX_STRUCTURED_CONTENT_CHARS) return { payload: data, truncated: false };

	let payload = structuredClone(data) as JsonObject;
	const notes: string[] = [];
	const arrayFields = ['items', 'episodes', 'reviews', 'people', 'spots', 'occurrences'];
	for (const field of arrayFields) {
		const values = payload[field];
		if (!Array.isArray(values)) continue;
		const originalLength = values.length;
		let next = values;
		while (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS && next.length > 1) {
			next = next.slice(0, Math.max(1, Math.floor(next.length * 0.7)));
			payload[field] = next;
		}
		if (next.length < originalLength)
			notes.push(`${field} trimmed to ${next.length}/${originalLength}`);
	}

	if (isRecord(payload.item)) {
		for (const field of ['tracks', 'seasons']) {
			const values = payload.item[field];
			if (!Array.isArray(values)) continue;
			const originalLength = values.length;
			let next = values;
			while (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS && next.length > 1) {
				next = next.slice(0, Math.max(1, Math.floor(next.length * 0.7)));
				payload.item[field] = next;
			}
			if (next.length < originalLength)
				notes.push(`item.${field} trimmed to ${next.length}/${originalLength}`);
		}
	}

	if (safeJsonSize(payload) > MAX_STRUCTURED_CONTENT_CHARS) {
		payload = {
			metadata: payload.metadata ?? {},
			truncated: true,
			tool: toolName,
			reason: 'Structured content exceeded the configured transport limit.'
		};
		notes.push('returned compact fallback payload');
	}

	const finalSize = safeJsonSize(payload);
	payload.transportLimit = {
		truncated: true,
		originalSizeChars: originalSize,
		finalSizeChars: finalSize,
		maxSizeChars: MAX_STRUCTURED_CONTENT_CHARS,
		notes
	};
	return { payload, truncated: true };
}

function jsonToolResult(toolName: string, payload: ToolPayload) {
	const limited = applyStructuredContentLimit(toolName, payload.data);
	const notice = limited.truncated ? ' Response truncated to stay within transport limits.' : '';
	return {
		content: [
			{ type: 'text' as const, text: truncateText(`${payload.text}${notice}`) },
			...(limited.truncated ? [] : (payload.links ?? []))
		],
		structuredContent: limited.payload
	};
}

function errorToolResult(toolName: string, error: unknown) {
	const message =
		error instanceof Error ? error.message : String(error || 'Unexpected tool error.');
	return {
		isError: true,
		...jsonToolResult(toolName, {
			data: { error: { code: 'tool_error', message, retryable: false } },
			text: `${toolName}: ${message}`
		})
	};
}

async function runTool(toolName: string, callback: () => Promise<ToolPayload>) {
	try {
		return jsonToolResult(toolName, await callback());
	} catch (error) {
		return errorToolResult(toolName, error);
	}
}

async function loadCatalog(): Promise<ContentItem[]> {
	const items = await fetchAllContent();
	const status = getContentServiceStatus();
	if (items.length === 0 && status.lastError) {
		throw new Error(`Jumpflix catalog is temporarily unavailable: ${status.lastError}`);
	}
	return items;
}

function findCatalogItem(
	items: ContentItem[],
	args: { id?: number; slug?: string; type?: 'movie' | 'series' }
): ContentItem {
	if (!args.id && !args.slug?.trim()) throw new Error('Provide either id or slug.');
	if (args.id) {
		const item = items.find(
			(entry) => Number(entry.id) === Number(args.id) && (!args.type || entry.type === args.type)
		);
		if (!item) throw new Error('Catalog item not found.');
		return item;
	}
	const slug = args.slug!.trim();
	const matches = items.filter(
		(entry) => entry.slug === slug && (!args.type || entry.type === args.type)
	);
	if (matches.length > 1)
		throw new Error('Slug matched multiple items. Provide type to disambiguate.');
	if (!matches[0]) throw new Error('Catalog item not found.');
	return matches[0];
}

function mediaLink(item: ContentItem): ResourceLink {
	return {
		type: 'resource_link',
		uri: mediaResourceUri(item),
		name: item.title,
		title: item.title,
		description: `${item.type === 'series' ? 'Series' : 'Film'} details from Jumpflix`,
		mimeType: 'application/json',
		annotations: { audience: ['assistant', 'user'], priority: 0.8 }
	};
}

function personLink(person: { name: string; slug: string }): ResourceLink {
	return {
		type: 'resource_link',
		uri: personResourceUri(person.slug),
		name: person.name,
		title: person.name,
		description: 'Jumpflix creator or athlete profile',
		mimeType: 'application/json',
		annotations: { audience: ['assistant', 'user'], priority: 0.7 }
	};
}

function spotLink(spot: { id: string; name: string }): ResourceLink {
	return {
		type: 'resource_link',
		uri: spotResourceUri(spot.id),
		name: spot.name,
		title: spot.name,
		description: 'parkour.spot location referenced by Jumpflix',
		mimeType: 'application/json',
		annotations: { audience: ['assistant', 'user'], priority: 0.6 }
	};
}

function feedLink(feed: (typeof FEEDS)[number]): ResourceLink {
	return {
		type: 'resource_link',
		uri: feedResourceUri(feed.slug),
		name: feed.title(),
		title: feed.title(),
		description: feed.description(),
		mimeType: 'application/json',
		annotations: { audience: ['assistant'], priority: 0.5 }
	};
}

function summaryText(name: string, total: number, returned: number): string {
	return `${name}: returned ${returned} of ${total} result${total === 1 ? '' : 's'}.`;
}

function paginationMetadata(page: {
	total: number;
	page: number;
	pageSize: number;
	hasMore: boolean;
	nextCursor: string | null;
}) {
	return {
		total: page.total,
		page: page.page,
		pageSize: page.pageSize,
		hasMore: page.hasMore,
		nextCursor: page.nextCursor
	};
}

const metadataOutputSchema = z.object({
	source: z.string(),
	generatedAt: z.string(),
	catalogUpdatedAt: z.string().nullable()
});

const transportLimitOutputSchema = z.object({
	truncated: z.boolean(),
	originalSizeChars: z.number(),
	finalSizeChars: z.number(),
	maxSizeChars: z.number(),
	notes: z.array(z.string())
});

const mediaSummaryOutputSchema = z.object({
	id: z.union([z.number(), z.string()]),
	slug: z.string(),
	type: z.enum(['movie', 'series']),
	title: z.string(),
	url: z.string(),
	resourceUri: z.string(),
	thumbnail: z.string().nullable(),
	descriptionSnippet: z.string().nullable(),
	year: z.string().nullable(),
	duration: z.string().nullable(),
	episodeCount: z.number().nullable(),
	paid: z.boolean(),
	provider: z.string().nullable(),
	availabilityStatus: z.enum(['available', 'unavailable']),
	averageRating: z.number().nullable(),
	ratingCount: z.number(),
	creators: z.array(z.string()),
	starring: z.array(z.string()),
	explicit: z.boolean(),
	contentWarnings: z.array(z.string()),
	facets: z.record(z.string(), z.unknown()),
	createdAt: z.string().nullable(),
	updatedAt: z.string().nullable()
});

const cursorFields = {
	total: z.number().int().nonnegative(),
	page: z.number().int().positive(),
	pageSize: z.number().int().positive(),
	hasMore: z.boolean(),
	nextCursor: z.string().nullable()
};

const resultLimitOutputSchema = z.record(z.string(), z.unknown()).optional();

const searchOutputSchema = z.object({
	metadata: metadataOutputSchema,
	query: z.string(),
	feed: z.string().nullable(),
	sort: z.string(),
	...cursorFields,
	items: z.array(mediaSummaryOutputSchema),
	transportLimit: transportLimitOutputSchema.optional()
});

const getOutputSchema = z.object({
	metadata: metadataOutputSchema,
	item: mediaSummaryOutputSchema.extend({
		description: z.string().nullable(),
		officialSource: z.record(z.string(), z.unknown()).nullable(),
		traktUrl: z.string().nullable(),
		tracks: z.array(z.record(z.string(), z.unknown())).optional(),
		seasons: z.array(z.record(z.string(), z.unknown())).optional()
	}),
	resultLimit: resultLimitOutputSchema,
	transportLimit: transportLimitOutputSchema.optional()
});

const facetSelectionSchema = z
	.object({
		type: z
			.array(z.enum(FACET_TYPE_OPTIONS))
			.optional()
			.describe('Content identities such as documentary or session.'),
		focus: z
			.array(z.enum(FACET_FOCUS_OPTIONS))
			.optional()
			.describe('Creative focus such as competition or showreel.'),
		movement: z
			.array(z.enum(FACET_MOVEMENT_OPTIONS))
			.optional()
			.describe('Movement styles that may appear in the title.'),
		environment: z
			.array(z.enum(FACET_ENVIRONMENT_OPTIONS))
			.optional()
			.describe('Dominant filming environment.'),
		production: z
			.array(z.enum(FACET_PRODUCTION_OPTIONS))
			.optional()
			.describe('Production polish level.'),
		presentation: z
			.array(z.enum(FACET_PRESENTATION_OPTIONS))
			.optional()
			.describe('Presentation format such as POV or vlog.'),
		medium: z
			.array(z.enum(FACET_MEDIUM_OPTIONS))
			.optional()
			.describe('Live action, animation, or mixed media.'),
		era: z
			.array(z.enum(['pre-2000', '2000s', '2010s', '2020s', '2030s'] as [FacetEra, ...FacetEra[]]))
			.optional(),
		length: z
			.array(z.enum(['short-form', 'medium-form', 'long-form'] as [FacetLength, ...FacetLength[]]))
			.optional()
	})
	.optional();

const pagingInputSchema = {
	page: z
		.number()
		.int()
		.min(1)
		.default(1)
		.describe('One-based page number. Ignored when cursor is supplied.'),
	pageSize: z
		.number()
		.int()
		.min(1)
		.max(MAX_PAGE_SIZE)
		.default(DEFAULT_PAGE_SIZE)
		.describe('Maximum results to return.'),
	cursor: z.string().trim().optional().describe('Opaque nextCursor from a previous response.')
};

const catalogFilterInputSchema = {
	query: z
		.string()
		.trim()
		.optional()
		.describe('Text matched against titles, descriptions, people, songs, and artists.'),
	includePaid: z.boolean().default(true).describe('Whether paid-provider titles may be returned.'),
	types: z
		.array(z.enum(['movie', 'series']))
		.optional()
		.describe('Restrict results to films and/or series.'),
	availability: z
		.enum(['available', 'unavailable', 'all'])
		.default('all')
		.describe('Filter by current playback availability.'),
	providers: z
		.array(z.string().trim().min(1))
		.optional()
		.describe('Provider names to match, such as YouTube or Vimeo.'),
	yearMin: z
		.number()
		.int()
		.min(1900)
		.max(2200)
		.optional()
		.describe('Minimum release year, inclusive.'),
	yearMax: z
		.number()
		.int()
		.min(1900)
		.max(2200)
		.optional()
		.describe('Maximum release year, inclusive.'),
	durationMinMinutes: z
		.number()
		.int()
		.min(0)
		.max(1440)
		.optional()
		.describe('Minimum known film duration.'),
	durationMaxMinutes: z
		.number()
		.int()
		.min(1)
		.max(1440)
		.optional()
		.describe('Maximum known film duration.'),
	minimumRating: z.number().min(0).max(10).optional().describe('Minimum community average rating.'),
	creator: z.string().trim().optional().describe('Creator or filmmaker name.'),
	athlete: z.string().trim().optional().describe('Featured athlete name.'),
	contentWarnings: z
		.array(z.enum(CONTENT_WARNING_OPTIONS))
		.optional()
		.describe('Warnings that must be present.'),
	excludeContentWarnings: z
		.array(z.enum(CONTENT_WARNING_OPTIONS))
		.optional()
		.describe('Warnings that must not be present.'),
	facets: facetSelectionSchema
};

function catalogFiltersFromArgs(args: Record<string, unknown>) {
	return {
		query: args.query as string | undefined,
		includePaid: args.includePaid as boolean | undefined,
		types: args.types as Array<'movie' | 'series'> | undefined,
		availability: args.availability as 'available' | 'unavailable' | 'all' | undefined,
		providers: args.providers as string[] | undefined,
		yearMin: args.yearMin as number | undefined,
		yearMax: args.yearMax as number | undefined,
		durationMinMinutes: args.durationMinMinutes as number | undefined,
		durationMaxMinutes: args.durationMaxMinutes as number | undefined,
		minimumRating: args.minimumRating as number | undefined,
		creator: args.creator as string | undefined,
		athlete: args.athlete as string | undefined,
		contentWarnings: args.contentWarnings as string[] | undefined,
		excludeContentWarnings: args.excludeContentWarnings as string[] | undefined,
		facets: args.facets as Record<string, string[] | undefined> | undefined
	};
}

async function loadPersonProfile(slug: string) {
	const supabase = createSupabaseClient();
	const { data, error } = await supabase
		.from('person_profiles')
		.select('slug, name, instagram_handles, created_at, updated_at')
		.eq('slug', slug)
		.maybeSingle();
	if (error && error.code !== '42P01') throw new Error(error.message);
	return data
		? {
				slug: data.slug,
				name: data.name,
				instagramHandles: data.instagram_handles ?? [],
				instagramUrls: (data.instagram_handles ?? []).map(
					(handle) => `https://www.instagram.com/${handle}/`
				),
				updatedAt: data.updated_at
			}
		: null;
}

async function buildPersonPayload(
	items: ContentItem[],
	slugOrName: string,
	role: 'creator' | 'athlete' | 'any',
	paging: { page: number; pageSize: number; cursor?: string }
) {
	const targetSlug = slugify(slugOrName);
	if (!targetSlug) throw new Error('Could not derive a person slug from the input.');
	const person = buildPeopleIndex(items).find((entry) => entry.slug === targetSlug);
	if (!person) throw new Error('Person not found in the Jumpflix catalog.');

	const related = items.filter((item) => {
		const creatorMatch = item.creators?.some((name) => slugify(name) === targetSlug) ?? false;
		const athleteMatch = item.starring?.some((name) => slugify(name) === targetSlug) ?? false;
		return role === 'creator'
			? creatorMatch
			: role === 'athlete'
				? athleteMatch
				: creatorMatch || athleteMatch;
	});
	const page = paginateWithCursor(sortCatalogItems(related, 'title-asc'), {
		...paging,
		maxPageSize: MAX_PAGE_SIZE
	});
	const profile = await loadPersonProfile(targetSlug);
	return {
		person: {
			name: profile?.name ?? person.name,
			slug: person.slug,
			url: toPersonUrl(person.slug),
			resourceUri: personResourceUri(person.slug),
			roles: person.roles,
			mediaCount: person.mediaCount,
			profile
		},
		page,
		items: page.items.map(toMediaSummary)
	};
}

type PublicSpotChapter = {
	id: number;
	spotId: string;
	startSeconds: number;
	endSeconds: number;
	mediaType: 'movie' | 'series';
	playbackKey: string | null;
};

async function querySpotChapters(filters: {
	mediaId?: number;
	spotIds?: string[];
	playbackKey?: string;
}): Promise<PublicSpotChapter[]> {
	const supabase = createSupabaseClient();
	let query = supabase
		.from('spot_chapters')
		.select('id, media_id, media_type, playback_key, spot_id, start_seconds, end_seconds')
		.order('start_seconds', { ascending: true })
		.limit(1000);
	if (filters.mediaId !== undefined) query = query.eq('media_id', filters.mediaId);
	if (filters.spotIds?.length) query = query.in('spot_id', filters.spotIds);
	if (filters.playbackKey) query = query.eq('playback_key', filters.playbackKey);
	const { data, error } = await query;
	if (error) {
		if (error.code === '42P01') return [];
		throw new Error(error.message);
	}
	const rows = data ?? [];
	const canonical = await canonicalizeSpotChapterRows(
		rows.map((row) => ({
			id: Number(row.id),
			media_id: Number(row.media_id),
			media_type: row.media_type as 'movie' | 'series',
			playback_key: row.playback_key,
			spot_id: String(row.spot_id),
			start_seconds: Number(row.start_seconds),
			end_seconds: Number(row.end_seconds)
		})),
		{ persist: false }
	);
	return rows.map((row) => ({
		id: Number(row.id),
		spotId: canonical.get(Number(row.id)) ?? String(row.spot_id),
		startSeconds: Number(row.start_seconds),
		endSeconds: Number(row.end_seconds),
		mediaType: row.media_type as 'movie' | 'series',
		playbackKey: row.playback_key || null,
		mediaId: Number(row.media_id)
	})) as Array<PublicSpotChapter & { mediaId: number }>;
}

async function hydratePublicChapters(chapters: PublicSpotChapter[]) {
	const hydrated = await hydrateSpotInfo(
		chapters.map((chapter) => ({
			suggestionId: chapter.id,
			spotId: chapter.spotId,
			startSeconds: chapter.startSeconds,
			endSeconds: chapter.endSeconds,
			playbackKey: chapter.playbackKey,
			spot: null
		}))
	);
	return hydrated.map((chapter) => ({
		id: chapter.suggestionId,
		spotId: chapter.spotId,
		spot: chapter.spot,
		resourceUri: spotResourceUri(chapter.spotId),
		startSeconds: chapter.startSeconds,
		endSeconds: chapter.endSeconds,
		playbackKey: chapter.playbackKey ?? null
	}));
}

function registerCatalogTools(server: McpServer) {
	server.registerTool(
		'catalog_search',
		{
			title: 'Search Jumpflix Catalog',
			description:
				'Search Jumpflix films and series using text, feed presets, people, availability, provider, rating, warning, duration, year, and creative-facet filters. Returns compact summaries and resource links.',
			inputSchema: {
				...catalogFilterInputSchema,
				feed: z.string().trim().optional().describe('Named feed slug from catalog_feeds.'),
				sort: z
					.enum([
						'default',
						'relevance',
						'added-desc',
						'title-asc',
						'year-desc',
						'year-asc',
						'duration-asc',
						'duration-desc',
						'rating-desc',
						'rating-asc'
					])
					.default('default')
					.describe('Result ordering; default uses relevance when query is present.'),
				...pagingInputSchema
			},
			outputSchema: searchOutputSchema,
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_search', async () => {
				const items = await loadCatalog();
				if (args.feed && !getFeedBySlug(args.feed)) throw new Error(`Unknown feed: ${args.feed}`);
				const filters = catalogFiltersFromArgs(args as unknown as Record<string, unknown>);
				const filtered = items
					.filter((item) => matchesFeed(item, args.feed))
					.filter((item) => matchesCatalogFilters(item, filters));
				const sorted = sortCatalogItems(filtered, args.sort, args.query ?? '');
				const page = paginateWithCursor(sorted, { ...args, maxPageSize: MAX_PAGE_SIZE });
				const summaries = page.items.map(toMediaSummary);
				return {
					data: {
						metadata: responseMetadata(items),
						query: args.query ?? '',
						feed: args.feed ?? null,
						sort: args.sort,
						...page,
						items: summaries
					},
					text: summaryText('catalog_search', page.total, page.items.length),
					links: page.items.map(mediaLink)
				};
			})
	);

	server.registerTool(
		'catalog_get',
		{
			title: 'Get Jumpflix Title',
			description:
				'Get full public metadata for one Jumpflix film or series. Includes description, warnings, official public source, people, facets, ratings, tracklist or season summaries, and canonical links; private stream URLs are never returned.',
			inputSchema: {
				id: z.number().int().positive().optional().describe('Numeric Jumpflix media ID.'),
				slug: z.string().trim().optional().describe('Canonical Jumpflix slug.'),
				type: z.enum(['movie', 'series']).optional().describe('Use when a slug is ambiguous.'),
				maxTracks: z
					.number()
					.int()
					.min(1)
					.max(MAX_TRACK_LIMIT)
					.optional()
					.describe('Maximum movie tracks to include.'),
				maxSeasons: z
					.number()
					.int()
					.min(1)
					.max(MAX_SEASON_LIMIT)
					.optional()
					.describe('Maximum series seasons to include.')
			},
			outputSchema: getOutputSchema,
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_get', async () => {
				const items = await loadCatalog();
				const item = findCatalogItem(items, args);
				const detail = toMediaDetail(item, {
					maxTracks: clampLimit(args.maxTracks, DEFAULT_TRACK_LIMIT, MAX_TRACK_LIMIT),
					maxSeasons: clampLimit(args.maxSeasons, DEFAULT_SEASON_LIMIT, MAX_SEASON_LIMIT)
				});
				return {
					data: { metadata: responseMetadata(items), ...detail },
					text: `catalog_get: found ${item.type} “${item.title}”.`,
					links: [mediaLink(item)]
				};
			})
	);

	server.registerTool(
		'catalog_by_person',
		{
			title: 'Find Titles by Person',
			description:
				'Resolve an exact creator or athlete and list their Jumpflix titles. Use person_search first for partial or misspelled names.',
			inputSchema: {
				person: z.string().trim().min(1).describe('Exact person name or canonical person slug.'),
				role: z
					.enum(['creator', 'athlete', 'any'])
					.default('any')
					.describe('Which relationship to include.'),
				...pagingInputSchema
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				person: z.record(z.string(), z.unknown()),
				...cursorFields,
				items: z.array(mediaSummaryOutputSchema),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_by_person', async () => {
				const items = await loadCatalog();
				const result = await buildPersonPayload(items, args.person, args.role, args);
				return {
					data: {
						metadata: responseMetadata(items),
						person: result.person,
						...result.page,
						items: result.items
					},
					text: summaryText('catalog_by_person', result.page.total, result.page.items.length),
					links: [personLink(result.person), ...result.page.items.map(mediaLink)]
				};
			})
	);

	server.registerTool(
		'catalog_by_spot',
		{
			title: 'Find Titles by Parkour Spot',
			description:
				'Resolve a parkour.spot ID and return Jumpflix films or series containing approved chapters at that location.',
			inputSchema: {
				spotId: z
					.string()
					.trim()
					.min(1)
					.describe('parkour.spot identifier; duplicate IDs are resolved read-only.'),
				maxChaptersPerItem: z
					.number()
					.int()
					.min(1)
					.max(MAX_CHAPTER_LIMIT)
					.optional()
					.describe('Maximum matching timestamps per title.'),
				...pagingInputSchema
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				requestedSpotId: z.string(),
				resolvedSpotId: z.string(),
				spot: z.record(z.string(), z.unknown()).nullable(),
				...cursorFields,
				items: z.array(
					z.object({
						media: mediaSummaryOutputSchema,
						chapters: z.array(z.record(z.string(), z.unknown()))
					})
				),
				resultLimit: resultLimitOutputSchema,
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_by_spot', async () => {
				const items = await loadCatalog();
				const requestedSpotId = normalizeParkourSpotId(args.spotId) ?? args.spotId.trim();
				const resolvedSpotId = await resolveSpotId(requestedSpotId);
				const chapters = (await querySpotChapters({
					spotIds: [requestedSpotId, resolvedSpotId]
				})) as Array<PublicSpotChapter & { mediaId: number }>;
				const byMedia = new Map<number, PublicSpotChapter[]>();
				for (const chapter of chapters.filter((entry) => entry.spotId === resolvedSpotId)) {
					const mediaId = Number((chapter as PublicSpotChapter & { mediaId: number }).mediaId);
					if (!byMedia.has(mediaId)) byMedia.set(mediaId, []);
					byMedia.get(mediaId)!.push(chapter);
				}
				const itemById = new Map(items.map((item) => [Number(item.id), item]));
				const maxChapters = clampLimit(
					args.maxChaptersPerItem,
					DEFAULT_CHAPTER_LIMIT,
					MAX_CHAPTER_LIMIT
				);
				let removed = 0;
				const groups = Array.from(byMedia.entries()).flatMap(([mediaId, values]) => {
					const item = itemById.get(mediaId);
					if (!item) return [];
					removed += Math.max(0, values.length - maxChapters);
					return [{ media: item, chapters: values.slice(0, maxChapters) }];
				});
				const page = paginateWithCursor(groups, { ...args, maxPageSize: MAX_PAGE_SIZE });
				const spotRaw = await fetchSpotById(resolvedSpotId).catch(() => null);
				const spot = normalizeParkourSpotPayload(spotRaw, resolvedSpotId);
				return {
					data: {
						metadata: responseMetadata(items),
						requestedSpotId,
						resolvedSpotId,
						spot: spot
							? {
									id: spot.id,
									name: spot.name,
									lat: spot.lat,
									lng: spot.lng,
									resourceUri: spotResourceUri(spot.id)
								}
							: null,
						...page,
						items: page.items.map((entry) => ({
							media: toMediaSummary(entry.media),
							chapters: entry.chapters
						})),
						...(removed
							? { resultLimit: { removedChapters: removed, maxChaptersPerItem: maxChapters } }
							: {})
					},
					text: summaryText('catalog_by_spot', page.total, page.items.length),
					links: [
						...(spot ? [spotLink(spot)] : []),
						...page.items.map((entry) => mediaLink(entry.media))
					]
				};
			})
	);

	server.registerTool(
		'catalog_facets',
		{
			title: 'Get Jumpflix Facet Taxonomy',
			description:
				'Return the current creative facets, computed helper facets, and content-warning vocabulary used by catalog_search and catalog_discover.',
			inputSchema: {
				includeDescriptions: z
					.boolean()
					.default(true)
					.describe('Include human-readable definitions for every value.')
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				manual: z.record(z.string(), z.unknown()),
				computed: z.record(z.string(), z.unknown()),
				contentWarnings: z.record(z.string(), z.unknown()),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_facets', async () => {
				const items = await loadCatalog();
				const section = (
					options: readonly string[],
					labels: Record<string, string>,
					descriptions: Record<string, string>
				) => ({
					options,
					labels,
					...(args.includeDescriptions ? { descriptions } : {})
				});
				return {
					data: {
						metadata: responseMetadata(items),
						manual: {
							type: section(FACET_TYPE_OPTIONS, FACET_TYPE_LABELS, FACET_TYPE_DESCRIPTIONS),
							focus: section(FACET_FOCUS_OPTIONS, FACET_FOCUS_LABELS, FACET_FOCUS_DESCRIPTIONS),
							movement: section(
								FACET_MOVEMENT_OPTIONS,
								FACET_MOVEMENT_LABELS,
								FACET_MOVEMENT_DESCRIPTIONS
							),
							environment: section(
								FACET_ENVIRONMENT_OPTIONS,
								FACET_ENVIRONMENT_LABELS,
								FACET_ENVIRONMENT_DESCRIPTIONS
							),
							production: section(
								FACET_PRODUCTION_OPTIONS,
								FACET_PRODUCTION_LABELS,
								FACET_PRODUCTION_DESCRIPTIONS
							),
							presentation: section(
								FACET_PRESENTATION_OPTIONS,
								FACET_PRESENTATION_LABELS,
								FACET_PRESENTATION_DESCRIPTIONS
							),
							medium: section(FACET_MEDIUM_OPTIONS, FACET_MEDIUM_LABELS, FACET_MEDIUM_DESCRIPTIONS)
						},
						computed: {
							era: ['pre-2000', '2000s', '2010s', '2020s', '2030s'],
							length: ['short-form', 'medium-form', 'long-form']
						},
						contentWarnings: section(
							CONTENT_WARNING_OPTIONS,
							CONTENT_WARNING_LABELS,
							CONTENT_WARNING_DESCRIPTIONS
						)
					},
					text: 'catalog_facets: returned the current Jumpflix taxonomy.',
					links: [
						{
							type: 'resource_link',
							uri: 'jumpflix://taxonomy/facets',
							name: 'Jumpflix Facet Taxonomy',
							mimeType: 'application/json'
						}
					]
				};
			})
	);

	server.registerTool(
		'catalog_feeds',
		{
			title: 'List Jumpflix Feeds',
			description:
				'List curated Jumpflix feed presets with their titles, descriptions, and machine-readable filter definitions.',
			inputSchema: {},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				feeds: z.array(
					z.object({
						slug: z.string(),
						resourceUri: z.string(),
						title: z.string(),
						description: z.string(),
						filter: z.record(z.string(), z.unknown())
					})
				),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async () =>
			runTool('catalog_feeds', async () => {
				const items = await loadCatalog();
				return {
					data: {
						metadata: responseMetadata(items),
						feeds: FEEDS.map((feed) => ({
							slug: feed.slug,
							resourceUri: feedResourceUri(feed.slug),
							title: feed.title(),
							description: feed.description(),
							filter: feed.filter
						}))
					},
					text: `catalog_feeds: returned ${FEEDS.length} curated feeds.`,
					links: FEEDS.map(feedLink)
				};
			})
	);
}

function registerDiscoveryTools(server: McpServer) {
	server.registerTool(
		'catalog_list_episodes',
		{
			title: 'List Series Episodes',
			description:
				'List seasons and public episode metadata for one Jumpflix series, including canonical Jumpflix episode URLs.',
			inputSchema: {
				id: z.number().int().positive().optional().describe('Numeric series media ID.'),
				slug: z.string().trim().optional().describe('Canonical series slug.'),
				seasonNumber: z.number().int().min(1).optional().describe('Restrict to one season number.'),
				maxEpisodes: z
					.number()
					.int()
					.min(1)
					.max(MAX_EPISODE_LIMIT)
					.optional()
					.describe('Maximum episodes across all returned seasons.')
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				series: mediaSummaryOutputSchema,
				seasons: z.array(z.record(z.string(), z.unknown())),
				totalEpisodes: z.number(),
				returnedEpisodes: z.number(),
				hasMore: z.boolean(),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_list_episodes', async () => {
				const items = await loadCatalog();
				const item = findCatalogItem(items, { ...args, type: 'series' });
				if (!isSeries(item)) throw new Error('Catalog item is not a series.');
				const seasons = item.seasons.filter(
					(season) => !args.seasonNumber || season.seasonNumber === args.seasonNumber
				);
				if (args.seasonNumber && seasons.length === 0)
					throw new Error(`Season ${args.seasonNumber} was not found.`);
				const loaded = await Promise.all(
					seasons.map(async (season) => ({
						season,
						episodes: season.id ? await fetchEpisodesBySeasonId(season.id) : []
					}))
				);
				const maxEpisodes = clampLimit(args.maxEpisodes, DEFAULT_EPISODE_LIMIT, MAX_EPISODE_LIMIT);
				let remaining = maxEpisodes;
				let returnedEpisodes = 0;
				const seasonPayloads = loaded.map(({ season, episodes }) => {
					const limited = episodes.slice(0, Math.max(0, remaining));
					remaining -= limited.length;
					returnedEpisodes += limited.length;
					return {
						id: season.id ?? null,
						seasonNumber: season.seasonNumber,
						customName: season.customName ?? null,
						totalEpisodes: episodes.length,
						episodes: limited.map((episode, index) => {
							const episodeNumber = episode.position ?? index + 1;
							return {
								id: episode.id,
								episodeNumber,
								title: episode.title,
								description: episode.description ?? null,
								publishedAt: episode.publishedAt ?? null,
								thumbnail: episode.thumbnail ?? null,
								duration: episode.duration ?? null,
								externalUrl: episode.externalUrl ?? null,
								url: `https://www.jumpflix.tv/series/${item.slug}/seasons/${season.seasonNumber}/episodes/${episodeNumber}`
							};
						})
					};
				});
				const totalEpisodes = loaded.reduce((sum, entry) => sum + entry.episodes.length, 0);
				return {
					data: {
						metadata: responseMetadata(items),
						series: toMediaSummary(item),
						seasons: seasonPayloads,
						totalEpisodes,
						returnedEpisodes,
						hasMore: returnedEpisodes < totalEpisodes
					},
					text: `catalog_list_episodes: returned ${returnedEpisodes} of ${totalEpisodes} episodes for “${item.title}”.`,
					links: [mediaLink(item)]
				};
			})
	);

	server.registerTool(
		'catalog_spots_in_item',
		{
			title: 'List Spots in a Jumpflix Title',
			description:
				'List approved parkour.spot chapters and timestamps found in one film or series. Reads never rewrite source chapter rows.',
			inputSchema: {
				id: z.number().int().positive().optional(),
				slug: z.string().trim().optional(),
				type: z.enum(['movie', 'series']).optional(),
				playbackKey: z
					.string()
					.trim()
					.optional()
					.describe('Optional episode playback key for a series.'),
				maxChapters: z.number().int().min(1).max(MAX_CHAPTER_LIMIT).optional()
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				media: mediaSummaryOutputSchema,
				total: z.number(),
				chapters: z.array(z.record(z.string(), z.unknown())),
				resultLimit: resultLimitOutputSchema,
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_spots_in_item', async () => {
				const items = await loadCatalog();
				const item = findCatalogItem(items, args);
				const chapters = await querySpotChapters({
					mediaId: Number(item.id),
					playbackKey: args.playbackKey
				});
				const max = clampLimit(args.maxChapters, DEFAULT_CHAPTER_LIMIT, MAX_CHAPTER_LIMIT);
				const hydrated = await hydratePublicChapters(chapters.slice(0, max));
				const spots = Array.from(
					new Map(
						hydrated
							.filter((chapter) => chapter.spot)
							.map((chapter) => [chapter.spotId, { id: chapter.spotId, name: chapter.spot!.name }])
					).values()
				);
				return {
					data: {
						metadata: responseMetadata(items),
						media: toMediaSummary(item),
						total: chapters.length,
						chapters: hydrated,
						...(chapters.length > max
							? { resultLimit: { returned: max, total: chapters.length, limit: max } }
							: {})
					},
					text: `catalog_spots_in_item: returned ${hydrated.length} of ${chapters.length} chapters for “${item.title}”.`,
					links: [mediaLink(item), ...spots.map(spotLink)]
				};
			})
	);

	server.registerTool(
		'spot_search',
		{
			title: 'Search Parkour Spots',
			description:
				'Search parkour.spot by name and/or geographic bounding box, returning normalized public location resources.',
			inputSchema: {
				query: z.string().trim().optional().describe('Spot or place name.'),
				minLat: z.number().min(-90).max(90).optional(),
				maxLat: z.number().min(-90).max(90).optional(),
				minLng: z.number().min(-180).max(180).optional(),
				maxLng: z.number().min(-180).max(180).optional(),
				limit: z.number().int().min(1).max(50).default(20)
			},
			outputSchema: z.object({
				metadata: z.object({ source: z.string(), generatedAt: z.string() }),
				total: z.number(),
				spots: z.array(
					z.object({
						id: z.string(),
						name: z.string(),
						lat: z.number(),
						lng: z.number(),
						resourceUri: z.string()
					})
				),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: OPEN_WORLD_READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('spot_search', async () => {
				if (args.minLat !== undefined && args.maxLat !== undefined && args.minLat > args.maxLat)
					throw new Error('minLat must not exceed maxLat.');
				if (args.minLng !== undefined && args.maxLng !== undefined && args.minLng > args.maxLng)
					throw new Error('minLng must not exceed maxLng.');
				const raw = await searchSpots({
					q: args.query,
					minLat: args.minLat?.toString(),
					maxLat: args.maxLat?.toString(),
					minLng: args.minLng?.toString(),
					maxLng: args.maxLng?.toString(),
					limit: args.limit.toString()
				});
				const spots = normalizeSpotSearchResults(raw).slice(0, args.limit) as Array<{
					id: string;
					name: string;
					lat: number;
					lng: number;
					resourceUri: string;
				}>;
				return {
					data: {
						metadata: { source: 'parkour.spot', generatedAt: new Date().toISOString() },
						total: spots.length,
						spots
					},
					text: `spot_search: returned ${spots.length} spots.`,
					links: spots.map(spotLink)
				};
			})
	);

	server.registerTool(
		'person_search',
		{
			title: 'Search Jumpflix People',
			description:
				'Search creators and athletes by partial name before using person_get or catalog_by_person.',
			inputSchema: {
				query: z.string().trim().min(1).describe('Partial person name.'),
				role: z.enum(['creator', 'athlete', 'any']).default('any'),
				...pagingInputSchema
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				...cursorFields,
				people: z.array(z.record(z.string(), z.unknown())),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('person_search', async () => {
				const items = await loadCatalog();
				const needle = slugify(args.query);
				const matches = buildPeopleIndex(items)
					.filter((person) => person.slug.includes(needle) || needle.includes(person.slug))
					.filter((person) => args.role === 'any' || person.roles[args.role]);
				const page = paginateWithCursor(matches, { ...args, maxPageSize: MAX_PAGE_SIZE });
				const people = await Promise.all(
					page.items.map(async (person) => ({
						...person,
						url: toPersonUrl(person.slug),
						resourceUri: personResourceUri(person.slug),
						profile: await loadPersonProfile(person.slug)
					}))
				);
				return {
					data: { metadata: responseMetadata(items), ...paginationMetadata(page), people },
					text: summaryText('person_search', page.total, people.length),
					links: people.map(personLink)
				};
			})
	);

	server.registerTool(
		'person_get',
		{
			title: 'Get Jumpflix Person Profile',
			description:
				'Get one creator or athlete profile, public social links, roles, and related Jumpflix titles.',
			inputSchema: {
				person: z.string().trim().min(1).describe('Exact name or canonical person slug.'),
				...pagingInputSchema
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				person: z.record(z.string(), z.unknown()),
				...cursorFields,
				items: z.array(mediaSummaryOutputSchema),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('person_get', async () => {
				const items = await loadCatalog();
				const result = await buildPersonPayload(items, args.person, 'any', args);
				return {
					data: {
						metadata: responseMetadata(items),
						person: result.person,
						...result.page,
						items: result.items
					},
					text: `person_get: found ${result.person.name} with ${result.page.total} related titles.`,
					links: [personLink(result.person), ...result.page.items.map(mediaLink)]
				};
			})
	);

	server.registerTool(
		'catalog_by_track',
		{
			title: 'Find Jumpflix Titles by Music Track',
			description:
				'Find movie tracklist occurrences by song title, artist, Jumpflix song ID, or Spotify track ID.',
			inputSchema: {
				query: z.string().trim().optional().describe('Song title or artist text.'),
				songId: z.number().int().positive().optional(),
				spotifyTrackId: z.string().trim().optional(),
				...pagingInputSchema
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				query: z.string(),
				...cursorFields,
				occurrences: z.array(
					z.object({ track: z.record(z.string(), z.unknown()), media: mediaSummaryOutputSchema })
				),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_by_track', async () => {
				if (!args.query && !args.songId && !args.spotifyTrackId)
					throw new Error('Provide query, songId, or spotifyTrackId.');
				const items = await loadCatalog();
				const needle = args.query?.toLowerCase() ?? '';
				const occurrences = items.filter(isMovie).flatMap((item) =>
					(item.tracks ?? []).flatMap((track: VideoTrack) => {
						const matchesQuery =
							!needle ||
							track.song.title.toLowerCase().includes(needle) ||
							track.song.artist.toLowerCase().includes(needle);
						const matchesId = !args.songId || track.song.id === args.songId;
						const matchesSpotify =
							!args.spotifyTrackId || track.song.spotifyTrackId === args.spotifyTrackId;
						if (!matchesQuery || !matchesId || !matchesSpotify) return [];
						return [{ track, media: item }];
					})
				);
				const page = paginateWithCursor(occurrences, { ...args, maxPageSize: MAX_PAGE_SIZE });
				const payloadOccurrences = page.items.map(({ track, media }) => ({
					track: {
						startAtSeconds: track.startAtSeconds ?? null,
						startTimecode: track.startTimecode ?? null,
						song: {
							...track.song,
							spotifyTrackId: track.song.spotifyTrackId ?? null,
							spotifyUrl: track.song.spotifyUrl ?? null
						}
					},
					media: toMediaSummary(media)
				}));
				return {
					data: {
						metadata: responseMetadata(items),
						query: args.query ?? '',
						...paginationMetadata(page),
						occurrences: payloadOccurrences
					},
					text: summaryText('catalog_by_track', page.total, page.items.length),
					links: page.items.map((entry) => mediaLink(entry.media))
				};
			})
	);

	server.registerTool(
		'catalog_discover',
		{
			title: 'Discover Jumpflix Recommendations',
			description:
				'Return deterministic, explainable, diverse catalog recommendations using natural-language text, seed titles, ratings, availability, duration, year, people, warnings, and facets.',
			inputSchema: {
				...catalogFilterInputSchema,
				seedSlugs: z
					.array(z.string().trim().min(1))
					.max(10)
					.optional()
					.describe('Titles whose people and facets should influence ranking.'),
				excludeIds: z
					.array(z.union([z.number(), z.string()]))
					.max(200)
					.optional(),
				limit: z.number().int().min(1).max(20).default(10)
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				query: z.string(),
				seedSlugs: z.array(z.string()),
				items: z.array(
					z.object({
						media: mediaSummaryOutputSchema,
						score: z.number(),
						reasons: z.array(z.string())
					})
				),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_discover', async () => {
				const items = await loadCatalog();
				const results = discoverCatalog(items, {
					...catalogFiltersFromArgs(args as unknown as Record<string, unknown>),
					seedSlugs: args.seedSlugs,
					excludeIds: args.excludeIds,
					limit: args.limit
				});
				return {
					data: {
						metadata: responseMetadata(items),
						query: args.query ?? '',
						seedSlugs: args.seedSlugs ?? [],
						items: results.map((result) => ({
							media: toMediaSummary(result.item),
							score: result.score,
							reasons: result.reasons
						}))
					},
					text: `catalog_discover: returned ${results.length} explainable recommendations.`,
					links: results.map((result) => mediaLink(result.item))
				};
			})
	);

	server.registerTool(
		'catalog_reviews',
		{
			title: 'List Public Jumpflix Reviews',
			description:
				'List public community reviews for one catalog title. User IDs are never returned.',
			inputSchema: {
				id: z.number().int().positive().optional(),
				slug: z.string().trim().optional(),
				type: z.enum(['movie', 'series']).optional(),
				...pagingInputSchema
			},
			outputSchema: z.object({
				metadata: metadataOutputSchema,
				media: mediaSummaryOutputSchema,
				...cursorFields,
				reviews: z.array(
					z.object({
						id: z.number(),
						authorName: z.string().nullable(),
						body: z.string(),
						createdAt: z.string(),
						updatedAt: z.string()
					})
				),
				transportLimit: transportLimitOutputSchema.optional()
			}),
			annotations: READ_ONLY_TOOL_ANNOTATIONS
		},
		async (args) =>
			runTool('catalog_reviews', async () => {
				const items = await loadCatalog();
				const item = findCatalogItem(items, args);
				const offset = cursorOffset(args.cursor, (args.page - 1) * args.pageSize);
				const supabase = createSupabaseClient();
				// The generated Supabase types do not include this SQL view yet.
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const { data, error, count } = await (supabase as any)
					.from('reviews_with_author')
					.select('id, media_id, author_name, body, created_at, updated_at', { count: 'exact' })
					.eq('media_id', Number(item.id))
					.order('updated_at', { ascending: false })
					.range(offset, offset + args.pageSize - 1);
				if (error) {
					if (error.code === '42P01')
						throw new Error('Reviews are not available on this deployment.');
					throw new Error(error.message);
				}
				const rows = (data ?? []) as PublicReviewRow[];
				const total = Number(count ?? rows.length);
				const hasMore = offset + rows.length < total;
				const nextCursor = hasMore
					? Buffer.from(JSON.stringify({ offset: offset + rows.length })).toString('base64url')
					: null;
				return {
					data: {
						metadata: responseMetadata(items),
						media: toMediaSummary(item),
						total,
						page: Math.floor(offset / args.pageSize) + 1,
						pageSize: args.pageSize,
						hasMore,
						nextCursor,
						reviews: rows.map((row) => ({
							id: Number(row.id),
							authorName: row.author_name ?? null,
							body: String(row.body),
							createdAt: row.created_at,
							updatedAt: row.updated_at
						}))
					},
					text: summaryText('catalog_reviews', total, rows.length),
					links: [mediaLink(item)]
				};
			})
	);
}

function jsonResource(uri: URL, data: unknown) {
	return {
		contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }]
	};
}

function variable(variables: Record<string, string | string[]>, name: string): string {
	const value = variables[name];
	return decodeURIComponent(Array.isArray(value) ? (value[0] ?? '') : (value ?? ''));
}

function registerCatalogResources(server: McpServer) {
	server.registerResource(
		'jumpflix-facet-taxonomy',
		'jumpflix://taxonomy/facets',
		{
			title: 'Jumpflix Facet Taxonomy',
			description: 'Creative facets and content warnings used throughout the Jumpflix catalog.',
			mimeType: 'application/json',
			annotations: { audience: ['assistant'], priority: 0.9 }
		},
		async (uri) =>
			jsonResource(uri, {
				manual: {
					type: {
						options: FACET_TYPE_OPTIONS,
						labels: FACET_TYPE_LABELS,
						descriptions: FACET_TYPE_DESCRIPTIONS
					},
					focus: {
						options: FACET_FOCUS_OPTIONS,
						labels: FACET_FOCUS_LABELS,
						descriptions: FACET_FOCUS_DESCRIPTIONS
					},
					movement: {
						options: FACET_MOVEMENT_OPTIONS,
						labels: FACET_MOVEMENT_LABELS,
						descriptions: FACET_MOVEMENT_DESCRIPTIONS
					},
					environment: {
						options: FACET_ENVIRONMENT_OPTIONS,
						labels: FACET_ENVIRONMENT_LABELS,
						descriptions: FACET_ENVIRONMENT_DESCRIPTIONS
					},
					production: {
						options: FACET_PRODUCTION_OPTIONS,
						labels: FACET_PRODUCTION_LABELS,
						descriptions: FACET_PRODUCTION_DESCRIPTIONS
					},
					presentation: {
						options: FACET_PRESENTATION_OPTIONS,
						labels: FACET_PRESENTATION_LABELS,
						descriptions: FACET_PRESENTATION_DESCRIPTIONS
					},
					medium: {
						options: FACET_MEDIUM_OPTIONS,
						labels: FACET_MEDIUM_LABELS,
						descriptions: FACET_MEDIUM_DESCRIPTIONS
					}
				},
				computed: {
					era: ['pre-2000', '2000s', '2010s', '2020s', '2030s'],
					length: ['short-form', 'medium-form', 'long-form']
				},
				contentWarnings: {
					options: CONTENT_WARNING_OPTIONS,
					labels: CONTENT_WARNING_LABELS,
					descriptions: CONTENT_WARNING_DESCRIPTIONS
				}
			})
	);

	server.registerResource(
		'jumpflix-catalog-item',
		new ResourceTemplate('jumpflix://catalog/{type}/{slug}', {
			list: async () => {
				const items = await loadCatalog();
				return {
					resources: items.map((item) => ({
						uri: mediaResourceUri(item),
						name: item.title,
						title: item.title,
						description: `${item.type === 'series' ? 'Series' : 'Film'} in the Jumpflix catalog`,
						mimeType: 'application/json',
						annotations: {
							audience: ['assistant', 'user'] as const,
							priority: 0.8,
							...(item.updatedAt ? { lastModified: item.updatedAt } : {})
						}
					}))
				};
			},
			complete: {
				type: () => ['movie', 'series'],
				slug: async (value) =>
					(await loadCatalog())
						.filter((item) => item.slug.startsWith(value))
						.slice(0, 50)
						.map((item) => item.slug)
			}
		}),
		{
			title: 'Jumpflix Catalog Item',
			description: 'Full safe public metadata for a film or series.',
			mimeType: 'application/json',
			annotations: { audience: ['assistant', 'user'], priority: 0.8 }
		},
		async (uri, variables) => {
			const items = await loadCatalog();
			const type = variable(variables, 'type');
			if (type !== 'movie' && type !== 'series') throw new Error('Invalid catalog resource type.');
			const item = findCatalogItem(items, { slug: variable(variables, 'slug'), type });
			return jsonResource(uri, {
				metadata: responseMetadata(items),
				...toMediaDetail(item, { maxTracks: MAX_TRACK_LIMIT, maxSeasons: MAX_SEASON_LIMIT })
			});
		}
	);

	server.registerResource(
		'jumpflix-person',
		new ResourceTemplate('jumpflix://people/{slug}', {
			list: async () => {
				const items = await loadCatalog();
				return {
					resources: buildPeopleIndex(items).map((person) => ({
						uri: personResourceUri(person.slug),
						name: person.name,
						title: person.name,
						description: 'Jumpflix creator or athlete',
						mimeType: 'application/json',
						annotations: { audience: ['assistant', 'user'] as const, priority: 0.7 }
					}))
				};
			},
			complete: {
				slug: async (value) =>
					buildPeopleIndex(await loadCatalog())
						.filter((person) => person.slug.startsWith(value))
						.slice(0, 50)
						.map((person) => person.slug)
			}
		}),
		{
			title: 'Jumpflix Person',
			description: 'Public creator or athlete profile with related titles.',
			mimeType: 'application/json',
			annotations: { audience: ['assistant', 'user'], priority: 0.7 }
		},
		async (uri, variables) => {
			const items = await loadCatalog();
			const result = await buildPersonPayload(items, variable(variables, 'slug'), 'any', {
				page: 1,
				pageSize: MAX_PAGE_SIZE
			});
			return jsonResource(uri, {
				metadata: responseMetadata(items),
				person: result.person,
				total: result.page.total,
				items: result.items
			});
		}
	);

	server.registerResource(
		'jumpflix-spot',
		new ResourceTemplate('jumpflix://spots/{id}', {
			list: undefined,
			complete: undefined
		}),
		{
			title: 'Parkour Spot',
			description: 'Normalized public parkour.spot location referenced by Jumpflix.',
			mimeType: 'application/json',
			annotations: { audience: ['assistant', 'user'], priority: 0.6 }
		},
		async (uri, variables) => {
			const requestedId = variable(variables, 'id');
			const raw = await fetchSpotById(requestedId);
			const spot = normalizeParkourSpotPayload(raw, requestedId);
			if (!spot) throw new Error('Spot not found or did not contain valid coordinates.');
			return jsonResource(uri, {
				metadata: { source: 'parkour.spot', generatedAt: new Date().toISOString() },
				spot: {
					id: spot.id,
					name: spot.name,
					lat: spot.lat,
					lng: spot.lng,
					resourceUri: spotResourceUri(spot.id)
				}
			});
		}
	);

	server.registerResource(
		'jumpflix-feed',
		new ResourceTemplate('jumpflix://feeds/{slug}', {
			list: async () => ({
				resources: FEEDS.map((feed) => ({
					uri: feedResourceUri(feed.slug),
					name: feed.title(),
					title: feed.title(),
					description: feed.description(),
					mimeType: 'application/json',
					annotations: { audience: ['assistant'] as const, priority: 0.5 }
				}))
			}),
			complete: {
				slug: (value) => FEEDS.map((feed) => feed.slug).filter((slug) => slug.startsWith(value))
			}
		}),
		{
			title: 'Jumpflix Feed',
			description: 'Curated discovery feed and its machine-readable filter.',
			mimeType: 'application/json',
			annotations: { audience: ['assistant'], priority: 0.5 }
		},
		async (uri, variables) => {
			const feed = getFeedBySlug(variable(variables, 'slug'));
			if (!feed) throw new Error('Feed not found.');
			return jsonResource(uri, {
				slug: feed.slug,
				title: feed.title(),
				description: feed.description(),
				filter: feed.filter
			});
		}
	);
}

function registerCatalogPrompts(server: McpServer) {
	server.registerPrompt(
		'find-something-to-watch',
		{
			title: 'Find Something to Watch',
			description: 'Turn a viewing request into a focused Jumpflix discovery workflow.',
			argsSchema: {
				request: z.string().trim().min(1).describe('What the user feels like watching.'),
				maxMinutes: z.string().trim().optional().describe('Optional maximum duration in minutes.'),
				includePaid: z
					.string()
					.trim()
					.optional()
					.describe('Whether paid titles are acceptable: true or false.')
			}
		},
		(args) => ({
			messages: [
				{
					role: 'user' as const,
					content: {
						type: 'text' as const,
						text: `Find a small, varied set of Jumpflix titles matching this request: ${args.request}. ${args.maxMinutes ? `Keep films within ${args.maxMinutes} minutes.` : ''} ${args.includePaid ? `Paid titles acceptable: ${args.includePaid}.` : ''} Use catalog_discover or catalog_search, explain why each result fits, and include canonical Jumpflix links.`
					}
				}
			]
		})
	);

	server.registerPrompt(
		'explore-person',
		{
			title: 'Explore a Creator or Athlete',
			description: 'Explore someone’s work across the Jumpflix catalog.',
			argsSchema: { person: z.string().trim().min(1) }
		},
		({ person }) => ({
			messages: [
				{
					role: 'user' as const,
					content: {
						type: 'text' as const,
						text: `Use person_search if necessary, then person_get for “${person}”. Summarize their creator and athlete roles, highlight a representative range of titles, and include canonical Jumpflix links.`
					}
				}
			]
		})
	);

	server.registerPrompt(
		'build-watchlist',
		{
			title: 'Build a Parkour Film Watchlist',
			description: 'Build a varied, explainable Jumpflix watchlist around a theme.',
			argsSchema: { theme: z.string().trim().min(1), count: z.string().trim().optional() }
		},
		({ theme, count }) => ({
			messages: [
				{
					role: 'user' as const,
					content: {
						type: 'text' as const,
						text: `Build a ${count || 'short'} Jumpflix watchlist around “${theme}”. Use catalog_discover, avoid near-duplicate choices, mix eras or formats when possible, and give one concise reason per title.`
					}
				}
			]
		})
	);

	server.registerPrompt(
		'explore-spots',
		{
			title: 'Explore Parkour Spots in Films',
			description: 'Connect parkour locations to Jumpflix films and timestamps.',
			argsSchema: { place: z.string().trim().min(1) }
		},
		({ place }) => ({
			messages: [
				{
					role: 'user' as const,
					content: {
						type: 'text' as const,
						text: `Search for parkour spots matching “${place}” with spot_search. For the best matches, use catalog_by_spot to show which Jumpflix titles feature them and include useful timestamps and canonical links.`
					}
				}
			]
		})
	);
}

export function createJumpflixMcpServer(): McpServer {
	const server = new McpServer(
		{
			name: 'jumpflix-catalog-mcp',
			version: MCP_SERVER_VERSION,
			description:
				'Public discovery server for Jumpflix parkour and freerunning films, series, people, music, reviews, and filming spots.'
		},
		{
			instructions:
				'Use catalog_search or catalog_discover for discovery, catalog_get for full title details, person_search before person_get when a name is uncertain, and spot_search before catalog_by_spot when a spot ID is unknown. Prefer returned resource links for large details. All tools are public and read-only.'
		}
	);

	registerCatalogTools(server);
	registerDiscoveryTools(server);
	registerCatalogResources(server);
	registerCatalogPrompts(server);
	return server;
}
