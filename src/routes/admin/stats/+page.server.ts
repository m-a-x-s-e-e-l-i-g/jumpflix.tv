import { createSupabaseServiceClient } from '$lib/server/supabaseClient';
import { requireAdmin } from '$lib/server/admin';
import { error } from '@sveltejs/kit';

export const load = async ({ locals }) => {
	const { user } = await locals.safeGetSession();
	if (!user) {
		throw error(401, 'Sign in required');
	}
	requireAdmin(user);

	const supabase = createSupabaseServiceClient();

	const [overviewRes, activityRes, ratingsDistRes, topMediaRes] = await Promise.all([
		supabase.rpc('admin_stats_overview'),
		supabase.rpc('admin_watch_activity', { days: 30 }),
		supabase.rpc('admin_ratings_distribution'),
		supabase.rpc('admin_top_watched_media', { limit_n: 10 })
	]);

	const rpcErrors = [overviewRes.error, activityRes.error, ratingsDistRes.error, topMediaRes.error].filter(
		(e): e is NonNullable<typeof e> => Boolean(e)
	);
	if (rpcErrors.length > 0) {
		const message = rpcErrors.map((e) => e.message).join(' | ');
		if (message.includes('Could not find the function') || message.includes('admin_stats_overview')) {
			throw error(
				500,
				'Missing admin stats SQL functions in Supabase. Apply the migration supabase/migrations/20260128000000_add_admin_stats_functions.sql to your Supabase project.'
			);
		}
		throw error(500, message);
	}

	return {
		overview: overviewRes.data as any,
		watchActivity: (activityRes.data as any[]) ?? [],
		ratingsDistribution: (ratingsDistRes.data as any[]) ?? [],
		topWatchedMedia: (topMediaRes.data as any[]) ?? []
	};
};
