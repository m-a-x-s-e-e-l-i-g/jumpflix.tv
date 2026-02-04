import type { Facets } from './types';

export type FeedFilter = {
	itemTypes?: Array<'movie' | 'series'>;
	durationMinMinutes?: number;
	durationMaxMinutes?: number;
	facets?: {
		type?: Facets['type'];
		environment?: Facets['environment'];
	};
};

export type FeedDefinition = {
	slug: string;
	title: string;
	description: string;
	filter: FeedFilter;
};

export const FEEDS: FeedDefinition[] = [
	{
		slug: 'documentaries',
		title: 'Documentaries',
		description: 'Real stories, interviews, behind-the-scenes.',
		filter: {
			facets: {
				type: 'documentary'
			}
		}
	},
	{
		slug: 'fiction-films',
		title: 'Fiction Films',
		description: 'Narrative-driven parkour films.',
		filter: {
			facets: {
				type: 'fiction'
			}
		}
	},
	{
		slug: 'movie-night',
		title: 'Movie Night (Feature Movies)',
		description: 'Movies ~60–160 minutes. Great for a watch party.',
		filter: {
			itemTypes: ['movie'],
			durationMinMinutes: 60,
			durationMaxMinutes: 160
		}
	},
	{
		slug: 'street-sessions',
		title: 'Street Sessions',
		description: 'Classic training edits, mostly in the streets.',
		filter: {
			facets: {
				type: 'session',
				environment: 'street'
			}
		}
	}
];

export function getFeedBySlug(slug: string | null | undefined): FeedDefinition | null {
	if (!slug) return null;
	const normalized = slug.trim().toLowerCase();
	return FEEDS.find((f) => f.slug === normalized) ?? null;
}
