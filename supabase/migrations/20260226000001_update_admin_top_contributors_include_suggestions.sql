-- Migration: Expand top contributors score to include approved suggestions

-- Includes:
-- - ratings_count (public.ratings)
-- - reviews_count (public.reviews)
-- - approved_suggestions_count (public.content_suggestions where status = 'approved')
-- - approved_spot_suggestions_count (public.spot_chapters created from an approved suggestion)
--
-- Intended for server-side execution using the Supabase service role key.

-- NOTE: Postgres cannot change a function's OUT/return row type via CREATE OR REPLACE.
-- This migration intentionally drops the old function (created in the previous migration)
-- before creating the expanded version.

drop function if exists public.admin_top_contributors(integer);

create function public.admin_top_contributors(limit_n integer default 10)
returns table(
	user_id uuid,
	username text,
	ratings_count bigint,
	reviews_count bigint,
	approved_suggestions_count bigint,
	approved_spot_suggestions_count bigint,
	score bigint
)
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
	approved_suggestion_counts as (
		select cs.created_by as user_id, count(*)::bigint as approved_suggestions_count
		from public.content_suggestions cs
		where cs.created_by is not null
			and cs.status = 'approved'
		group by cs.created_by
	),
	approved_spot_suggestion_counts as (
		select cs.created_by as user_id,
			count(distinct sc.created_from_suggestion_id)::bigint as approved_spot_suggestions_count
		from public.spot_chapters sc
		join public.content_suggestions cs on cs.id = sc.created_from_suggestion_id
		where cs.created_by is not null
			and cs.status = 'approved'
		group by cs.created_by
	),
	all_users as (
		select user_id from rating_counts
		union
		select user_id from review_counts
		union
		select user_id from approved_suggestion_counts
		union
		select user_id from approved_spot_suggestion_counts
	),
	combined as (
		select
			u.user_id,
			coalesce(rc.ratings_count, 0)::bigint as ratings_count,
			coalesce(rvc.reviews_count, 0)::bigint as reviews_count,
			coalesce(sug.approved_suggestions_count, 0)::bigint as approved_suggestions_count,
			coalesce(assc.approved_spot_suggestions_count, 0)::bigint as approved_spot_suggestions_count
		from all_users u
		left join rating_counts rc on rc.user_id = u.user_id
		left join review_counts rvc on rvc.user_id = u.user_id
		left join approved_suggestion_counts sug on sug.user_id = u.user_id
		left join approved_spot_suggestion_counts assc on assc.user_id = u.user_id
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
		c.approved_suggestions_count,
		c.approved_spot_suggestions_count,
		(
			c.ratings_count
			+ c.reviews_count
			+ c.approved_suggestions_count
			+ c.approved_spot_suggestions_count
		)::bigint as score
	from combined c
	left join auth.users u on u.id = c.user_id
	where c.user_id is not null
		and (
			c.ratings_count
			+ c.reviews_count
			+ c.approved_suggestions_count
			+ c.approved_spot_suggestions_count
		) > 0
	order by
		score desc,
		c.approved_suggestions_count desc,
		c.approved_spot_suggestions_count desc,
		c.reviews_count desc,
		c.ratings_count desc
	limit greatest(limit_n, 1);
$$;

revoke all on function public.admin_top_contributors(integer) from public;
grant execute on function public.admin_top_contributors(integer) to service_role;
