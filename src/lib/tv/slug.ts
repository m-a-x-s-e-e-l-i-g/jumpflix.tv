import type { ContentItem, Series } from './types';

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

export function getUrlForItem(item: ContentItem): string {
  if (!item?.slug) return '/';
  if (item.type === 'movie') {
    return `/movie/${item.slug}`;
  }
  return `/series/${item.slug}`;
}

// Build a pretty URL for a specific episode within a series.
// Example: /series/<slug>/episodes/7 or /series/<slug>/seasons/1/episodes/7
export function getEpisodeUrl(series: Series, opts: { episodeNumber: number; seasonNumber?: number }): string {
  const base = getUrlForItem(series); // /series/<slug>
  const ep = Math.max(1, Math.floor(opts.episodeNumber || 1));
  const s = Math.max(1, Math.floor((opts.seasonNumber ?? 1)));
  return `${base}/seasons/${s}/episodes/${ep}`;
}
