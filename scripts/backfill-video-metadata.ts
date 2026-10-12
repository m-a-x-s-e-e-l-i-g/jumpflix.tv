import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fetchMovieVideoMetadata } from '../src/lib/server/video-metadata';
import { movieVideoSource, storedVideoDate } from '../src/lib/tv/video-discovery';
import type { Database } from '../src/lib/supabase/types';
import type { Movie } from '../src/lib/tv/types';

config({ quiet: true });
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const option = (name: string) =>
	args.find((arg) => arg.startsWith(`${name}=`))?.slice(name.length + 1);
const limit = Number(option('--limit') || Infinity);
if (!(limit > 0)) throw new Error('--limit must be a positive number');
const url = process.env.PUBLIC_SUPABASE_URL;
const key = apply ? process.env.SUPABASE_SERVICE_ROLE_KEY : process.env.PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key)
	throw new Error(
		apply ? 'Applying requires SUPABASE_SERVICE_ROLE_KEY' : 'Missing public Supabase configuration'
	);
const db = createClient<Database>(url, key, { auth: { persistSession: false } });
const report: Array<Record<string, unknown>> = [];
let checked = 0;
for (let offset = 0; checked < limit; offset += 200) {
	let query = db
		.from('media_items')
		.select('*')
		.eq('type', 'movie')
		.order('id')
		.range(offset, offset + 199);
	if (option('--slug')) query = query.eq('slug', option('--slug')!);
	const { data: rows, error } = await query;
	if (error) throw new Error(`Catalog read failed: ${error.code}`);
	if (!rows?.length) break;
	for (const row of rows) {
		if (checked++ >= limit) break;
		const movie: Movie = {
			id: row.id,
			slug: row.slug,
			title: row.title,
			type: 'movie',
			paid: Boolean(row.paid),
			availabilityStatus: row.availability_status,
			videoId: row.video_id || undefined,
			vimeoId: row.vimeo_id || undefined,
			streamUrl: row.stream_url || undefined
		};
		const source = movieVideoSource(movie);
		if (!source?.embedUrl || storedVideoDate(movie, row.video_metadata)) continue;
		try {
			const metadata = await fetchMovieVideoMetadata(movie);
			if (!metadata) {
				report.push({ slug: row.slug, status: 'no-verified-upload-date' });
				continue;
			}
			let status = 'would-update';
			if (apply) {
				// Match source fields and previous metadata atomically, including null values.
				// media_items does not guarantee that every writer refreshes updated_at.
				let write = db
					.from('media_items')
					.update({ video_metadata: metadata })
					.eq('id', row.id)
					.eq('updated_at', row.updated_at)
					.eq('type', 'movie')
					.eq('availability_status', row.availability_status);
				for (const field of ['video_id', 'vimeo_id', 'stream_url', 'paid'] as const) {
					write = row[field] === null ? write.is(field, null) : write.eq(field, row[field]);
				}
				write =
					row.video_metadata == null
						? write.is('video_metadata', null)
						: write.eq('video_metadata', JSON.stringify(row.video_metadata));
				const { data, error } = await write.select('id, video_metadata');
				if (error) throw new Error(`Metadata write failed: ${error.code}`);
				if (!data?.length) status = 'changed-during-import';
				else if (storedVideoDate(movie, data[0].video_metadata) !== metadata.publishedAt)
					throw new Error('Metadata verification failed');
				else status = 'updated';
			}
			report.push({ slug: row.slug, status, ...metadata });
		} catch (error) {
			report.push({
				slug: row.slug,
				status: 'failed',
				reason: error instanceof Error ? error.message : 'Provider request failed'
			});
			process.exitCode = 1;
		}
	}
	if (rows.length < 200) break;
}
const result = { mode: apply ? 'apply' : 'dry-run', checked: Math.min(checked, limit), report };
if (option('--output')) {
	await mkdir(dirname(option('--output')!), { recursive: true });
	await writeFile(option('--output')!, JSON.stringify(result, null, 2) + '\n');
}
console.log(JSON.stringify(result, null, 2));
