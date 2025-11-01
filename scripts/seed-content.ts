#!/usr/bin/env tsx
import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import { movies } from '../src/lib/assets/movies';
import { series } from '../src/lib/assets/series';
import { posterBlurhash } from '../src/lib/assets/blurhash';
import { slugify } from '../src/lib/tv/slug';
import { fetchYouTubePlaylistEpisodes } from '../src/lib/tv/episodes';

type MediaItemRow = {
  id: number;
  slug: string;
  type: 'movie' | 'series';
  title: string;
  description?: string;
  thumbnail?: string;
  blurhash?: string;
  paid?: boolean;
  provider?: string;
  external_url?: string;
  year?: string;
  duration?: string;
  video_id?: string;
  vimeo_id?: string;
  trakt?: string;
  creators?: string[];
  starring?: string[];
  video_count?: number;
};

type SeasonRow = {
  series_id: number;
  season_number: number;
  playlist_id?: string;
};

type EpisodeRow = {
  season_id: number;
  episode_number: number;
  video_id: string;
  title?: string;
  description?: string;
  published_at?: string;
  thumbnail?: string;
  duration?: string;
};

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false }
});

const SERIES_ID_OFFSET = 1000;

const usedSlugs = new Set<string>();
function cleanString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '.') return undefined;
  return trimmed;
}

function coerceNumericId(source: unknown, fallbackSeed: number): number {
  if (typeof source === 'number' && Number.isFinite(source)) {
    return source;
  }
  const parsed = Number.parseInt(String(source ?? ''), 10);
  if (Number.isFinite(parsed)) {
    return parsed;
  }
  // Fall back to a deterministic positive id using the fallback seed.
  return fallbackSeed;
}

// Guarantee unique, readable slugs even when source data leaves duplicates or blank fields.
function buildUniqueSlug(base: string, id: number | string) {
  let slug = base || slugify(`item-${id}`);
  if (!slug) slug = `item-${id}`;
  if (!usedSlugs.has(slug)) {
    usedSlugs.add(slug);
    return slug;
  }
  let candidate = `${slug}-${id}`;
  let counter = 1;
  while (usedSlugs.has(candidate)) {
    candidate = `${slug}-${id}-${counter++}`;
  }
  usedSlugs.add(candidate);
  return candidate;
}

function mapMovies(): MediaItemRow[] {
  return movies.map((movie: any, index: number) => {
    const id = coerceNumericId(movie.id, index + 1);
    const base = movie.year ? `${movie.title} ${movie.year}` : movie.title;
    const slug = buildUniqueSlug(slugify(base), movie.id);
    const thumbnail = cleanString(movie.thumbnail);
    return {
      id,
      slug,
      type: 'movie',
      title: movie.title,
      description: cleanString(movie.description),
      thumbnail,
      blurhash: thumbnail ? posterBlurhash[thumbnail] ?? undefined : undefined,
      paid: Boolean(movie.paid),
      provider: cleanString(movie.provider),
      external_url: cleanString(movie.externalUrl),
      year: cleanString(movie.year),
      duration: cleanString(movie.duration),
      video_id: cleanString(movie.videoId),
      vimeo_id: cleanString(movie.vimeoId),
      trakt: cleanString(movie.trakt),
      creators: movie.creators ?? [],
      starring: movie.starring ?? [],
      video_count: undefined
    };
  });
}

function mapSeries(): { items: MediaItemRow[]; seasons: SeasonRow[] } {
  const items: MediaItemRow[] = [];
  const seasons: SeasonRow[] = [];
  for (const [index, entry] of (series as any[]).entries()) {
    const numericId = coerceNumericId(entry.id, index + 1);
    const id = numericId + SERIES_ID_OFFSET;
    const slug = buildUniqueSlug(slugify(entry.title), id);
    const thumbnail = cleanString(entry.thumbnail);
    items.push({
      id,
      slug,
      type: 'series',
      title: entry.title,
      description: cleanString(entry.description),
      thumbnail,
      blurhash: thumbnail ? posterBlurhash[thumbnail] ?? undefined : undefined,
      paid: Boolean(entry.paid),
      provider: cleanString(entry.provider),
      external_url: cleanString(entry.externalUrl),
      creators: entry.creators ?? [],
      starring: entry.starring ?? [],
      video_count: entry.videoCount ?? undefined
    });
    if (Array.isArray(entry.seasons)) {
      for (const season of entry.seasons) {
        seasons.push({
          series_id: id,
          season_number: season.seasonNumber,
          playlist_id: cleanString(season.playlistId)
        });
      }
    }
  }
  return { items, seasons };
}

async function main() {
  const movieRows = mapMovies();
  const { items: seriesRows, seasons: seasonRows } = mapSeries();
  const mediaRows = [...movieRows, ...seriesRows];

  console.log(`Upserting ${mediaRows.length} media items...`);
  const { error: mediaError } = await supabase.from('media_items').upsert(mediaRows, {
    onConflict: 'id'
  });
  if (mediaError) {
    console.error('Failed to upsert media items:', mediaError.message);
    process.exit(1);
  }

  if (seasonRows.length) {
    console.log(`Upserting ${seasonRows.length} seasons...`);
    const { error: seasonError } = await supabase.from('series_seasons').upsert(seasonRows, {
      onConflict: 'series_id,season_number'
    });
    if (seasonError) {
      console.error('Failed to upsert seasons:', seasonError.message);
      process.exit(1);
    }

    await syncEpisodes(seriesRows.map((series) => series.id));
  }

  console.log('Seeding completed successfully.');
}

async function syncEpisodes(seriesIds: number[]) {
  const targetSeriesIds = [...new Set(seriesIds)];
  if (!targetSeriesIds.length) {
    return;
  }

  console.log('Loading seasons to sync episodes...');
  const { data: seasonsData, error } = await supabase
    .from('series_seasons')
    .select('id, series_id, season_number, playlist_id')
    .in('series_id', targetSeriesIds)
    .order('series_id')
    .order('season_number');

  if (error) {
    console.error('Failed to fetch seasons for episode sync:', error.message);
    process.exit(1);
  }

  const episodeRows: EpisodeRow[] = [];

  for (const season of seasonsData ?? []) {
    if (!season.playlist_id) continue;
    console.log(`Fetching playlist ${season.playlist_id} for series ${season.series_id} season ${season.season_number}...`);
    try {
      const episodes = await fetchYouTubePlaylistEpisodes(season.playlist_id);
      if (!episodes.length) continue;

      episodes.forEach((episode, index) => {
        const published = cleanString(episode.publishedAt ?? '')
          ? new Date(episode.publishedAt as string).toISOString()
          : undefined;
        episodeRows.push({
          season_id: season.id,
          episode_number: episode.position ?? index + 1,
          video_id: episode.id,
          title: cleanString(episode.title),
          description: cleanString(episode.description),
          published_at: published,
          thumbnail: cleanString(episode.thumbnail),
          duration: cleanString(episode.duration)
        });
      });
    } catch (err) {
      console.warn(`Failed to fetch playlist ${season.playlist_id}:`, err instanceof Error ? err.message : err);
    }
  }

  if (!episodeRows.length) {
    console.log('No episodes fetched. Skipping episode upsert.');
    return;
  }

  console.log(`Upserting ${episodeRows.length} episodes...`);
  const { error: episodeError } = await supabase.from('series_episodes').upsert(episodeRows, {
    onConflict: 'season_id,episode_number'
  });

  if (episodeError) {
    console.error('Failed to upsert episodes:', episodeError.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
