import type { PageServerLoad } from './$types';
import type { ContentItem, Series } from '$lib/tv/types';
import { error } from '@sveltejs/kit';

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
  const { slug, season, episode } = params as { slug: string; season: string; episode: string };
  const parentData = await parent();
  const content = (parentData as unknown as { content?: ContentItem[] }).content ?? [];
  const item = content.find((entry): entry is Series => entry.type === 'series' && entry.slug === slug) ?? null;
  if (!item) throw error(404, 'Series not found');
  const seasonNumber = Number(season);
  const episodeNumber = Number(episode);
  if (!Number.isFinite(episodeNumber) || episodeNumber < 1) throw error(404, 'Episode not found');

  const isAuthenticated = Boolean((parentData as any)?.session || (parentData as any)?.user);
  setHeaders({
    'Cache-Control': isAuthenticated
      ? 'private, no-store'
      : 'public, max-age=43200, s-maxage=43200, stale-while-revalidate=86400',
    Vary: 'Cookie'
  });

  return {
    item,
    initialEpisodeNumber: Math.floor(episodeNumber),
    initialSeasonNumber: Number.isFinite(seasonNumber) ? Math.floor(seasonNumber) : null
  };
};
