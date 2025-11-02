import type { PageLoad } from './$types';
import type { ContentItem, Series } from '$lib/tv/types';
import { error } from '@sveltejs/kit';

export const load: PageLoad = async ({ params, parent }) => {
  const { slug } = params as { slug: string };
  const parentData = await parent();
  const content = (parentData as unknown as { content?: ContentItem[] }).content ?? [];
  const item = content.find((entry): entry is Series => entry.type === 'series' && entry.slug === slug) ?? null;
  if (!item) throw error(404, 'Series not found');
  return { item, episodes: [] };
};
