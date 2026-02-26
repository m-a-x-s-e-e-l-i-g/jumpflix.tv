-- Migration: Add top contributors RPC for public stats

-- Computes a leaderboard based on user-generated contributions:
-- ratings_count + reviews_count.
-- Intended for server-side execution using the Supabase service role key.

create or replace function public.admin_top_contributors(limit_n integer default 10)
returns table(user_id uuid, username text, ratings_count bigint, reviews_count bigint, score bigint)
language sql
security definer
set search_path = public, auth
as $$
	with rating_counts as (
		select r.user_id, count(*)::bigint as ratings_count
		from public.ratings r
		group by r.user_id
	),
	review_counts as (
		select rv.user_id, count(*)::bigint as reviews_count
		from public.reviews rv
		group by rv.user_id
	),
	combined as (
		select
			coalesce(rc.user_id, rvc.user_id) as user_id,
			coalesce(rc.ratings_count, 0)::bigint as ratings_count,
			coalesce(rvc.reviews_count, 0)::bigint as reviews_count,
			(coalesce(rc.ratings_count, 0) + coalesce(rvc.reviews_count, 0))::bigint as score
		from rating_counts rc
		full join review_counts rvc on rvc.user_id = rc.user_id
	)
	select
		c.user_id,
		coalesce(
			u.raw_user_meta_data->>'name',
			u.raw_user_meta_data->>'username',
			'User'
		) as username,
		c.ratings_count,
		c.reviews_count,
		c.score
	from combined c
	left join auth.users u on u.id = c.user_id
	where c.user_id is not null and c.score > 0
	order by c.score desc, c.reviews_count desc, c.ratings_count desc
	limit greatest(limit_n, 1);
$$;

revoke all on function public.admin_top_contributors(integer) from public;
grant execute on function public.admin_top_contributors(integer) to service_role;
