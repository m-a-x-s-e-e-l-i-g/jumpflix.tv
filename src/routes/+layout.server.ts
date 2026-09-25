import { isAdminUser } from '$lib/server/admin';
import { calculateUserXp } from '$lib/xp';

// Route loaders own public content. Keeping it out of the shared layout avoids
// serializing the complete catalog on every film, episode, and person page.
export const load = async ({ locals }) => {
	const { session, user } = await locals.safeGetSession();

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

			const xpErrors = [
				watchedRes.error,
				ratingsRes.error,
				reviewsRes.error,
				suggestionsRes.error
			].filter((e): e is NonNullable<typeof e> => Boolean(e));

			if (xpErrors.length === 0) {
				const contributionsCount = (
					(suggestionsRes.data as Array<{ xp_units?: unknown }> | null) ?? []
				).reduce((sum, row) => {
					const units =
						typeof row.xp_units === 'number' && row.xp_units >= 1 ? Math.floor(row.xp_units) : 1;
					return sum + units;
				}, 0);
				userXp = calculateUserXp({
					watchingCount: watchedRes.count ?? 0,
					ratingCount: ratingsRes.count ?? 0,
					reviewingCount: reviewsRes.count ?? 0,
					contributionsCount
				});
			} else {
				console.error(
					'[+layout.server] Failed to load user XP:',
					xpErrors.map((e) => e.message).join(' | ')
				);
			}
		} catch (error) {
			console.error('[+layout.server] Failed to load user XP:', error);
		}
	}

	return { userXp, session, user, isAdmin: isAdminUser(user) };
};
