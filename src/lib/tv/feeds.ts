import * as m from '$lib/paraglide/messages';

import type { ContentItem, Facets } from './types';

export type FeedFilter = {
	itemTypes?: ContentItem['type'][];
	yearMin?: number;
	yearMax?: number;
	durationMinMinutes?: number;
	durationMaxMinutes?: number;
	facets?: {
		type?: NonNullable<Facets['type']>[];
		focus?: NonNullable<Facets['focus']>[];
		movement?: NonNullable<Facets['movement']>;
		environment?: NonNullable<Facets['environment']>[];
		production?: NonNullable<Facets['production']>[];
		presentation?: NonNullable<Facets['presentation']>[];
		medium?: NonNullable<Facets['medium']>[];
		era?: NonNullable<Facets['era']>[];
		length?: NonNullable<Facets['length']>[];
	};
	excludeFacets?: {
		type?: NonNullable<Facets['type']>[];
		focus?: NonNullable<Facets['focus']>[];
		movement?: NonNullable<Facets['movement']>;
		environment?: NonNullable<Facets['environment']>[];
		production?: NonNullable<Facets['production']>[];
		presentation?: NonNullable<Facets['presentation']>[];
		medium?: NonNullable<Facets['medium']>[];
		era?: NonNullable<Facets['era']>[];
		length?: NonNullable<Facets['length']>[];
	};
};

export type FeedDefinition = {
	slug: string;
	title: () => string;
	description: () => string;
	filter: FeedFilter;
};

export const FEEDS: FeedDefinition[] = [
	{
		slug: 'documentaries',
		title: () => m.tv_feed_documentaries_title(),
		description: () => m.tv_feed_documentaries_description(),
		filter: {
			facets: {
				type: ['documentary']
			}
		}
	},
	{
		slug: 'fiction-films',
		title: () => m.tv_feed_fictionFilms_title(),
		description: () => m.tv_feed_fictionFilms_description(),
		filter: {
			facets: {
				type: ['fiction']
			}
		}
	},
	{
		slug: 'movie-night',
		title: () => m.tv_feed_movieNight_title(),
		description: () => m.tv_feed_movieNight_description(),
		filter: {
			itemTypes: ['movie'],
			durationMinMinutes: 60,
			durationMaxMinutes: 160
		}
	},
	{
		slug: 'oldskool-classics',
		title: () => m.tv_feed_oldskoolClassics_title(),
		description: () => m.tv_feed_oldskoolClassics_description(),
		filter: {
			yearMax: 2015
		}
	},
	{
		slug: 'educational',
		title: () => m.tv_feed_educational_title(),
		description: () => m.tv_feed_educational_description(),
		filter: {
			facets: {
				type: ['tutorial', 'talk']
			}
		}
	},
	{
		slug: 'send-it',
		title: () => m.tv_feed_sendIt_title(),
		description: () => m.tv_feed_sendIt_description(),
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
