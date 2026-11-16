import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { decode } from 'html-entities';
import { z } from 'zod';
import type { Database } from '../src/lib/supabase/types';
import { getEpisodeUrl, getUrlForItem } from '../src/lib/tv/slug';

const site = 'https://www.jumpflix.tv';
const id = z.number().int().positive();
const title = z.string().min(1);
const url = z.url().startsWith(`${site}/`);

const catalogSchema = z.strictObject({
	schemaVersion: z.literal(1),
	generatedAt: z.iso.datetime(),
	titles: z
		.array(
			z.strictObject({
				id,
				slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
				type: z.enum(['movie', 'series']),
				title,
				url,
				access: z.enum(['free', 'paid', 'unavailable']),
				year: z.number().int().min(1000).max(9999).nullable(),
				duration: z.string().nullable(),
				creators: z.array(title),
				athletes: z.array(title),
				facets: z.strictObject({
					type: z.string().nullable(),
					focus: z.string().nullable(),
					movement: z.array(z.string()),
					environment: z.string().nullable(),
					production: z.string().nullable(),
					presentation: z.string().nullable(),
					medium: z.string().nullable()
				}),
				contentWarnings: z.array(z.string())
			})
		)
		.min(1),
	seasons: z.array(z.strictObject({ id, seriesId: id, number: id, name: z.string().nullable() })),
	episodes: z.array(
		z.strictObject({ id, seasonId: id, number: id, title, url, duration: z.string().nullable() })
	)
});

const pageSize = 500;

async function readAll<T extends { id: number }>(
	readPage: (
		afterId: number
	) => PromiseLike<{ data: T[] | null; error: { message: string } | null; count: number | null }>
) {
	const rows: T[] = [];
	for (let afterId = 0; ; ) {
		const { data, error, count } = await readPage(afterId);
		if (error || !data || count === null)
			throw new Error(error?.message ?? 'Catalog query returned no count or rows');
		if (data.length > count || (!data.length && count > 0))
			throw new Error('Incomplete catalog page');
		rows.push(...data);
		if (data.length === count) return rows;
		afterId = data[data.length - 1].id;
	}
}

function indexById<T extends { id: number }>(rows: T[], name: string) {
	const index = new Map(rows.map((row) => [row.id, row]));
	if (index.size !== rows.length) throw new Error(`Duplicate IDs in ${name}`);
	return index;
}

const databaseUrl = process.env.PUBLIC_SUPABASE_URL;
const anonKey = process.env.PUBLIC_SUPABASE_ANON_KEY;
if (!databaseUrl || !anonKey)
	throw new Error('Set PUBLIC_SUPABASE_URL and PUBLIC_SUPABASE_ANON_KEY');
const db = createClient<Database>(databaseUrl, anonKey);

const [mediaRows, seasonRows, episodeRows] = await Promise.all([
	readAll((afterId) =>
		db
			.from('media_items')
			.select(
				'id,slug,type,title,availability_status,paid,year,duration,creators,starring,facet_type,facet_focus,facet_movement,facet_environment,facet_production,facet_presentation,facet_medium,content_warnings',
				{ count: 'exact' }
			)
			.gt('id', afterId)
			.order('id')
			.limit(pageSize)
	),
	readAll((afterId) =>
		db
			.from('series_seasons')
			.select('id,series_id,season_number,custom_name', { count: 'exact' })
			.gt('id', afterId)
			.order('id')
			.limit(pageSize)
	),
	readAll((afterId) =>
		db
			.from('series_episodes')
			.select('id,season_id,episode_number,title,duration', { count: 'exact' })
			.gt('id', afterId)
			.order('id')
			.limit(pageSize)
	)
]);

const mediaById = indexById(mediaRows, 'titles');
const seasonsById = indexById(seasonRows, 'seasons');
indexById(episodeRows, 'episodes');

function seriesFor(id: number) {
	const row = mediaById.get(id);
	if (row?.type !== 'series') throw new Error(`Missing series ${id}`);
	return { type: row.type, slug: row.slug } as const;
}

const catalog = catalogSchema.parse({
	schemaVersion: 1,
	generatedAt: new Date().toISOString(),
	titles: mediaRows.map((row) => ({
		id: row.id,
		slug: row.slug,
		type: row.type,
		title: decode(row.title).trim(),
		url: site + getUrlForItem(row),
		access: row.availability_status === 'unavailable' ? 'unavailable' : row.paid ? 'paid' : 'free',
		year: /^\d{4}$/.test(row.year?.trim() ?? '') ? Number(row.year) : null,
		duration: row.duration?.trim() || null,
		creators: (row.creators ?? []).map((name) => decode(name).trim()).filter(Boolean),
		athletes: (row.starring ?? []).map((name) => decode(name).trim()).filter(Boolean),
		facets: {
			type: row.facet_type,
			focus: row.facet_focus,
			movement: row.facet_movement ?? [],
			environment: row.facet_environment,
			production: row.facet_production,
			presentation: row.facet_presentation,
			medium: row.facet_medium
		},
		contentWarnings: row.content_warnings ?? []
	})),
	seasons: seasonRows.map((row) => {
		seriesFor(row.series_id);
		return {
			id: row.id,
			seriesId: row.series_id,
			number: row.season_number,
			name: row.custom_name
		};
	}),
	episodes: episodeRows.map((row) => {
		const season = seasonsById.get(row.season_id);
		if (!season) throw new Error(`Missing season ${row.season_id} for episode ${row.id}`);
		return {
			id: row.id,
			seasonId: row.season_id,
			number: row.episode_number,
			title: decode(row.title ?? '').trim() || `Episode ${row.episode_number}`,
			url:
				site +
				getEpisodeUrl(seriesFor(season.series_id), {
					seasonNumber: season.season_number,
					episodeNumber: row.episode_number
				}),
			duration: row.duration?.trim() || null
		};
	})
});

const output = process.argv[2] ?? '.cache/catalog';
await mkdir(output, { recursive: true });
await Promise.all([
	writeFile(join(output, 'catalog.json'), JSON.stringify(catalog, null, '\t') + '\n'),
	writeFile(
		join(output, 'catalog.schema.json'),
		JSON.stringify(z.toJSONSchema(catalogSchema), null, '\t') + '\n'
	)
]);
console.log(
	`Exported ${catalog.titles.length} titles, ${catalog.seasons.length} seasons, ${catalog.episodes.length} episodes to ${output}`
);
