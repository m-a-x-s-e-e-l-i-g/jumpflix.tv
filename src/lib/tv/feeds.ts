import * as m from '$lib/paraglide/messages';
import type { Locale } from '$lib/paraglide/runtime';

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
	title: (locale?: Locale) => string;
	description: (locale?: Locale) => string;
	introduction: (locale?: Locale) => string;
	filter: FeedFilter;
};

export const FEEDS: FeedDefinition[] = [
	{
		slug: 'documentaries',
		introduction: (locale) => m.tv_collection_documentaries_intro({}, { locale }),
		title: (locale) => m.tv_feed_documentaries_title({}, { locale }),
		description: (locale) => m.tv_feed_documentaries_description({}, { locale }),
		filter: {
			facets: {
				type: ['documentary']
			}
		}
	},
	{
		slug: 'fiction-films',
		introduction: (locale) => m.tv_collection_fictionFilms_intro({}, { locale }),
		title: (locale) => m.tv_feed_fictionFilms_title({}, { locale }),
		description: (locale) => m.tv_feed_fictionFilms_description({}, { locale }),
		filter: {
			facets: {
				type: ['fiction']
			}
		}
	},
	{
		slug: 'movie-night',
		introduction: (locale) => m.tv_collection_movieNight_intro({}, { locale }),
		title: (locale) => m.tv_feed_movieNight_title({}, { locale }),
		description: (locale) => m.tv_feed_movieNight_description({}, { locale }),
		filter: {
			itemTypes: ['movie'],
			durationMinMinutes: 60,
			durationMaxMinutes: 160
		}
	},
	{
		slug: 'oldskool-classics',
		introduction: (locale) => m.tv_collection_oldskoolClassics_intro({}, { locale }),
		title: (locale) => m.tv_feed_oldskoolClassics_title({}, { locale }),
		description: (locale) => m.tv_feed_oldskoolClassics_description({}, { locale }),
		filter: {
			yearMax: 2015
		}
	},
	{
		slug: 'educational',
		introduction: (locale) => m.tv_collection_educational_intro({}, { locale }),
		title: (locale) => m.tv_feed_educational_title({}, { locale }),
		description: (locale) => m.tv_feed_educational_description({}, { locale }),
		filter: {
			facets: {
				type: ['tutorial', 'talk']
			}
		}
	},
	{
		slug: 'send-it',
		introduction: (locale) => m.tv_collection_sendIt_intro({}, { locale }),
		title: (locale) => m.tv_feed_sendIt_title({}, { locale }),
		description: (locale) => m.tv_feed_sendIt_description({}, { locale }),
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
