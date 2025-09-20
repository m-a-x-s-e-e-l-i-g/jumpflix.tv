import { movies } from '$lib/assets/movies';
import { series as seriesData } from '$lib/assets/series';
import type { ContentItem, Movie, Series } from './types';

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

function seriesBaseSlug(p: Series): string {
  return slugify(p.title);
}

// Build maps of slug -> item and id -> slug (ensuring uniqueness)
const movieSlugById = new Map<Movie['id'], string>();
const seriesSlugById = new Map<Series['id'], string>();
export const movieSlugMap = new Map<string, Movie>();
export const seriesSlugMap = new Map<string, Series>();

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

// Series
for (const p of seriesData as unknown as Series[]) {
  const base = seriesBaseSlug(p);
  let slug = base;
  let i = 1;
  while (seriesSlugMap.has(slug)) {
    slug = `${base}-${p.id}`;
    i++;
    if (i > 2) break;
  }
  seriesSlugMap.set(slug, p);
  seriesSlugById.set(p.id, slug);
}

export function getUrlForItem(item: ContentItem): string {
  if (item.type === 'movie') {
    const slug = movieSlugById.get((item as Movie).id);
    return slug ? `/movie/${slug}` : '/';
  }
  const slug = seriesSlugById.get((item as Series).id);
  return slug ? `/series/${slug}` : '/';
}

export function getItemBySlug(kind: 'movie' | 'series', slug: string): ContentItem | null {
  if (kind === 'movie') return (movieSlugMap.get(slug) as ContentItem) ?? null;
  return (seriesSlugMap.get(slug) as ContentItem) ?? null;
}
