import { fetchAllContent } from '$lib/server/content-service';
import type { ContentItem, Series } from '$lib/tv/types';
import { isAdminUser } from '$lib/server/admin';

export const load = async ({ url, locals }) => {
	// Get the authenticated session using safe method that validates JWT
	const { session, user } = await locals.safeGetSession();

	try {
		const content = await fetchAllContent();

		// Ensure content is JSON serializable by using JSON.parse(JSON.stringify())
		const serializedContent = JSON.parse(JSON.stringify(content));

		const segments = url.pathname.split('/').filter(Boolean);
		let item: ContentItem | null = null;
		let initialEpisodeNumber: number | null = null;
		let initialSeasonNumber: number | null = null;

		if (segments.length >= 2) {
			const [first, slug, a, b, c, d] = segments;
			if (first === 'movie' && slug) {
				item =
					serializedContent.find((entry: any) => entry.type === 'movie' && entry.slug === slug) ??
					null;
			} else if (first === 'series' && slug) {
				const series =
					serializedContent.find((entry: any) => entry.type === 'series' && entry.slug === slug) ??
					null;
				item = series;
				if (series) {
					if (a === 'seasons' && b && c === 'episodes' && d) {
						const sn = Number(b);
						const ep = Number(d);
						if (Number.isFinite(sn) && sn >= 1) initialSeasonNumber = Math.floor(sn);
						if (Number.isFinite(ep) && ep >= 1) initialEpisodeNumber = Math.floor(ep);
					}
					if (a === 'episodes' && b) {
						const ep = Number(b);
						if (Number.isFinite(ep) && ep >= 1) {
							initialSeasonNumber = 1;
							initialEpisodeNumber = Math.floor(ep);
						}
					}
				}
			}
		}

		return {
			content: serializedContent,
			item,
			initialEpisodeNumber,
			initialSeasonNumber,
			// Pass session and user to all pages for auth state
			session,
			user,
			isAdmin: isAdminUser(user)
		};
	} catch (error) {
		console.error('[+layout.server] Error in load function:', error);
		return {
			content: [],
			item: null,
			initialEpisodeNumber: null,
			initialSeasonNumber: null,
			session,
			user,
			isAdmin: isAdminUser(user)
		};
	}
};
