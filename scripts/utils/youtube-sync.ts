/**
 * YouTube playlist episode sync utility
 * Fetches episodes from YouTube playlists and syncs them to Supabase
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../src/lib/supabase/types';

type SeriesEpisodeInsert = Database['public']['Tables']['series_episodes']['Insert'];
type SeriesEpisodeRow = Database['public']['Tables']['series_episodes']['Row'];

interface YouTubePlaylistItem {
	id: string; // video ID
	title: string;
	description?: string;
	publishedAt?: string;
	thumbnail?: string;
	position: number;
}

/**
 * Parse YouTube Atom feed to extract playlist items
 */
function between(input: string, startTag: string, endTag: string): string | undefined {
	const start = input.indexOf(startTag);
	if (start === -1) return undefined;
	const end = input.indexOf(endTag, start + startTag.length);
	if (end === -1) return undefined;
	return input.substring(start + startTag.length, end);
}

/**
 * Fetch episodes from YouTube playlist using public Atom feed (no API key required)
 */
export async function fetchYouTubePlaylistItems(
	playlistId: string
): Promise<YouTubePlaylistItem[]> {
	const url = `https://www.youtube.com/feeds/videos.xml?playlist_id=${encodeURIComponent(playlistId)}`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to fetch YouTube playlist: ${res.statusText}`);
	}

	const xml = await res.text();
	const chunks = xml.split('<entry>').slice(1);

	const items: YouTubePlaylistItem[] = chunks
		.map((chunk, idx) => {
			const entry = chunk.split('</entry>')[0] || chunk;
			const title =
				between(entry, '<title>', '</title>')?.replace(/\s+/g, ' ').trim() || `Episode ${idx + 1}`;
			const publishedAt = between(entry, '<published>', '</published>');
			const vidMatch = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/);
			const videoId = vidMatch?.[1] || '';
			const thumbMatches = Array.from(
				entry.matchAll(/<media:thumbnail[^>]*url="([^"]+)"[^>]*\/>/g)
			);
			const thumbnail = thumbMatches.length ? thumbMatches[thumbMatches.length - 1][1] : undefined;

			return {
				id: videoId,
				title,
				publishedAt,
				thumbnail,
				position: idx + 1
			};
		})
		.filter((item) => item.id);

	return items;
}

/**
 * Sync YouTube playlist episodes to database
 * This will add new episodes and update existing ones
 */
export async function syncPlaylistEpisodes(
	supabase: SupabaseClient<Database>,
	seasonId: number,
	playlistId: string
): Promise<{ added: number; updated: number; errors: string[] }> {
	const errors: string[] = [];
	let added = 0;
	let updated = 0;

	try {
		// Fetch episodes from YouTube
		console.log(`   Fetching episodes from YouTube playlist: ${playlistId}`);
		const youtubeItems = await fetchYouTubePlaylistItems(playlistId);

		if (youtubeItems.length === 0) {
			return { added: 0, updated: 0, errors: ['No episodes found in playlist'] };
		}

		// Fetch existing episodes for this season
		const { data: existingEpisodes } = await supabase
			.from('series_episodes')
			.select('*')
			.eq('season_id', seasonId);

		const existingByVideoId = new Map<string, SeriesEpisodeRow>();
		const existingByEpisodeNum = new Map<number, SeriesEpisodeRow>();

		if (existingEpisodes) {
			for (const ep of existingEpisodes) {
				if (ep.video_id) existingByVideoId.set(ep.video_id, ep);
				if (ep.episode_number) existingByEpisodeNum.set(ep.episode_number, ep);
			}
		}

		// Process each YouTube item
		for (const item of youtubeItems) {
			try {
				const episodeNumber = item.position;
				const existing = existingByVideoId.get(item.id) || existingByEpisodeNum.get(episodeNumber);

				if (existing) {
					// Update existing episode
					const { error } = await supabase
						.from('series_episodes')
						.update({
							video_id: item.id,
							title: item.title,
							thumbnail: item.thumbnail || null,
							published_at: item.publishedAt || null,
							episode_number: episodeNumber,
							updated_at: new Date().toISOString()
						})
						.eq('id', existing.id);

					if (error) {
						errors.push(`Failed to update episode ${episodeNumber}: ${error.message}`);
					} else {
						updated++;
					}
				} else {
					// Insert new episode
					const newEpisode: SeriesEpisodeInsert = {
						season_id: seasonId,
						episode_number: episodeNumber,
						video_id: item.id,
						title: item.title,
						thumbnail: item.thumbnail || null,
						published_at: item.publishedAt || null
					};

					const { error } = await supabase.from('series_episodes').insert(newEpisode);

					if (error) {
						errors.push(`Failed to add episode ${episodeNumber}: ${error.message}`);
					} else {
						added++;
					}
				}
			} catch (error) {
				errors.push(
					`Error processing episode ${item.position}: ${error instanceof Error ? error.message : String(error)}`
				);
			}
		}

		return { added, updated, errors };
	} catch (error) {
		return {
			added: 0,
			updated: 0,
			errors: [`Failed to sync playlist: ${error instanceof Error ? error.message : String(error)}`]
		};
	}
}

/**
 * Sync all seasons with playlist IDs for a given series
 */
export async function syncAllSeriesEpisodes(
	supabase: SupabaseClient<Database>,
	seriesId: number
): Promise<{ totalAdded: number; totalUpdated: number; errors: string[] }> {
	let totalAdded = 0;
	let totalUpdated = 0;
	const allErrors: string[] = [];

	// Fetch all seasons for this series
	const { data: seasons, error: seasonsError } = await supabase
		.from('series_seasons')
		.select('*')
		.eq('series_id', seriesId)
		.order('season_number');

	if (seasonsError) {
		return {
			totalAdded: 0,
			totalUpdated: 0,
			errors: [`Failed to fetch seasons: ${seasonsError.message}`]
		};
	}

	if (!seasons || seasons.length === 0) {
		return { totalAdded: 0, totalUpdated: 0, errors: ['No seasons found for this series'] };
	}

	// Sync each season that has a playlist ID
	for (const season of seasons) {
		if (!season.playlist_id) {
			console.log(`   Season ${season.season_number}: No playlist ID, skipping`);
			continue;
		}

		console.log(`   Season ${season.season_number}: Syncing...`);
		const result = await syncPlaylistEpisodes(supabase, season.id, season.playlist_id);

		totalAdded += result.added;
		totalUpdated += result.updated;
		allErrors.push(...result.errors);

		if (result.added || result.updated) {
			console.log(`   ✓ Added: ${result.added}, Updated: ${result.updated}`);
		}
		if (result.errors.length > 0) {
			console.log(`   ⚠ Errors: ${result.errors.length}`);
		}
	}

	return { totalAdded, totalUpdated, errors: allErrors };
}
