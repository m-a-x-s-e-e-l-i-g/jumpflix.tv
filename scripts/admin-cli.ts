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
import { join } from 'path';
import { fileURLToPath } from 'url';

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
	console.log('🎬 JumpFlix Admin CLI\n');

	const action = await prompts.select({
		message: 'What would you like to do?',
		choices: [
			{ name: '🎥 Add Movie', value: 'add-movie' },
			{ name: '📺 Add Series', value: 'add-series' },
			{ name: '🔄 Refresh Episodes', value: 'refresh-episodes' },
			{ name: '📋 List All Content', value: 'list-content' },
			{ name: '✏️  Edit Content', value: 'edit-content' },
			{ name: '🏷️  Edit Facets', value: 'edit-facets' },
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
		case 'refresh-episodes':
			await refreshEpisodes();
			break;
		case 'list-content':
			await listContent();
			break;
		case 'edit-content':
			await editContent();
			break;
		case 'edit-facets':
			await editFacets();
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
				console.warn('⚠ Failed to generate blurhash:', error instanceof Error ? error.message : String(error));
			}
		}
	}

	const paid = await prompts.confirm({
		message: 'Is this paid content?',
		default: false
	});

	const provider = await prompts.input({
		message: 'Provider:'
	});

	const externalUrl = await prompts.input({
		message: 'External URL:'
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
		paid: paid || false,
		provider: provider || null,
		external_url: externalUrl || null,
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
			console.error('   SELECT setval(\'media_items_id_seq\', (SELECT MAX(id) FROM media_items) + 1);');
			console.error('\n   This will set the sequence to continue after the highest existing ID.');
		}
	} else if (data) {
		console.log('✅ Movie added successfully!');
		console.log(`   ID: ${data.id}`);
		console.log(`   Slug: ${data.slug}`);
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
				console.warn('⚠ Failed to generate blurhash:', error instanceof Error ? error.message : String(error));
			}
		}
	}

	const paid = await prompts.confirm({
		message: 'Is this paid content?',
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
		if (seriesError.message.includes('duplicate key') || seriesError.message.includes('media_items_pkey')) {
			console.error('\n💡 Database sequence issue detected!');
			console.error('   The ID sequence is out of sync with your data.');
			console.error('   Run this SQL command in Supabase to fix it:\n');
			console.error('   SELECT setval(\'media_items_id_seq\', (SELECT MAX(id) FROM media_items) + 1);');
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
			const playlistId = await prompts.input({
				message: `YouTube Playlist ID for Season ${i}:`
			});

			seasons.push({
				series_id: series.id,
				season_number: i,
				playlist_id: playlistId || null
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
			{ name: '🔄 Refresh ALL series episodes', value: 'all' }
		]
	});

	if (action === 'series') {
		await refreshSeriesEpisodes();
	} else if (action === 'season') {
		await refreshSeasonEpisodes();
	} else if (action === 'all') {
		await refreshAllEpisodes();
	}
}

async function refreshSeriesEpisodes() {
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
		choices: seriesList.map((s) => ({
			name: `${s.title} (${s.slug})`,
			value: s.id
		}))
	});

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
		choices: seriesList.map((s) => ({
			name: `${s.title} (${s.slug})`,
			value: s.id
		}))
	});

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
		choices: seasons.map((s) => ({
			name: `Season ${s.season_number}${s.playlist_id ? ` (Playlist: ${s.playlist_id})` : ' (No playlist)'}`,
			value: s.id,
			disabled: !s.playlist_id
		}))
	});

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
		message: '⚠️  This will refresh episodes for ALL series. Continue?',
		default: false
	});

	if (!confirm) {
		console.log('❌ Cancelled');
		return;
	}

	// Fetch all series
	const { data: seriesList, error: fetchError } = await supabase
		.from('media_items')
		.select('id, title')
		.eq('type', 'series')
		.order('title');

	if (fetchError || !seriesList || seriesList.length === 0) {
		console.log('❌ No series found');
		return;
	}

	console.log(`\n🔄 Refreshing ${seriesList.length} series...\n`);

	let totalAdded = 0;
	let totalUpdated = 0;
	const allErrors: string[] = [];

	for (const series of seriesList) {
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
		choices: items.map((item) => ({
			name: `${item.type === 'movie' ? '🎥' : '📺'} ${item.title} (${item.slug})`,
			value: item.id
		}))
	});

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
					console.warn('⚠ Failed to generate blurhash:', error instanceof Error ? error.message : String(error));
				}
			}
		}
	}

	const paid = await prompts.confirm({
		message: 'Is this paid content?',
		default: item.paid || false
	});
	if (paid !== item.paid) updates.paid = paid;

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
		.select('id, title, slug, type, facet_type, facet_mood, facet_movement, facet_environment, facet_film_style, facet_theme')
		.order('title')
		.returns<Array<{
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
		}>>();

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
				const hasFacets = item.facet_type || 
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
			{ name: 'Tutorial / Educational', value: 'tutorial' }
		],
		default: item.facet_type || null
	});

	// Mood (multi-select)
	const facetMood = await prompts.checkbox({
		message: 'Mood / Vibe (select all that apply):',
		choices: [
			{ name: 'Energetic', value: 'energetic', checked: item.facet_mood?.includes('energetic') },
			{ name: 'Chill', value: 'chill', checked: item.facet_mood?.includes('chill') },
			{ name: 'Gritty', value: 'gritty', checked: item.facet_mood?.includes('gritty') },
			{ name: 'Wholesome', value: 'wholesome', checked: item.facet_mood?.includes('wholesome') },
			{ name: 'Intense', value: 'intense', checked: item.facet_mood?.includes('intense') },
			{ name: 'Artistic', value: 'artistic', checked: item.facet_mood?.includes('artistic') }
		]
	});

	// Movement Style (multi-select)
	const facetMovement = await prompts.checkbox({
		message: 'Movement Style (select all that apply):',
		choices: [
			{ name: 'Flow (continuous lines)', value: 'flow', checked: item.facet_movement?.includes('flow') },
			{ name: 'Big Sends (roofs, fear jumps)', value: 'big-sends', checked: item.facet_movement?.includes('big-sends') },
			{ name: 'Tricking (flips)', value: 'tricking', checked: item.facet_movement?.includes('tricking') },
			{ name: 'Technical (precise, quirky)', value: 'technical', checked: item.facet_movement?.includes('technical') },
			{ name: 'Speed / Chase', value: 'speed', checked: item.facet_movement?.includes('speed') },
			{ name: 'Oldskool (parkour basics)', value: 'oldskool', checked: item.facet_movement?.includes('oldskool') },
			{ name: 'Dance (noodle movement)', value: 'dance', checked: item.facet_movement?.includes('dance') }
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
			{ name: 'Cinematic (color, composition)', value: 'cinematic' },
			{ name: 'Skate-ish (fisheye, rough, VX)', value: 'skateish' },
			{ name: 'Raw Session (minimal music)', value: 'raw' },
			{ name: 'POV / Chasecam', value: 'pov' },
			{ name: 'Long Takes', value: 'longtakes' }
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

// Delete Content
async function deleteContent() {
	console.clear();
	console.log('🗑️  Delete Content\n');

	const { data: items, error } = await supabase
		.from('media_items')
		.select('id, title, slug, type')
		.order('title')
		.returns<Array<{
			id: number;
			title: string;
			slug: string;
			type: 'movie' | 'series';
		}>>();

	if (error || !items || items.length === 0) {
		console.log('❌ No content found');
		return;
	}

	const itemId = await prompts.select({
		message: 'Select content to delete:',
		choices: items.map((item) => ({
			name: `${item.type === 'movie' ? '🎥' : '📺'} ${item.title} (${item.slug})`,
			value: item.id
		}))
	});

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
mainMenu().catch((error) => {
	console.error('❌ Unexpected error:', error);
	process.exit(1);
});
