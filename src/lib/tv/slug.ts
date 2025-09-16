import { movies } from '$lib/assets/movies';
import { playlists } from '$lib/assets/playlists';
import type { ContentItem, Movie, Playlist } from './types';

export function slugify(input: string): string {
  return input
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .replace(/-{2,}/g, '-');
}

function movieBaseSlug(m: Movie): string {
  const base = m.year ? `${m.title} ${m.year}` : m.title;
  return slugify(base);
}

function playlistBaseSlug(p: Playlist): string {
  return slugify(p.title);
}

// Build maps of slug -> item and id -> slug (ensuring uniqueness)
const movieSlugById = new Map<Movie['id'], string>();
const playlistSlugById = new Map<Playlist['id'], string>();
export const movieSlugMap = new Map<string, Movie>();
export const playlistSlugMap = new Map<string, Playlist>();

// Movies
for (const m of movies as unknown as Movie[]) {
  const base = movieBaseSlug(m);
  let slug = base;
  let i = 1;
  while (movieSlugMap.has(slug)) {
    slug = `${base}-${m.id}`; // fallback with id for deterministic uniqueness
    i++;
    if (i > 2) break; // safety; should not loop endlessly
  }
  movieSlugMap.set(slug, m);
  movieSlugById.set(m.id, slug);
}

// Playlists
for (const p of playlists as unknown as Playlist[]) {
  const base = playlistBaseSlug(p);
  let slug = base;
  let i = 1;
  while (playlistSlugMap.has(slug)) {
    slug = `${base}-${p.id}`;
    i++;
    if (i > 2) break;
  }
  playlistSlugMap.set(slug, p);
  playlistSlugById.set(p.id, slug);
}

export function getUrlForItem(item: ContentItem): string {
  if (item.type === 'movie') {
    const slug = movieSlugById.get((item as Movie).id);
    return slug ? `/movie/${slug}` : '/';
  }
  const slug = playlistSlugById.get((item as Playlist).id);
  return slug ? `/playlist/${slug}` : '/';
}

export function getItemBySlug(kind: 'movie' | 'playlist', slug: string): ContentItem | null {
  if (kind === 'movie') return (movieSlugMap.get(slug) as ContentItem) ?? null;
  return (playlistSlugMap.get(slug) as ContentItem) ?? null;
}
