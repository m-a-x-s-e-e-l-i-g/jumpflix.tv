import type { ContentItem, Facets } from './types';

export type FeedFilter = {
	itemTypes?: ContentItem['type'][];
	yearMin?: number;
	yearMax?: number;
	durationMinMinutes?: number;
	durationMaxMinutes?: number;
	facets?: {
		type?: NonNullable<Facets['type']>[];
		mood?: NonNullable<Facets['mood']>;
		movement?: NonNullable<Facets['movement']>;
		environment?: NonNullable<Facets['environment']>[];
		filmStyle?: NonNullable<Facets['filmStyle']>[];
		theme?: NonNullable<Facets['theme']>[];
		era?: NonNullable<Facets['era']>[];
		length?: NonNullable<Facets['length']>[];
	};
	excludeFacets?: {
		type?: NonNullable<Facets['type']>[];
		mood?: NonNullable<Facets['mood']>;
		movement?: NonNullable<Facets['movement']>;
		environment?: NonNullable<Facets['environment']>[];
		filmStyle?: NonNullable<Facets['filmStyle']>[];
		theme?: NonNullable<Facets['theme']>[];
		era?: NonNullable<Facets['era']>[];
		length?: NonNullable<Facets['length']>[];
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
				type: ['documentary']
			}
		}
	},
	{
		slug: 'fiction-films',
		title: 'Fiction Films',
		description: 'Narrative-driven parkour films.',
		filter: {
			facets: {
				type: ['fiction']
			}
		}
	},
	{
		slug: 'movie-night',
		title: 'Movie Night',
		description: 'Long-form movies that can carry the whole evening.',
		filter: {
			itemTypes: ['movie'],
			durationMinMinutes: 60,
			durationMaxMinutes: 160
		}
	},
	{
		slug: 'oldskool-classics',
		title: 'Oldskool Classics',
		description: 'Foundational movement, vintage energy, and early-era culture.',
		filter: {
			yearMax: 2015,
			excludeFacets: {
				theme: ['entertainment']
			}
		}
	},
	{
		slug: 'educational',
		title: 'Educational',
		description: 'Tutorials, talks, and breakdowns that teach something useful.',
		filter: {
			facets: {
				type: ['tutorial', 'talk'],
				theme: ['educational']
			}
		}
	},
	{
		slug: 'send-it',
		title: 'SEND IT',
		description: 'Big sends, raw commitment, and high-consequence movement.',
		filter: {
			facets: {
				movement: ['big-sends']
			}
		}
	}
];

export function getFeedBySlug(slug: string | null | undefined): FeedDefinition | null {
	if (!slug) return null;
	const normalized = slug.trim().toLowerCase();
	return FEEDS.find((f) => f.slug === normalized) ?? null;
}
