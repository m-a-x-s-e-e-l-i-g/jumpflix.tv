import { toCatalogSummary } from '$lib/tv/catalog-summary';
import { getContentServiceStatus } from '$lib/server/content-service';
import { publicCacheHeaders } from '$lib/server/public-cache';
import { error } from '@sveltejs/kit';
import { fetchAllContent } from '$lib/server/content-service';
import { getFeedBySlug } from '$lib/tv/feeds';
import { matchesFeed } from '$lib/tv/utils';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params, parent, setHeaders }) => {
	const feed = getFeedBySlug(params.slug);
	if (!feed || feed.slug !== params.slug) error(404, 'Collection not found');
	const [auth, catalog] = await Promise.all([parent(), fetchAllContent()]);
	setHeaders(publicCacheHeaders(Boolean(auth.user), Boolean(getContentServiceStatus().lastError)));
	return {
		collectionSlug: feed.slug,
		content: catalog.filter((item) => matchesFeed(item, feed.slug)).map(toCatalogSummary)
	};
};
