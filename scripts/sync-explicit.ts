#!/usr/bin/env tsx
/**
 * sync-explicit.ts
 *
 * Checks every song in the database that has a Spotify track ID against the
 * Spotify API and updates the `explicit` flag on:
 *
 *   1. `songs` — the individual track record
 *
 * Media-item explicit flags are recomputed by DB triggers, so manual explicit
 * tags on media_items are preserved.
 *
 * Usage:
 *   npx tsx scripts/sync-explicit.ts [--dry-run]
 *
 * Env vars required (same as other scripts):
 *   PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY   (preferred) or PUBLIC_SUPABASE_ANON_KEY
 *   SPOTIFY_CLIENT_ID
 *   SPOTIFY_CLIENT_SECRET
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { fetchSpotifyTracksBatch } from './utils/spotify.js';

dotenv.config({ path: '.env' });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function requireEnv(name: string): string {
	const v = process.env[name];
	if (!v?.trim()) {
		console.error(`❌  Missing env var: ${name}`);
		process.exit(1);
	}
	return v.trim();
}

function chunk<T>(arr: T[], size: number): T[][] {
	const out: T[][] = [];
	for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
	return out;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const DRY_RUN = process.argv.includes('--dry-run');

if (DRY_RUN) console.log('🔍  Dry-run mode — no writes will be made.\n');

const supabaseUrl = requireEnv('PUBLIC_SUPABASE_URL');
const supabaseKey =
	process.env.SUPABASE_SERVICE_ROLE_KEY || requireEnv('PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(supabaseUrl, supabaseKey);

// --- 1. Load every song that has a Spotify track ID -------------------------

console.log('📦  Fetching songs with Spotify track IDs from database…');

const { data: songs, error: songsError } = await (supabase as any)
	.from('songs')
	.select('id, spotify_track_id, explicit')
	.not('spotify_track_id', 'is', null);

if (songsError) {
	console.error('❌  Failed to fetch songs:', songsError.message);
	process.exit(1);
}

if (!songs || songs.length === 0) {
	console.log('ℹ️   No songs with Spotify track IDs found. Nothing to do.');
	process.exit(0);
}

console.log(`   Found ${songs.length} song(s).\n`);

// --- 2. Query Spotify in batches of 50 --------------------------------------

console.log('🎵  Checking Spotify for explicit flags…');

// spotify only allows 50 IDs per request
const batches = chunk(songs, 50);
const spotifyMap = new Map<string, { explicit: boolean }>();

for (let i = 0; i < batches.length; i++) {
	const batch = batches[i];
	const ids = batch.map((s: any) => s.spotify_track_id as string);
	process.stdout.write(`   Batch ${i + 1}/${batches.length} (${ids.length} tracks)… `);

	try {
		const result = await fetchSpotifyTracksBatch(ids);
		for (const [id, data] of result) spotifyMap.set(id, data);
		console.log('✓');
	} catch (err: any) {
		console.log(`\n   ⚠️  Batch failed: ${err.message}. Skipping.`);
	}
}

console.log();

// --- 3. Determine which song rows need updating -----------------------------

type SongUpdate = { id: number; explicit: boolean };
const songUpdates: SongUpdate[] = [];

for (const song of songs as any[]) {
	const spotify = spotifyMap.get(song.spotify_track_id);
	if (spotify === undefined) continue; // Spotify didn't return this track (removed / unavailable)

	if (spotify.explicit !== song.explicit) {
		songUpdates.push({ id: song.id, explicit: spotify.explicit });
	}
}

if (songUpdates.length === 0) {
	console.log('✅  All song explicit flags are already up to date.\n');
} else {
	console.log(
		`🔄  ${songUpdates.length} song(s) need an explicit flag update:`,
		songUpdates
			.map((u) => `  song #${u.id} → explicit=${u.explicit}`)
			.join('\n')
	);
	console.log();
}

// --- 4. Write song updates to the database ----------------------------------

if (songUpdates.length > 0 && !DRY_RUN) {
	console.log('💾  Writing song updates…');

	// Upsert in chunks to avoid giant query strings
	for (const batch of chunk(songUpdates, 100)) {
		const { error } = await (supabase as any)
			.from('songs')
			.upsert(batch, { onConflict: 'id' });

		if (error) {
			console.error('❌  Failed to update songs:', error.message);
			process.exit(1);
		}
	}

	console.log('   Done.\n');
}

if (!DRY_RUN && songUpdates.length > 0) {
	console.log('🎬  Linked media items were recomputed by database triggers.\n');
}

// --- 5. Summary -------------------------------------------------------------

if (DRY_RUN) {
	console.log('🔍  Dry-run complete — no changes were written.');
} else {
	console.log('✅  sync-explicit complete.');
}
