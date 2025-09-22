import type { LayoutLoad } from './$types';
import { getItemBySlug } from '$lib/tv/slug';

export const load: LayoutLoad = async ({ url }) => {
  const segments = url.pathname.split('/').filter(Boolean);
  let item: any = null;
  let initialEpisodeNumber: number | null = null;
  let initialSeasonNumber: number | null = null;

  if (segments.length >= 2) {
    const [first, slug, a, b, c, d] = segments;
    if (first === 'movie' && slug) {
      item = getItemBySlug('movie', slug);
    } else if (first === 'series' && slug) {
      item = getItemBySlug('series', slug);
      // Support /series/<slug>/seasons/<season>/episodes/<episode>
      if (a === 'seasons' && b && c === 'episodes' && d) {
        const sn = Number(b);
        const ep = Number(d);
        if (Number.isFinite(sn) && sn >= 1) initialSeasonNumber = Math.floor(sn);
        if (Number.isFinite(ep) && ep >= 1) initialEpisodeNumber = Math.floor(ep);
      }
      // Back-compat: /series/<slug>/episodes/<episode> (season defaults to 1)
      if (a === 'episodes' && b) {
        const ep = Number(b);
        if (Number.isFinite(ep) && ep >= 1) {
          initialSeasonNumber = 1;
          initialEpisodeNumber = Math.floor(ep);
        }
      }
    }
  }

  return { item, initialEpisodeNumber, initialSeasonNumber };
};
