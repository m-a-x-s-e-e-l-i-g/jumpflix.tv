#!/usr/bin/env tsx
// @ts-nocheck
/**
 * JumpFlix Admin CLI
 * Interactive command-line tool for managing movies, series, and episodes in Supabase
 */

import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/types';
import * as prompts from '@inquirer/prompts';
import * as dotenv from 'dotenv';
import { generateBlurhashFromUrl, generateBlurhashFromFile } from './utils/blurhash-generator.js';
import { syncAllSeriesEpisodes, syncPlaylistEpisodes } from './utils/youtube-sync.js';
import {
	bestEffortSearchSpotifyTrack,
	extractSpotifyTrackId,
	fetchSpotifyTrack
} from './utils/spotify.js';
import { fetchYouTubeTrackCandidates, parseTimecodeToSeconds } from './utils/youtube-tracklist.js';
import {
	clearVideoTracklist,
	fetchVideoTracklist,
	upsertSongFromSpotify,
	upsertVideoSong
} from './utils/tracklist-db.js';
import { join } from 'path';
import { fileURLToPath } from 'url';
import * as readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = join(__dirname, '..');

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
	console.error('❌ Missing Supabase credentials!');
	console.error('Please set PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env');
	process.exit(1);
}

const supabase = createClient<Database>(supabaseUrl, supabaseKey);

type MediaItem = Database['public']['Tables']['media_items']['Row'];
type MediaInsert = Database['public']['Tables']['media_items']['Insert'];
type Season = Database['public']['Tables']['series_seasons']['Row'];
type Episode = Database['public']['Tables']['series_episodes']['Insert'];

// Navigation control
class NavigationError extends Error {
	constructor(public type: 'back' | 'exit') {
		super(type);
		this.name = 'NavigationError';
	}
}

// Setup keyboard listener for ESC key
function setupGlobalKeyListener() {
	if (process.stdin.isTTY) {
		readline.emitKeypressEvents(process.stdin);
		process.stdin.setRawMode(true);

		process.stdin.on('keypress', (str, key) => {
			if (key && key.name === 'escape') {
				console.log('\n\n👋 Goodbye!\n');
				process.exit(0);
			}
		});
	}
}

