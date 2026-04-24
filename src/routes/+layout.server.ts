import { fetchAllContent } from '$lib/server/content-service';
import type { ContentItem, Series } from '$lib/tv/types';
import { isAdminUser } from '$lib/server/admin';
import { calculateUserXp } from '$lib/xp';

function shouldLoadTvCatalog(pathname: string): boolean {
	return !(
		pathname === '/about' ||
		pathname === '/autoplay' ||
		pathname === '/costs' ||
		pathname === '/privacy-policy' ||
		pathname === '/terms-of-service' ||
		pathname === '/stats' ||
		pathname.startsWith('/stats/') ||
		pathname.startsWith('/admin')
	);
}

export const load = async ({ url, locals }) => {
	const tvCatalogPromise = shouldLoadTvCatalog(url.pathname)
		? fetchAllContent()
		: Promise.resolve<ContentItem[]>([]);

	const [auth, content] = await Promise.all([
		locals.safeGetSession(),
		tvCatalogPromise
	]);
	const { session, user } = auth;

	let userXp = null;
	if (user?.id) {
		try {
			const [watchedRes, ratingsRes, reviewsRes, suggestionsRes] = await Promise.all([
				(locals.supabase as any)
					.from('watch_history')
					.select('media_id', { count: 'exact', head: true })
					.eq('user_id', user.id)
					.eq('status', 'active')
					.eq('is_watched', true),
				(locals.supabase as any)
					.from('ratings')
					.select('id', { count: 'exact', head: true })
					.eq('user_id', user.id),
				(locals.supabase as any)
					.from('reviews')
					.select('id', { count: 'exact', head: true })
					.eq('user_id', user.id),
				(locals.supabase as any)
					.from('content_suggestions')
					.select('xp_units')
					.eq('created_by', user.id)
					.eq('status', 'approved')
			]);

			const xpErrors = [watchedRes.error, ratingsRes.error, reviewsRes.error, suggestionsRes.error].filter(
				(e): e is NonNullable<typeof e> => Boolean(e)
			);

			if (xpErrors.length === 0) {
				const contributionsCount = ((suggestionsRes.data as Array<{ xp_units?: unknown }> | null) ?? [])
					.reduce((sum, row) => {
						const units = typeof row.xp_units === 'number' && row.xp_units >= 1 ? Math.floor(row.xp_units) : 1;
						return sum + units;
					}, 0);
				userXp = calculateUserXp({
					watchingCount: watchedRes.count ?? 0,
					ratingCount: ratingsRes.count ?? 0,
					reviewingCount: reviewsRes.count ?? 0,
					contributionsCount
				});
			} else {
				console.error('[+layout.server] Failed to load user XP:', xpErrors.map((e) => e.message).join(' | '));
			}
		} catch (error) {
			console.error('[+layout.server] Failed to load user XP:', error);
		}
	}

	try {
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
			userXp,
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
			userXp,
			session,
			user,
			isAdmin: isAdminUser(user)
		};
	}
};
