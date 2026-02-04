-- Admin stats helpers (RPC functions)
-- These are intended to be executed server-side using the Supabase service role key.

create or replace function public.admin_stats_overview()
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
	select jsonb_build_object(
		'total_users', (select count(*) from auth.users),
		'users_signed_in_last_15m', (select count(*) from auth.users where last_sign_in_at >= now() - interval '15 minutes'),
		'users_signed_in_last_24h', (select count(*) from auth.users where last_sign_in_at >= now() - interval '24 hours'),
		'ratings_count', (select count(*) from public.ratings),
		'average_rating', (select coalesce(round(avg(rating)::numeric, 2), 0) from public.ratings),
		'watch_history_rows', (select count(*) from public.watch_history where status = 'active'),
		'watch_users', (select count(distinct user_id) from public.watch_history where status = 'active'),
		'watched_items', (select count(*) from public.watch_history where status = 'active' and is_watched = true),
		'total_position_seconds', (select coalesce(sum(position_seconds), 0) from public.watch_history where status = 'active'),
		'total_duration_seconds', (select coalesce(sum(duration_seconds), 0) from public.watch_history where status = 'active'),
		'avg_percent_watched', (select coalesce(round(avg(percent_watched)::numeric, 1), 0) from public.watch_history where status = 'active')
	);
$$;

revoke all on function public.admin_stats_overview() from public;
grant execute on function public.admin_stats_overview() to service_role;

create or replace function public.admin_watch_activity(days integer default 30)
returns table(day date, active_users bigint, updates bigint, watched_updates bigint)
language sql
security definer
set search_path = public
as $$
	select
		date_trunc('day', wh.updated_at)::date as day,
		count(distinct wh.user_id) as active_users,
		count(*) as updates,
		sum(case when wh.is_watched then 1 else 0 end) as watched_updates
	from public.watch_history wh
	where wh.status = 'active'
		and wh.updated_at >= now() - (greatest(days, 1)::text || ' days')::interval
	group by 1
	order by 1;
$$;

revoke all on function public.admin_watch_activity(integer) from public;
grant execute on function public.admin_watch_activity(integer) to service_role;

create or replace function public.admin_ratings_distribution()
returns table(rating integer, count bigint)
language sql
security definer
set search_path = public
as $$
	select r.rating, count(*)::bigint as count
	from public.ratings r
	group by r.rating
	order by r.rating;
$$;

revoke all on function public.admin_ratings_distribution() from public;
grant execute on function public.admin_ratings_distribution() to service_role;

create or replace function public.admin_top_watched_media(limit_n integer default 10)
returns table(media_id text, media_type text, watchers bigint, avg_percent numeric)
language sql
security definer
set search_path = public
as $$
	select
		wh.media_id,
		wh.media_type,
		count(distinct wh.user_id) as watchers,
		coalesce(round(avg(wh.percent_watched)::numeric, 1), 0) as avg_percent
	from public.watch_history wh
	where wh.status = 'active'
	group by wh.media_id, wh.media_type
	order by watchers desc, avg_percent desc
	limit greatest(limit_n, 1);
$$;

revoke all on function public.admin_top_watched_media(integer) from public;
grant execute on function public.admin_top_watched_media(integer) to service_role;