// Utility functions
function slugify(text: string): string {
	return text
		.toLowerCase()
		.trim()
		.replace(/[^\w\s-]/g, '')
		.replace(/[\s_-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function parseArrayInput(input: string): string[] {
	if (!input.trim()) return [];
	return input
		.split(',')
		.map((s) => s.trim())
		.filter((s) => s.length > 0);
}

/**
 * Generate blurhash from a thumbnail path or URL
 * Automatically detects if the input is a URL or local file path
 */
async function generateBlurhash(thumbnail: string): Promise<string> {
	// Check if it's a URL
	if (thumbnail.startsWith('http://') || thumbnail.startsWith('https://')) {
		return await generateBlurhashFromUrl(thumbnail);
	}

	// It's a local path - convert to absolute path if needed
	const imagePath = thumbnail.startsWith('/')
		? join(projectRoot, 'static', thumbnail)
		: join(projectRoot, thumbnail);

	return await generateBlurhashFromFile(imagePath);
}

// Main menu
async function mainMenu() {
	console.clear();
	console.log('🎬 JumpFlix Admin CLI');
	console.log('💡 Press ESC anytime to exit\n');

	const action = await prompts.select({
		message: 'What would you like to do?',
		choices: [
			{ name: '🎥 Add Movie', value: 'add-movie' },
			{ name: '📺 Add Series', value: 'add-series' },
			{ name: '� Manually Manage Episodes', value: 'manage-episodes' },
			{ name: '�🔄 Auto Refresh Episodes', value: 'refresh-episodes' },
			{ name: '📋 List All Content', value: 'list-content' },
			{ name: '✏️  Edit Content', value: 'edit-content' },
			{ name: '🎵 Manage Tracklists', value: 'manage-tracks' },
			{ name: '🏷️  Edit Facets', value: 'edit-facets' },
			{ name: ' Retry Blurhash Generation', value: 'retry-blurhash' },
			{ name: '🗑️  Delete Content', value: 'delete-content' },
			{ name: '❌ Exit', value: 'exit' }
		]
	});
	switch (action) {
		case 'add-movie':
			await addMovie();
			break;
		case 'add-series':
			await addSeries();
			break;
		case 'manage-episodes':
			await manageEpisodes();
			break;
		case 'refresh-episodes':
			await refreshEpisodes();
			break;
		case 'list-content':
			await listContent();
			break;
		case 'edit-content':
			await editContent();
			break;
		case 'manage-tracks':
			await manageTracklists();
			break;
		case 'edit-facets':
			await editFacets();
			break;
		case 'retry-blurhash':
			await retryBlurhashGeneration();
			break;
		case 'delete-content':
			await deleteContent();
			break;
		case 'exit':
			console.log('\n👋 Goodbye!\n');
			process.exit(0);
	}

	await prompts.input({ message: '\nPress Enter to continue...' });
	await mainMenu();
}

async function maybeAutoImportTracklistFromYouTube(movieId: number, ytId: string) {
	try {
		const { count, error } = await supabase
			.from('video_songs')
			.select('id', { count: 'exact', head: true })
			.eq('video_id', movieId);
		if (error) return;
		if ((count ?? 0) > 0) return;

		const shouldImport = await prompts.confirm({
			message: 'No tracklist found for this movie. Import from YouTube timestamps now?',
			default: true
		});
		if (!shouldImport) return;
		await importTracklistFromYouTubeDescription(movieId, ytId);
	} catch {
		// best-effort only
	}
}

async function importTracklistFromYouTubeDescription(
	movieId: number,
	ytId: string
): Promise<{ imported: number; skipped: number; candidates: number }> {
	if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
		console.log(
			'❌ Missing Spotify credentials. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET in .env'
		);
		console.log('   (Needed to map YouTube track candidates to Spotify tracks.)');
		return { imported: 0, skipped: 0, candidates: 0 };
	}

	console.log('📥 Fetching YouTube track candidates (chapters + music, best-effort)...');
	const { candidates, importSource } = await fetchYouTubeTrackCandidates(String(ytId));
	if (!candidates.length) {
		console.log('⚠ No track candidates found.');
		return { imported: 0, skipped: 0, candidates: 0 };
	}

	console.log(`Found ${candidates.length} candidate(s). Mapping to Spotify (best-effort)...`);
	let imported = 0;
	let skipped = 0;
	const sampleMisses: Array<{ title: string; artist?: string }> = [];
	let fatalError: string | null = null;

	for (const cand of candidates) {
		try {
			const result = await bestEffortSearchSpotifyTrack({ title: cand.title, artist: cand.artist });
			if (!result) {
				if (sampleMisses.length < 5) sampleMisses.push({ title: cand.title, artist: cand.artist });
				skipped++;
				continue;
			}
			const { songId } = await upsertSongFromSpotify(supabase, result);
			await upsertVideoSong(supabase, {
				videoId: Number(movieId),
				songId,
				startOffsetSeconds: cand.startOffsetSeconds,
				startTimecode: cand.startTimecode,
				source: 'automation',
				importSource: importSource ?? undefined
			});
			imported++;
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			// If Spotify is misconfigured or unavailable, continuing will just produce 0 imports.
			if (
				msg.includes('Missing SPOTIFY_CLIENT_ID') ||
				msg.includes('Missing SPOTIFY_CLIENT_SECRET') ||
				msg.toLowerCase().includes('spotify token request failed') ||
				msg.toLowerCase().includes('spotify search failed')
			) {
				fatalError = msg;
				break;
			}
			skipped++;
		}
	}

	if (fatalError) {
		console.log(`❌ Spotify lookup failed: ${fatalError}`);
		console.log('   Fix credentials/rate-limits and re-run import.');
		return { imported, skipped, candidates: candidates.length };
	}

	console.log(`✅ Imported: ${imported}, Skipped: ${skipped}`);
	if (imported === 0 && sampleMisses.length) {
		console.log('ℹ Sample unmapped candidates:');
		for (const miss of sampleMisses) {
			console.log(`   - ${miss.artist ? `${miss.artist} — ` : ''}${miss.title}`);
		}
	}
	return { imported, skipped, candidates: candidates.length };
}

async function manageTracklists() {
	console.clear();
	console.log('🎵 Manage Tracklists\n');

	const topAction = await prompts.select({
		message: 'What would you like to do?',
		choices: [
			{ name: '🎬 Manage a single movie tracklist', value: 'single' },
			{ name: '📥 Bulk import missing tracklists', value: 'bulk-import' },
			{ name: '← Back to main menu', value: 'back' }
		]
	});

	if (topAction === 'back') return;
	if (topAction === 'bulk-import') {
		await bulkImportMissingTracklists();
		return;
	}

	const { data: movies, error } = await supabase
		.from('media_items')
		.select('id, title, slug, video_id, type')
		.eq('type', 'movie')
		.order('title');

	if (error || !movies || movies.length === 0) {
		console.log('❌ No movies found');
		return;
	}

	const movieId = await prompts.select({
		message: 'Select a movie:',
		choices: [
			{ name: '← Back to main menu', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...movies.map((m) => ({ name: `🎥 ${m.title} (${m.slug})`, value: m.id }))
		]
	});

	if (movieId === 'back') return;

	const movie = movies.find((m) => m.id === movieId);
	if (!movie) {
		console.log('❌ Movie not found');
		return;
	}

	let tracks: any[] = [];
	try {
		tracks = await fetchVideoTracklist(supabase, Number(movieId));
	} catch (e) {
		console.log(
			`⚠ Could not load tracklist (did you run migrations?): ${e instanceof Error ? e.message : String(e)}`
		);
	}

	console.log(`\nSelected: ${movie.title}`);
	console.log(`YouTube video id: ${movie.video_id || '—'}`);
	console.log(`Tracks: ${tracks.length}\n`);

	const action = await prompts.select({
		message: 'Tracklist action:',
		choices: [
			{ name: '📋 View current tracklist', value: 'view' },
			{ name: '➕ Add track manually (Spotify URL/URI)', value: 'add' },
			{ name: '🔄 Import from YouTube (chapters + music, best-effort)', value: 'import-youtube' },
			{ name: '🧹 Clear tracklist', value: 'clear' },
			{ name: '← Back', value: 'back' }
		]
	});

	if (action === 'back') return;

	if (action === 'view') {
		if (!tracks.length) {
			console.log('\n(Empty)\n');
			return;
		}
		console.log('');
		for (const t of tracks) {
			const tc = t.start_timecode || `${t.start_offset_seconds}s`;
			console.log(`🎵 ${String(tc).padEnd(10)} ${t.song.artist} — ${t.song.title}`);
			console.log(`   ${t.song.spotify_url}`);
		}
		console.log('');
		return;
	}

	if (action === 'clear') {
		const confirmed = await prompts.confirm({
			message: 'Really delete all tracks for this movie?',
			default: false
		});
		if (!confirmed) return;
		await clearVideoTracklist(supabase, Number(movieId));
		console.log('✅ Tracklist cleared');
		return;
	}

	if (action === 'add') {
		const spotifyInput = await prompts.input({
			message: 'Spotify track URL/URI (spotify:track:... or https://open.spotify.com/track/...):',
			required: true
		});
		const trackId = extractSpotifyTrackId(spotifyInput);
		if (!trackId) {
			console.log('❌ Could not parse Spotify track id');
			return;
		}

		console.log('🔎 Fetching Spotify metadata...');
		const spotifyTrack = await fetchSpotifyTrack(trackId);
		const { songId } = await upsertSongFromSpotify(supabase, spotifyTrack);

		const timecode = await prompts.input({
			message: 'Start timecode (mm:ss or hh:mm:ss):',
			required: true
		});
		const seconds = parseTimecodeToSeconds(timecode);
		if (seconds === null) {
			console.log('❌ Invalid timecode');
			return;
		}
		await upsertVideoSong(supabase, {
			videoId: Number(movieId),
			songId,
			startOffsetSeconds: seconds,
			startTimecode: timecode,
			source: 'manual'
		});

		console.log(`✅ Added: ${spotifyTrack.artist} — ${spotifyTrack.title} @ ${timecode}`);
		return;
	}

	if (action === 'import-youtube') {
		const ytId = (movie as any).video_id;
		if (!ytId) {
			console.log('❌ Movie has no YouTube video_id. Set it first in Edit Content.');
			return;
		}
		await importTracklistFromYouTubeDescription(Number(movieId), String(ytId));
		return;
	}
}

async function bulkImportMissingTracklists() {
	console.clear();
	console.log('📥 Bulk import missing tracklists\n');
	console.log('This will scan all movies and import from YouTube for any movie with 0 tracks.');
	console.log("Best-effort: unmapped tracks are skipped; failures won't stop the run.\n");

	const confirmed = await prompts.confirm({
		message: 'Continue?',
		default: false
	});
	if (!confirmed) return;

	const maxToImportRaw = await prompts.input({
		message: 'Max movies to import this run (leave empty for no limit):',
		default: ''
	});
	const maxToImport = maxToImportRaw.trim() ? Number.parseInt(maxToImportRaw.trim(), 10) : null;
	if (maxToImportRaw.trim() && (!Number.isFinite(maxToImport) || (maxToImport as number) <= 0)) {
		console.log('❌ Invalid max value');
		return;
	}

	const { data: movies, error } = await supabase
		.from('media_items')
		.select('id, title, slug, video_id, type')
		.eq('type', 'movie')
		.order('title');

	if (error || !movies || movies.length === 0) {
		console.log(`❌ Failed to load movies: ${error?.message ?? 'no movies found'}`);
		return;
	}

	let scanned = 0;
	let attempted = 0;
	let moviesWithAnyImportedTracks = 0;
	let totalImportedTracks = 0;
	let skippedHasTracks = 0;
	let skippedNoYouTubeId = 0;
	let failed = 0;

	for (const movie of movies) {
		scanned++;
		const ytId = (movie as any).video_id;
		if (!ytId) {
			skippedNoYouTubeId++;
			continue;
		}

		const { count, error: countError } = await supabase
			.from('video_songs')
			.select('id', { count: 'exact', head: true })
			.eq('video_id', movie.id);
		if (countError) {
			console.log(`⚠ ${movie.title}: could not check existing tracks (${countError.message})`);
			failed++;
			continue;
		}

		if ((count ?? 0) > 0) {
			skippedHasTracks++;
			continue;
		}

		if (maxToImport !== null && attempted >= maxToImport) {
			break;
		}
		attempted++;

		console.log(`\n🎬 ${movie.title} (${movie.slug})`);
		try {
			const result = await importTracklistFromYouTubeDescription(Number(movie.id), String(ytId));
			if (result.imported > 0) {
				moviesWithAnyImportedTracks++;
				totalImportedTracks += result.imported;
			}
		} catch (e) {
			failed++;
			console.log(`❌ Import failed: ${e instanceof Error ? e.message : String(e)}`);
		}

		// small delay to be nice to upstream services
		await new Promise((r) => setTimeout(r, 250));
	}

	console.log('\n✅ Bulk import finished');
	console.log(`Scanned: ${scanned}`);
	console.log(`Attempted imports: ${attempted}`);
	console.log(`Imported (tracks): ${totalImportedTracks}`);
	console.log(`Imported (movies with ≥1 track): ${moviesWithAnyImportedTracks}`);
	console.log(`Skipped (already has tracks): ${skippedHasTracks}`);
	console.log(`Skipped (no YouTube id): ${skippedNoYouTubeId}`);
	console.log(`Failed: ${failed}`);
}

// Add Movie
async function addMovie() {
	console.clear();
	console.log('🎥 Add New Movie\n');

	const title = await prompts.input({
		message: 'Movie title:',
		required: true,
		validate: (input) => input.trim().length > 0 || 'Title is required'
	});

	const description = await prompts.input({
		message: 'Description:'
	});

	const year = await prompts.input({
		message: 'Year:'
	});

	const defaultSlug = year ? `${slugify(title)}-${year}` : slugify(title);
	const slug =
		(await prompts.input({
			message: 'Slug (leave empty to auto-generate):',
			default: defaultSlug
		})) || defaultSlug;

	const duration = await prompts.input({
		message: 'Duration (e.g., "2h 15m" or "135min"):'
	});

	const videoId = await prompts.input({
		message: 'Video ID:'
	});

	const vimeoId = await prompts.input({
		message: 'Vimeo ID:'
	});

	const thumbnail = await prompts.input({
		message: 'Thumbnail URL:'
	});

	// Auto-generate blurhash if thumbnail is provided
	let blurhash: string | null = null;
	if (thumbnail) {
		const shouldGenerateBlurhash = await prompts.confirm({
			message: 'Generate blurhash from thumbnail?',
			default: true
		});

		if (shouldGenerateBlurhash) {
			try {
				console.log('🎨 Generating blurhash...');
				blurhash = await generateBlurhash(thumbnail);
				console.log('✓ Blurhash generated');
			} catch (error) {
				console.warn(
					'⚠ Failed to generate blurhash:',
					error instanceof Error ? error.message : String(error)
				);
			}
		}
	}

	const paid = await prompts.confirm({
		message: 'Is this paid content?',
		default: false
	});

	const notSafeForKids = await prompts.confirm({
		message: 'Should this be marked as not safe for kids (swearing / drugs / explicit lyrics)?',
		default: false
	});

	const provider = await prompts.input({
		message: 'Provider:'
	});

	const externalUrl = await prompts.input({
		message: 'External URL:'
	});

	const trakt = await prompts.input({
		message: 'Trakt URL (optional):'
	});

	const creatorsInput = await prompts.input({
		message: 'Creators (comma-separated):'
	});

	const starringInput = await prompts.input({
		message: 'Starring (comma-separated):'
	});

	const movieData: MediaInsert = {
		slug,
		type: 'movie',
		title,
		description: description || null,
		year: year || null,
		duration: duration || null,
		video_id: videoId || null,
		vimeo_id: vimeoId || null,
		thumbnail: thumbnail || null,
		blurhash: blurhash,
		not_safe_for_kids: notSafeForKids,
		paid: paid || false,
		provider: provider || null,
		external_url: externalUrl || null,
		trakt: trakt || null,
		creators: parseArrayInput(creatorsInput),
		starring: parseArrayInput(starringInput)
	};

	const confirm = await prompts.confirm({
		message: '\n📝 Review and confirm?',
		default: true
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	const { data, error } = await supabase.from('media_items').insert(movieData).select().single();

	if (error) {
		console.error('❌ Error adding movie:', error.message);
		if (error.message.includes('duplicate key') || error.message.includes('media_items_pkey')) {
			console.error('\n💡 Database sequence issue detected!');
			console.error('   The ID sequence is out of sync with your data.');
			console.error('   Run this SQL command in Supabase to fix it:\n');
			console.error(
				"   SELECT setval('media_items_id_seq', (SELECT MAX(id) FROM media_items) + 1);"
			);
			console.error('\n   This will set the sequence to continue after the highest existing ID.');
		}
	} else if (data) {
		console.log('✅ Movie added successfully!');
		console.log(`   ID: ${data.id}`);
		console.log(`   Slug: ${data.slug}`);
		if (data.video_id) {
			await maybeAutoImportTracklistFromYouTube(Number(data.id), String(data.video_id));
		}
	}
}

// Add Series
async function addSeries() {
	console.clear();
	console.log('📺 Add New Series\n');

	const title = await prompts.input({
		message: 'Series title:',
		required: true,
		validate: (input) => input.trim().length > 0 || 'Title is required'
	});

	const description = await prompts.input({
		message: 'Description:'
	});

	const year = await prompts.input({
		message: 'Year:'
	});

	const defaultSlug = year ? `${slugify(title)}-${year}` : slugify(title);
	const slug =
		(await prompts.input({
			message: 'Slug (leave empty to auto-generate):',
			default: defaultSlug
		})) || defaultSlug;

	const thumbnail = await prompts.input({
		message: 'Thumbnail URL:'
	});

	// Auto-generate blurhash if thumbnail is provided
	let blurhash: string | null = null;
	if (thumbnail) {
		const shouldGenerateBlurhash = await prompts.confirm({
			message: 'Generate blurhash from thumbnail?',
			default: true
		});

		if (shouldGenerateBlurhash) {
			try {
				console.log('🎨 Generating blurhash...');
				blurhash = await generateBlurhash(thumbnail);
				console.log('✓ Blurhash generated');
			} catch (error) {
				console.warn(
					'⚠ Failed to generate blurhash:',
					error instanceof Error ? error.message : String(error)
				);
			}
		}
	}

	const paid = await prompts.confirm({
		message: 'Is this paid content?',
		default: false
	});

	const notSafeForKids = await prompts.confirm({
		message: 'Should this be marked as not safe for kids (swearing / drugs / explicit lyrics)?',
		default: false
	});

	const provider = await prompts.input({
		message: 'Provider:'
	});

	const creatorsInput = await prompts.input({
		message: 'Creators (comma-separated):'
	});

	const starringInput = await prompts.input({
		message: 'Starring (comma-separated):'
	});

	const numSeasons = await prompts.number({
		message: 'Number of seasons:',
		default: 1,
		min: 1
	});

	const seriesData: MediaInsert = {
		slug,
		type: 'series',
		title,
		description: description || null,
		year: year || null,
		thumbnail: thumbnail || null,
		blurhash: blurhash,
		not_safe_for_kids: notSafeForKids,
		paid: paid || false,
		provider: provider || null,
		creators: parseArrayInput(creatorsInput),
		starring: parseArrayInput(starringInput)
	};

	const confirm = await prompts.confirm({
		message: '\n📝 Review and confirm?',
		default: true
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	const { data: series, error: seriesError } = await supabase
		.from('media_items')
		.insert(seriesData)
		.select()
		.single();

	if (seriesError) {
		console.error('❌ Error adding series:', seriesError.message);
		if (
			seriesError.message.includes('duplicate key') ||
			seriesError.message.includes('media_items_pkey')
		) {
			console.error('\n💡 Database sequence issue detected!');
			console.error('   The ID sequence is out of sync with your data.');
			console.error('   Run this SQL command in Supabase to fix it:\n');
			console.error(
				"   SELECT setval('media_items_id_seq', (SELECT MAX(id) FROM media_items) + 1);"
			);
			console.error('\n   This will set the sequence to continue after the highest existing ID.');
		}
		return;
	}

	console.log('✅ Series added successfully!');
	console.log(`   ID: ${series.id}`);
	console.log(`   Slug: ${series.slug}`);

	// Add seasons
	if (numSeasons && numSeasons > 0) {
		const seasons = [];
		for (let i = 1; i <= numSeasons; i++) {
			console.log(`\n📋 Season ${i}:`);

			const playlistId = await prompts.input({
				message: `YouTube Playlist ID:`
			});

			const customName = await prompts.input({
				message: `Custom season name (optional, e.g., "Competition Year 2023", "Extras"):`
			});

			seasons.push({
				series_id: series.id,
				season_number: i,
				playlist_id: playlistId || null,
				custom_name: customName.trim() || null
			});
		}

		const { error: seasonsError } = await supabase.from('series_seasons').insert(seasons);

		if (seasonsError) {
			console.error('❌ Error adding seasons:', seasonsError.message);
		} else {
			console.log(`✅ Added ${numSeasons} season(s)`);

			// Ask if they want to sync episodes now
			const syncNow = await prompts.confirm({
				message: 'Sync episodes from YouTube playlists now?',
				default: true
			});

			if (syncNow) {
				console.log('\n🔄 Syncing episodes...\n');
				const syncResult = await syncAllSeriesEpisodes(supabase, series.id);
				console.log(`\n✅ Sync complete!`);
				console.log(`   Added: ${syncResult.totalAdded} episodes`);
				console.log(`   Updated: ${syncResult.totalUpdated} episodes`);
				if (syncResult.errors.length > 0) {
					console.log(`   ⚠ Errors: ${syncResult.errors.length}`);
					syncResult.errors.forEach((err) => console.log(`     - ${err}`));
				}
			}
		}
	}
}

// Refresh Episodes from YouTube
async function refreshEpisodes() {
	console.clear();
	console.log('🔄 Refresh Episodes from YouTube\n');

	const action = await prompts.select({
		message: 'What would you like to refresh?',
		choices: [
			{ name: '📺 Refresh all episodes for a specific series', value: 'series' },
			{ name: '📋 Refresh specific season', value: 'season' },
			{ name: '🔄 Refresh ALL series episodes', value: 'all' },
			{ name: '← Back to main menu', value: 'back' }
		]
	});

	if (action === 'back') {
		return;
	} else if (action === 'series') {
		await refreshSeriesEpisodes();
	} else if (action === 'season') {
		await refreshSeasonEpisodes();
	} else if (action === 'all') {
		await refreshAllEpisodes();
	}
}

async function refreshSeriesEpisodes() {
	// Fetch all series with their seasons
	const { data: seriesList, error: fetchError } = await supabase
		.from('media_items')
		.select(
			`
			id,
			title,
			slug,
			series_seasons (
				playlist_id
			)
		`
		)
		.eq('type', 'series')
		.order('title');

	if (fetchError || !seriesList || seriesList.length === 0) {
		console.log('❌ No series found');
		return;
	}

	// Filter and mark series with YouTube playlists
	const seriesChoices = seriesList.map((s: any) => {
		const hasPlaylists = s.series_seasons?.some((season: any) => season.playlist_id);
		return {
			name: `${s.title} (${s.slug})${!hasPlaylists ? ' [No YouTube playlists]' : ''}`,
			value: s.id,
			disabled: !hasPlaylists
		};
	});

	const seriesId = await prompts.select({
		message: 'Select a series:',
		choices: [
			{ name: '← Back', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...seriesChoices
		]
	});

	if (seriesId === 'back') {
		return;
	}

	console.log('\n🔄 Syncing episodes...\n');
	const result = await syncAllSeriesEpisodes(supabase, seriesId);

	console.log(`\n✅ Sync complete!`);
	console.log(`   Added: ${result.totalAdded} episodes`);
	console.log(`   Updated: ${result.totalUpdated} episodes`);
	if (result.errors.length > 0) {
		console.log(`   ⚠ Errors: ${result.errors.length}`);
		result.errors.forEach((err) => console.log(`     - ${err}`));
	}
}

async function refreshSeasonEpisodes() {
	// Fetch all series
	const { data: seriesList, error: fetchError } = await supabase
		.from('media_items')
		.select('id, title, slug')
		.eq('type', 'series')
		.order('title');

	if (fetchError || !seriesList || seriesList.length === 0) {
		console.log('❌ No series found');
		return;
	}

	const seriesId = await prompts.select({
		message: 'Select a series:',
		choices: [
			{ name: '← Back', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...seriesList.map((s) => ({
				name: `${s.title} (${s.slug})`,
				value: s.id
			}))
		]
	});

	if (seriesId === 'back') {
		return;
	}

	// Fetch seasons for this series
	const { data: seasons, error: seasonsError } = await supabase
		.from('series_seasons')
		.select('*')
		.eq('series_id', seriesId)
		.order('season_number');

	if (seasonsError || !seasons || seasons.length === 0) {
		console.log('❌ No seasons found for this series');
		return;
	}

	const seasonId = await prompts.select({
		message: 'Select a season:',
		choices: [
			{ name: '← Back', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...seasons.map((s) => ({
				name: `Season ${s.season_number}${s.playlist_id ? ` (Playlist: ${s.playlist_id})` : ' (No playlist)'}`,
				value: s.id,
				disabled: !s.playlist_id
			}))
		]
	});

	if (seasonId === 'back') {
		return;
	}

	const season = seasons.find((s) => s.id === seasonId);
	if (!season || !season.playlist_id) {
		console.log('❌ Season has no playlist ID');
		return;
	}

	console.log('\n🔄 Syncing episodes...\n');
	const result = await syncPlaylistEpisodes(supabase, season.id, season.playlist_id);

	console.log(`\n✅ Sync complete!`);
	console.log(`   Added: ${result.added} episodes`);
	console.log(`   Updated: ${result.updated} episodes`);
	if (result.errors.length > 0) {
		console.log(`   ⚠ Errors: ${result.errors.length}`);
		result.errors.forEach((err) => console.log(`     - ${err}`));
	}
}

async function refreshAllEpisodes() {
	const confirm = await prompts.confirm({
		message: '⚠️  This will refresh episodes for ALL series with YouTube playlists. Continue?',
		default: false
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	// Fetch all series with their seasons
	const { data: seriesList, error: fetchError } = await supabase
		.from('media_items')
		.select(
			`
			id,
			title,
			series_seasons (
				playlist_id
			)
		`
		)
		.eq('type', 'series')
		.order('title');

	if (fetchError || !seriesList || seriesList.length === 0) {
		console.log('❌ No series found');
		return;
	}

	// Filter to only series that have at least one season with a playlist_id
	const seriesWithPlaylists = seriesList.filter((series: any) =>
		series.series_seasons?.some((season: any) => season.playlist_id)
	);

	if (seriesWithPlaylists.length === 0) {
		console.log('❌ No series with YouTube playlists found');
		return;
	}

	console.log(`\n🔄 Refreshing ${seriesWithPlaylists.length} series with YouTube playlists...\n`);
	console.log(
		`   (Skipping ${seriesList.length - seriesWithPlaylists.length} series without playlists)\n`
	);

	let totalAdded = 0;
	let totalUpdated = 0;
	const allErrors: string[] = [];

	for (const series of seriesWithPlaylists) {
		console.log(`\n📺 ${series.title}`);
		const result = await syncAllSeriesEpisodes(supabase, series.id);
		totalAdded += result.totalAdded;
		totalUpdated += result.totalUpdated;
		allErrors.push(...result.errors);
	}

	console.log(`\n✅ All series synced!`);
	console.log(`   Total added: ${totalAdded} episodes`);
	console.log(`   Total updated: ${totalUpdated} episodes`);
	if (allErrors.length > 0) {
		console.log(`   ⚠ Total errors: ${allErrors.length}`);
	}
}

// Manage Episodes (for non-YouTube series)
async function manageEpisodes() {
	console.clear();
	console.log('📝 Manage Episodes\n');

	// Fetch all series
	const { data: seriesList, error: fetchError } = await supabase
		.from('media_items')
		.select('id, title, slug')
		.eq('type', 'series')
		.order('title');

	if (fetchError || !seriesList || seriesList.length === 0) {
		console.log('❌ No series found');
		return;
	}

	const seriesId = await prompts.select({
		message: 'Select a series:',
		choices: [
			{ name: '← Back', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...seriesList.map((s) => ({
				name: `${s.title} (${s.slug})`,
				value: s.id
			}))
		]
	});

	if (seriesId === 'back') {
		return;
	}

	// Fetch seasons for this series
	const { data: seasons, error: seasonsError } = await supabase
		.from('series_seasons')
		.select('*')
		.eq('series_id', seriesId)
		.order('season_number');

	if (seasonsError || !seasons || seasons.length === 0) {
		console.log('❌ No seasons found for this series');
		return;
	}

	const seasonId = await prompts.select({
		message: 'Select a season:',
		choices: [
			{ name: '← Back', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...seasons.map((s) => ({
				name: `Season ${s.season_number}${s.custom_name ? ` (${s.custom_name})` : ''}`,
				value: s.id
			}))
		]
	});

	if (seasonId === 'back') {
		return;
	}

	const action = await prompts.select({
		message: 'What would you like to do?',
		choices: [
			{ name: '➕ Add Episode', value: 'add' },
			{ name: '✏️  Edit Episode', value: 'edit' },
			{ name: '🔢 Renumber Episodes (close gaps)', value: 'renumber' },
			{ name: '🗑️  Delete Episode', value: 'delete' },
			{ name: '← Back', value: 'back' }
		]
	});

	if (action === 'back') {
		return;
	} else if (action === 'add') {
		const selectedSeason = seasons.find((s) => s.id === seasonId);
		await addEpisodeManually(seriesId, seasonId, selectedSeason?.season_number || 1);
	} else if (action === 'edit') {
		const selectedSeason = seasons.find((s) => s.id === seasonId);
		await editEpisode(seriesId, seasonId, selectedSeason?.season_number || 1);
	} else if (action === 'renumber') {
		await renumberEpisodesInSeason(seasonId);
	} else if (action === 'delete') {
		await deleteEpisode(seasonId);
	}
}

async function addEpisodeManually(seriesId: number, seasonId: number, seasonNumber: number) {
	let addAnother = true;

	while (addAnother) {
		console.log('\n➕ Add Episode Manually\n');

		// Get the series slug for auto-generating thumbnail
		const { data: series } = await supabase
			.from('media_items')
			.select('slug')
			.eq('id', seriesId)
			.single();

		if (!series) {
			console.log('❌ Series not found');
			return;
		}

		// Get existing episodes to determine next episode number and previous duration
		const { data: existingEpisodes } = await supabase
			.from('series_episodes')
			.select('episode_number, duration')
			.eq('season_id', seasonId)
			.order('episode_number', { ascending: false })
			.limit(1);

		const nextEpisodeNumber =
			existingEpisodes && existingEpisodes.length > 0
				? (existingEpisodes[0].episode_number || 0) + 1
				: 1;

		const previousDuration =
			existingEpisodes && existingEpisodes.length > 0 ? existingEpisodes[0].duration : null;

		console.log(`Series: ${series.slug}`);
		console.log(`Season: ${seasonNumber}`);
		console.log(`Next episode number: ${nextEpisodeNumber}\n`);

		const useAutoEpisodeNumber = await prompts.confirm({
			message: `Use episode number ${nextEpisodeNumber}?`,
			default: true
		});

		const episodeNumber = useAutoEpisodeNumber
			? nextEpisodeNumber
			: await prompts.number({
					message: 'Episode number:',
					min: 1,
					default: nextEpisodeNumber,
					required: true
				});

		const title = await prompts.input({
			message: 'Episode title:',
			required: true
		});

		const description = await prompts.input({
			message: 'Description:'
		});

		// Auto-generate thumbnail path
		const autoThumbnail = `/images/thumbnails/${series.slug}/s${String(seasonNumber).padStart(2, '0')}e${String(episodeNumber).padStart(2, '0')}.webp`;

		const useAutoThumbnail = await prompts.confirm({
			message: `Use auto-generated thumbnail path?\n  ${autoThumbnail}`,
			default: true
		});

		const thumbnail = useAutoThumbnail
			? autoThumbnail
			: await prompts.input({
					message: 'Thumbnail URL:',
					default: autoThumbnail
				});

		// Use previous episode's duration as default
		const duration = await prompts.input({
			message: `Duration (e.g., "42m" or "1h 15m")${previousDuration ? ` [previous: ${previousDuration}]` : ''}:`,
			default: previousDuration || undefined
		});

		const episodeData: Episode = {
			season_id: seasonId,
			episode_number: episodeNumber,
			video_id: null,
			title: title || null,
			description: description || null,
			thumbnail: thumbnail || null,
			duration: duration || null
		};

		console.log('\n📝 Episode summary:');
		console.log(`   Episode ${episodeNumber}: ${title}`);
		console.log(`   Thumbnail: ${thumbnail}`);
		console.log(`   Duration: ${duration || '(not set)'}`);

		const confirm = await prompts.confirm({
			message: '\nAdd this episode?',
			default: true
		});

		if (!confirm) {
			console.log('❌ Cancelled');
			addAnother = await prompts.confirm({
				message: 'Add another episode?',
				default: false
			});
			continue;
		}

		const { error } = await supabase.from('series_episodes').insert(episodeData);

		if (error) {
			console.error('❌ Error adding episode:', error.message);
		} else {
			console.log('✅ Episode added successfully!');
			console.log('💡 This episode will use the series external URL when played');
		}

		// Ask if they want to add another episode
		addAnother = await prompts.confirm({
			message: '\nAdd another episode?',
			default: true
		});
	}
}

async function editEpisode(seriesId: number, seasonId: number, seasonNumber: number) {
	// Get the series slug for auto-generating thumbnail
	const { data: series } = await supabase
		.from('media_items')
		.select('slug')
		.eq('id', seriesId)
		.single();

	if (!series) {
		console.log('❌ Series not found');
		return;
	}

	// Fetch episodes for this season
	const { data: episodes, error } = await supabase
		.from('series_episodes')
		.select('*')
		.eq('season_id', seasonId)
		.order('episode_number');

	if (error || !episodes || episodes.length === 0) {
		console.log('❌ No episodes found for this season');
		return;
	}

	const episodeId = await prompts.select({
		message: 'Select episode to edit:',
		choices: [
			{ name: '← Back', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...episodes.map((ep) => ({
				name: `Episode ${ep.episode_number}: ${ep.title || 'Untitled'}`,
				value: ep.id
			}))
		]
	});

	if (episodeId === 'back') {
		return;
	}

	const episode = episodes.find((ep) => ep.id === episodeId);
	if (!episode) {
		console.log('❌ Episode not found');
		return;
	}

	console.log('\nLeave fields empty to keep current value\n');

	const updates: Partial<Episode> = {};

	const title = await prompts.input({
		message: 'Title:',
		default: episode.title || ''
	});
	if (title !== (episode.title || '')) updates.title = title || null;

	const description = await prompts.input({
		message: 'Description:',
		default: episode.description || ''
	});
	if (description !== (episode.description || '')) updates.description = description || null;

	// Auto-generate thumbnail path suggestion
	const autoThumbnail = `/images/thumbnails/${series.slug}/s${String(seasonNumber).padStart(2, '0')}e${String(episode.episode_number).padStart(2, '0')}.webp`;
	const currentThumbnail = episode.thumbnail || '';

	const thumbnailOptions = await prompts.select({
		message: 'Thumbnail:',
		choices: [
			{ name: `Keep current: ${currentThumbnail || '(none)'}`, value: 'keep' },
			{ name: `Use auto-generated: ${autoThumbnail}`, value: 'auto' },
			{ name: 'Enter custom URL', value: 'custom' }
		]
	});

	if (thumbnailOptions === 'auto') {
		updates.thumbnail = autoThumbnail;
	} else if (thumbnailOptions === 'custom') {
		const thumbnail = await prompts.input({
			message: 'Thumbnail URL:',
			default: currentThumbnail
		});
		if (thumbnail !== currentThumbnail) updates.thumbnail = thumbnail || null;
	}

	const duration = await prompts.input({
		message: 'Duration:',
		default: episode.duration || ''
	});
	if (duration !== (episode.duration || '')) updates.duration = duration || null;

	if (Object.keys(updates).length === 0) {
		console.log('No changes made');
		return;
	}

	const confirm = await prompts.confirm({
		message: 'Save changes?',
		default: true
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	const { error: updateError } = await supabase
		.from('series_episodes')
		.update({ ...updates, updated_at: new Date().toISOString() })
		.eq('id', episodeId);

	if (updateError) {
		console.error('❌ Error updating:', updateError.message);
	} else {
		console.log('✅ Updated successfully!');
		if (item.type === 'movie') {
			const nextYt = (updates as any).video_id ?? item.video_id;
			if (nextYt) {
				await maybeAutoImportTracklistFromYouTube(Number(itemId), String(nextYt));
			}
		}
	}
}

async function deleteEpisode(seasonId: number) {
	// Fetch episodes for this season
	const { data: episodes, error } = await supabase
		.from('series_episodes')
		.select('*')
		.eq('season_id', seasonId)
		.order('episode_number');

	if (error || !episodes || episodes.length === 0) {
		console.log('❌ No episodes found for this season');
		return;
	}

	const episodeId = await prompts.select({
		message: 'Select episode to delete:',
		choices: [
			{ name: '← Back', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...episodes.map((ep) => ({
				name: `Episode ${ep.episode_number}: ${ep.title || 'Untitled'}`,
				value: ep.id
			}))
		]
	});

	if (episodeId === 'back') {
		return;
	}

	const episode = episodes.find((ep) => ep.id === episodeId);

	const confirm = await prompts.confirm({
		message: `⚠️  Delete "${episode?.title}"? This cannot be undone!`,
		default: false
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	const { error: deleteError } = await supabase
		.from('series_episodes')
		.delete()
		.eq('id', episodeId);

	if (deleteError) {
		console.error('❌ Error deleting:', deleteError.message);
	} else {
		console.log('✅ Deleted successfully!');
		await renumberEpisodesInSeason(seasonId);
	}
}

function escapeRegExp(text: string): string {
	return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function renumberEpisodesInSeason(seasonId: number) {
	// Fetch season + series slug (best-effort; renumbering works without slug)
	const { data: season } = await supabase
		.from('series_seasons')
		.select('id, season_number, series_id')
		.eq('id', seasonId)
		.single();

	let seriesSlug: string | null = null;
	if (season?.series_id) {
		const { data: series } = await supabase
			.from('media_items')
			.select('slug')
			.eq('id', season.series_id)
			.single();
		seriesSlug = series?.slug ?? null;
	}

	const { data: episodes, error } = await supabase
		.from('series_episodes')
		.select('id, episode_number, thumbnail')
		.eq('season_id', seasonId)
		.order('episode_number');

	if (error || !episodes || episodes.length === 0) {
		return;
	}

	const seasonNumber = season?.season_number ?? null;
	const seasonPad = seasonNumber != null ? String(seasonNumber).padStart(2, '0') : null;

	const planned = episodes.map((ep, index) => {
		const desiredEpisodeNumber = index + 1;
		let desiredThumbnail: string | null | undefined = ep.thumbnail;

		if (
			seriesSlug &&
			seasonPad &&
			ep.thumbnail &&
			typeof ep.episode_number === 'number' &&
			ep.episode_number > 0
		) {
			const oldPad = String(ep.episode_number).padStart(2, '0');
			const newPad = String(desiredEpisodeNumber).padStart(2, '0');
			const thumbRe = new RegExp(
				`^/images/thumbnails/${escapeRegExp(seriesSlug)}/s${seasonPad}e${oldPad}\\.(webp|png|jpe?g)$`,
				'i'
			);
			if (thumbRe.test(ep.thumbnail)) {
				desiredThumbnail = ep.thumbnail.replace(
					new RegExp(`s${seasonPad}e${oldPad}(\\.(webp|png|jpe?g))$`, 'i'),
					`s${seasonPad}e${newPad}$1`
				);
			}
		}

		return {
			id: ep.id,
			currentEpisodeNumber: ep.episode_number,
			desiredEpisodeNumber,
			currentThumbnail: ep.thumbnail,
			desiredThumbnail
		};
	});

	const needsRenumber = planned.some((p) => p.currentEpisodeNumber !== p.desiredEpisodeNumber);
	const needsThumbnailFix = planned.some((p) => p.currentThumbnail !== p.desiredThumbnail);
	if (!needsRenumber && !needsThumbnailFix) {
		return;
	}

	// Avoid potential unique constraint collisions by staging updates into a safe temporary range first.
	if (needsRenumber) {
		for (let index = 0; index < planned.length; index++) {
			const p = planned[index];
			const tempEpisodeNumber = 1000 + index + 1;
			const { error: tempError } = await supabase
				.from('series_episodes')
				.update({ episode_number: tempEpisodeNumber, updated_at: new Date().toISOString() })
				.eq('id', p.id);
			if (tempError) {
				console.warn('⚠️  Failed staging episode renumber:', tempError.message);
				return;
			}
		}
	}

	let changed = 0;
	for (const p of planned) {
		const update: any = { updated_at: new Date().toISOString() };
		if (needsRenumber) update.episode_number = p.desiredEpisodeNumber;
		if (p.currentThumbnail !== p.desiredThumbnail) update.thumbnail = p.desiredThumbnail;

		// If only updated_at would change, skip.
		if (Object.keys(update).length === 1) continue;

		const { error: updateError } = await supabase.from('series_episodes').update(update).eq('id', p.id);
		if (updateError) {
			console.warn('⚠️  Failed updating episode after renumber:', updateError.message);
			return;
		}
		changed++;
	}

	if (changed > 0) {
		console.log(`🔢 Renumbered season episodes (${changed} update${changed === 1 ? '' : 's'})`);
	}
}

// Remove the old addEpisodes function
// Episodes are now automatically synced from YouTube playlists

// List Content
async function listContent() {
	console.clear();
	console.log('📋 All Content\n');

	const { data: items, error } = await supabase
		.from('media_items')
		.select('*')
		.order('created_at', { ascending: false });

	if (error) {
		console.error('❌ Error fetching content:', error.message);
		return;
	}

	if (!items || items.length === 0) {
		console.log('No content found.');
		return;
	}

	console.log(`Found ${items.length} item(s):\n`);

	for (const item of items) {
		const icon = item.type === 'movie' ? '🎥' : '📺';
		console.log(`${icon} ${item.title}`);
		console.log(`   Slug: ${item.slug}`);
		console.log(`   Type: ${item.type}`);
		console.log(`   ID: ${item.id}`);
		if (item.year) console.log(`   Year: ${item.year}`);
		if (item.paid) console.log(`   💰 Paid`);
		if (item.not_safe_for_kids) console.log(`   ⚠ Not safe for kids`);
		console.log('');
	}
}

// Edit Content
async function editContent() {
	console.clear();
	console.log('✏️  Edit Content\n');

	const { data: items, error } = await supabase
		.from('media_items')
		.select('id, title, slug, type')
		.order('title');

	if (error || !items || items.length === 0) {
		console.log('❌ No content found');
		return;
	}

	const itemId = await prompts.select({
		message: 'Select content to edit:',
		choices: [
			{ name: '← Back to main menu', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...items.map((item) => ({
				name: `${item.type === 'movie' ? '🎥' : '📺'} ${item.title} (${item.slug})`,
				value: item.id
			}))
		]
	});

	if (itemId === 'back') {
		return;
	}

	const { data: itemData, error: fetchError } = await supabase
		.from('media_items')
		.select('*')
		.eq('id', itemId)
		.single();

	if (fetchError || !itemData) {
		console.log('❌ Item not found');
		return;
	}

	const item = itemData as MediaItem;

	console.log('\nLeave fields empty to keep current value\n');

	const updates: Partial<MediaInsert> = {};

	const title = await prompts.input({
		message: 'Title:',
		default: item.title
	});
	if (title !== item.title) updates.title = title;

	const description = await prompts.input({
		message: 'Description:',
		default: item.description || ''
	});
	if (description !== (item.description || '')) updates.description = description || null;

	const year = await prompts.input({
		message: 'Year:',
		default: item.year || ''
	});
	if (year !== (item.year || '')) updates.year = year || null;

	const slug = await prompts.input({
		message: 'Slug:',
		default: item.slug
	});
	if (slug !== item.slug) updates.slug = slug;

	const creatorsInput = await prompts.input({
		message: 'Creators (comma-separated):',
		default: item.creators?.join(', ') || ''
	});
	const newCreators = parseArrayInput(creatorsInput);
	const currentCreators = item.creators || [];
	if (JSON.stringify(newCreators) !== JSON.stringify(currentCreators)) {
		updates.creators = newCreators;
	}

	const starringInput = await prompts.input({
		message: 'Starring/Athletes (comma-separated):',
		default: item.starring?.join(', ') || ''
	});
	const newStarring = parseArrayInput(starringInput);
	const currentStarring = item.starring || [];
	if (JSON.stringify(newStarring) !== JSON.stringify(currentStarring)) {
		updates.starring = newStarring;
	}

	const thumbnail = await prompts.input({
		message: 'Thumbnail URL:',
		default: item.thumbnail || ''
	});
	if (thumbnail !== (item.thumbnail || '')) {
		updates.thumbnail = thumbnail || null;

		// Ask if they want to regenerate blurhash for the new thumbnail
		if (thumbnail) {
			const shouldRegenerateBlurhash = await prompts.confirm({
				message: 'Generate blurhash from thumbnail?',
				default: true
			});

			if (shouldRegenerateBlurhash) {
				try {
					console.log('🎨 Generating blurhash...');
					updates.blurhash = await generateBlurhash(thumbnail);
					console.log('✓ Blurhash generated');
				} catch (error) {
					console.warn(
						'⚠ Failed to generate blurhash:',
						error instanceof Error ? error.message : String(error)
					);
				}
			}
		}
	}

	const paid = await prompts.confirm({
		message: 'Is this paid content?',
		default: item.paid || false
	});
	if (paid !== item.paid) updates.paid = paid;

	const notSafeForKids = await prompts.confirm({
		message: 'Mark as not safe for kids (swearing / drugs / explicit lyrics)?',
		default: item.not_safe_for_kids || false
	});
	if (notSafeForKids !== item.not_safe_for_kids) updates.not_safe_for_kids = notSafeForKids;

	const provider = await prompts.input({
		message: 'Provider:',
		default: item.provider || ''
	});
	if (provider !== (item.provider || '')) updates.provider = provider || null;

	const externalUrl = await prompts.input({
		message: 'External URL:',
		default: item.external_url || ''
	});
	if (externalUrl !== (item.external_url || '')) updates.external_url = externalUrl || null;

	const trakt = await prompts.input({
		message: 'Trakt URL (optional):',
		default: item.trakt || ''
	});
	if (trakt !== (item.trakt || '')) updates.trakt = trakt || null;

	// Movie-specific fields
	if (item.type === 'movie') {
		const duration = await prompts.input({
			message: 'Duration (e.g., "2h 15m" or "135min"):',
			default: item.duration || ''
		});
		if (duration !== (item.duration || '')) updates.duration = duration || null;

		const videoId = await prompts.input({
			message: 'Video ID:',
			default: item.video_id || ''
		});
		if (videoId !== (item.video_id || '')) updates.video_id = videoId || null;

		const vimeoId = await prompts.input({
			message: 'Vimeo ID:',
			default: item.vimeo_id || ''
		});
		if (vimeoId !== (item.vimeo_id || '')) updates.vimeo_id = vimeoId || null;
	}

	if (Object.keys(updates).length === 0) {
		console.log('No changes made');
		return;
	}

	const confirm = await prompts.confirm({
		message: 'Save changes?',
		default: true
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	const { error: updateError } = await supabase
		.from('media_items')
		.update({ ...updates, updated_at: new Date().toISOString() })
		.eq('id', itemId);

	if (updateError) {
		console.error('❌ Error updating:', updateError.message);
	} else {
		console.log('✅ Updated successfully!');
	}
}

// Edit Facets
async function editFacets() {
	console.clear();
	console.log('🏷️  Edit Facets\n');

	const { data: items, error } = await supabase
		.from('media_items')
		.select(
			'id, title, slug, type, facet_type, facet_mood, facet_movement, facet_environment, facet_film_style, facet_theme'
		)
		.order('title')
		.returns<
			Array<{
				id: number;
				title: string;
				slug: string;
				type: 'movie' | 'series';
				facet_type: string | null;
				facet_mood: string[] | null;
				facet_movement: string[] | null;
				facet_environment: string | null;
				facet_film_style: string | null;
				facet_theme: string | null;
			}>
		>();

	if (error || !items || items.length === 0) {
		console.log('❌ No content found');
		return;
	}

	const itemId = await prompts.select({
		message: 'Select content to edit facets:',
		choices: [
			{ name: '<- Back to main menu', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...items.map((item) => {
				// Check if any facets are set
				const hasFacets =
					item.facet_type ||
					(item.facet_mood && item.facet_mood.length > 0) ||
					(item.facet_movement && item.facet_movement.length > 0) ||
					item.facet_environment ||
					item.facet_film_style ||
					item.facet_theme;

				const facetIndicator = hasFacets ? '[x]' : '[ ]';
				const typeIcon = item.type === 'movie' ? 'MOV' : 'SER';

				return {
					name: `${facetIndicator} ${typeIcon} ${item.title} (${item.slug})`,
					value: String(item.id)
				};
			})
		]
	});

	if (itemId === 'back') {
		return; // User selected back
	}

	const item = items.find((i) => i.id === Number(itemId));

	if (!item) {
		console.log('❌ Item not found');
		return;
	}

	console.log(`\n📝 Editing facets for: ${item.title}\n`);

	// Type (single-select)
	const facetType = await prompts.select({
		message: 'Type (what the video is):',
		choices: [
			{ name: 'None', value: null },
			{ name: 'Fiction / Parkour Film', value: 'fiction' },
			{ name: 'Documentary', value: 'documentary' },
			{ name: 'Session / Edit / Team Film', value: 'session' },
			{ name: 'Event / Jam / Competition', value: 'event' },
			{ name: 'Tutorial / Educational', value: 'tutorial' },
			{ name: 'Music Video', value: 'music-video' },
			{ name: 'Talk', value: 'talk' }
		],
		default: item.facet_type || null
	});

	// Mood (multi-select)
	const facetMood = await prompts.checkbox({
		message: 'Mood / Vibe (select all that apply):',
		choices: [
			{
				name: 'Energetic ⚡ - High-energy vibe with intense action',
				value: 'energetic',
				checked: item.facet_mood?.includes('energetic')
			},
			{
				name: 'Chill 😌 - Relaxed and laid-back atmosphere',
				value: 'chill',
				checked: item.facet_mood?.includes('chill')
			},
			{
				name: 'Gritty 🔥 - Raw, rough, and unpolished street vibe',
				value: 'gritty',
				checked: item.facet_mood?.includes('gritty')
			},
			{
				name: 'Wholesome 💚 - Positive, uplifting, and feel-good content',
				value: 'wholesome',
				checked: item.facet_mood?.includes('wholesome')
			},
			{
				name: 'Artistic 🎨 - Creative expression and aesthetic focus',
				value: 'artistic',
				checked: item.facet_mood?.includes('artistic')
			}
		]
	});

	// Movement Style (multi-select)
	const facetMovement = await prompts.checkbox({
		message: 'Movement Style (select all that apply):',
		choices: [
			{
				name: 'Flow (continuous lines)',
				value: 'flow',
				checked: item.facet_movement?.includes('flow')
			},
			{
				name: 'Big Sends (roofs, fear jumps)',
				value: 'big-sends',
				checked: item.facet_movement?.includes('big-sends')
			},
			{
				name: 'Style (heavy acrobatic lines)',
				value: 'style',
				checked: item.facet_movement?.includes('style')
			},
			{
				name: 'Descents (drops, downclimbs)',
				value: 'descents',
				checked: item.facet_movement?.includes('descents')
			},
			{
				name: 'Technical (precise, quirky)',
				value: 'technical',
				checked: item.facet_movement?.includes('technical')
			},
			{ name: 'Speed / Chase', value: 'speed', checked: item.facet_movement?.includes('speed') },
			{
				name: 'Oldskool (parkour basics)',
				value: 'oldskool',
				checked: item.facet_movement?.includes('oldskool')
			},
			{
				name: 'Contemporary (dance)',
				value: 'contemporary',
				checked: item.facet_movement?.includes('contemporary')
			}
		]
	});

	// Environment (single-select)
	const facetEnvironment = await prompts.select({
		message: 'Environment (primary setting):',
		choices: [
			{ name: 'None', value: null },
			{ name: 'Street / Urban', value: 'street' },
			{ name: 'Rooftops', value: 'rooftops' },
			{ name: 'Nature', value: 'nature' },
			{ name: 'Urbex (abandoned)', value: 'urbex' },
			{ name: 'Gym (indoor)', value: 'gym' }
		],
		default: item.facet_environment || null
	});

	// Film Style (single-select)
	const facetFilmStyle = await prompts.select({
		message: 'Film Style / Editing:',
		choices: [
			{ name: 'None', value: null },
			{ name: 'Cinematic (smooth camera, color grade)', value: 'cinematic' },
			{ name: 'Street-Cinematic (DSLR + fisheye inserts)', value: 'street-cinematic' },
			{ name: 'Skate-ish (VX/handcam, fisheye, rough)', value: 'skateish' },
			{ name: 'Raw Session (no polish, real sound)', value: 'raw' },
			{ name: 'POV / Chasecam (first-person)', value: 'pov' },
			{ name: 'Long Takes (minimal cuts, flow)', value: 'longtakes' },
			{ name: 'Music-Driven (beat-matched editing)', value: 'music-driven' },
			{ name: 'Montage (quick cuts, highlights)', value: 'montage' },
			{ name: 'Slowmo (slow motion heavy)', value: 'slowmo' },
			{ name: 'Gonzo (handheld chaos, "in the middle of it")', value: 'gonzo' },
			{ name: 'Vintage (MiniDV, Hi8, nostalgic)', value: 'vintage' },
			{ name: 'Minimalist (calm framing, quiet)', value: 'minimalist' },
			{ name: 'Experimental (non-linear, surreal)', value: 'experimental' }
		],
		default: item.facet_film_style || null
	});

	// Theme (single-select)
	const facetTheme = await prompts.select({
		message: 'Theme / Purpose:',
		choices: [
			{ name: 'None', value: null },
			{ name: 'Journey (personal growth)', value: 'journey' },
			{ name: 'Team Film (group identity)', value: 'team' },
			{ name: 'Event Highlight', value: 'event' },
			{ name: 'Competition', value: 'competition' },
			{ name: 'Educational', value: 'educational' },
			{ name: 'Travel (exploring spots)', value: 'travel' },
			{ name: 'Creative / Expression', value: 'creative' },
			{ name: 'Showcase / Entertainment', value: 'entertainment' }
		],
		default: item.facet_theme || null
	});

	// Preview
	console.log('\n📋 Facet Summary:');
	console.log(`   Type: ${facetType || '(none)'}`);
	console.log(`   Mood: ${facetMood.length > 0 ? facetMood.join(', ') : '(none)'}`);
	console.log(`   Movement: ${facetMovement.length > 0 ? facetMovement.join(', ') : '(none)'}`);
	console.log(`   Environment: ${facetEnvironment || '(none)'}`);
	console.log(`   Film Style: ${facetFilmStyle || '(none)'}`);
	console.log(`   Theme: ${facetTheme || '(none)'}`);

	const confirm = await prompts.confirm({
		message: '\nSave facets?',
		default: true
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	const { error: updateError } = await supabase
		.from('media_items')
		.update({
			facet_type: facetType,
			facet_mood: facetMood.length > 0 ? facetMood : [],
			facet_movement: facetMovement.length > 0 ? facetMovement : [],
			facet_environment: facetEnvironment,
			facet_film_style: facetFilmStyle,
			facet_theme: facetTheme,
			updated_at: new Date().toISOString()
		})
		.eq('id', Number(itemId));

	if (updateError) {
		console.error('❌ Error updating facets:', updateError.message);
	} else {
		console.log('✅ Facets updated successfully!');
	}
}

// Retry Blurhash Generation
async function retryBlurhashGeneration() {
	console.clear();
	console.log('🎨 Retry Blurhash Generation\n');

	// Fetch all items with thumbnails but no blurhash
	const { data: items, error } = await supabase
		.from('media_items')
		.select('id, title, slug, type, thumbnail, blurhash')
		.not('thumbnail', 'is', null)
		.is('blurhash', null)
		.order('title');

	if (error) {
		console.error('❌ Error fetching items:', error.message);
		return;
	}

	if (!items || items.length === 0) {
		console.log('✅ All items with thumbnails already have blurhash!');
		return;
	}

	console.log(`Found ${items.length} item(s) without blurhash:\n`);

	for (const item of items) {
		const icon = item.type === 'movie' ? '🎥' : '📺';
		console.log(`${icon} ${item.title} (${item.slug})`);
	}

	console.log('');

	const action = await prompts.select({
		message: 'What would you like to do?',
		choices: [
			{ name: '🔄 Generate for all items', value: 'all' },
			{ name: '🎯 Select specific items', value: 'select' },
			{ name: '← Back to main menu', value: 'back' }
		]
	});

	if (action === 'back') {
		return;
	}

	let itemsToProcess: typeof items = [];

	if (action === 'all') {
		const confirm = await prompts.confirm({
			message: `Generate blurhash for all ${items.length} items?`,
			default: true
		});

		if (!confirm) {
			console.log('❌ Cancelled');
			return;
		}

		itemsToProcess = items;
	} else if (action === 'select') {
		const selectedIds = await prompts.checkbox({
			message: 'Select items to generate blurhash for:',
			choices: items.map((item) => ({
				name: `${item.type === 'movie' ? '🎥' : '📺'} ${item.title} (${item.slug})`,
				value: item.id,
				checked: false
			}))
		});

		if (selectedIds.length === 0) {
			console.log('❌ No items selected');
			return;
		}

		itemsToProcess = items.filter((item) => selectedIds.includes(item.id));
	}

	console.log(`\n🎨 Generating blurhash for ${itemsToProcess.length} item(s)...\n`);

	let successCount = 0;
	let failCount = 0;

	for (const item of itemsToProcess) {
		try {
			console.log(`Processing: ${item.title}`);

			if (!item.thumbnail) {
				console.log('  ⚠️  Skipped (no thumbnail URL)');
				failCount++;
				continue;
			}

			const blurhash = await generateBlurhash(item.thumbnail);

			const { error: updateError } = await supabase
				.from('media_items')
				.update({
					blurhash,
					updated_at: new Date().toISOString()
				})
				.eq('id', item.id);

			if (updateError) {
				console.log(`  ❌ Failed to update: ${updateError.message}`);
				failCount++;
			} else {
				console.log(`  ✅ Success`);
				successCount++;
			}
		} catch (error) {
			console.log(`  ❌ Error: ${error instanceof Error ? error.message : String(error)}`);
			failCount++;
		}
	}

	console.log(`\n📊 Summary:`);
	console.log(`   ✅ Success: ${successCount}`);
	console.log(`   ❌ Failed: ${failCount}`);
	console.log(`   📝 Total: ${itemsToProcess.length}`);
}

// Delete Content
async function deleteContent() {
	console.clear();
	console.log('🗑️  Delete Content\n');

	const { data: items, error } = await supabase
		.from('media_items')
		.select('id, title, slug, type')
		.order('title')
		.returns<
			Array<{
				id: number;
				title: string;
				slug: string;
				type: 'movie' | 'series';
			}>
		>();

	if (error || !items || items.length === 0) {
		console.log('❌ No content found');
		return;
	}

	const itemId = await prompts.select({
		message: 'Select content to delete:',
		choices: [
			{ name: '← Back to main menu', value: 'back' },
			{ name: '---', value: 'separator', disabled: true },
			...items.map((item) => ({
				name: `${item.type === 'movie' ? '🎥' : '📺'} ${item.title} (${item.slug})`,
				value: item.id
			}))
		]
	});

	if (itemId === 'back') {
		return;
	}

	const item = items.find((i) => i.id === itemId);

	const confirm = await prompts.confirm({
		message: `⚠️  Delete "${item?.title}"? This cannot be undone!`,
		default: false
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	const { error: deleteError } = await supabase.from('media_items').delete().eq('id', itemId);

	if (deleteError) {
		console.error('❌ Error deleting:', deleteError.message);
	} else {
		console.log('✅ Deleted successfully!');
	}
}

// Start the CLI
setupGlobalKeyListener();
mainMenu().catch((error) => {
	console.error('❌ Unexpected error:', error);
	process.exit(1);
});
