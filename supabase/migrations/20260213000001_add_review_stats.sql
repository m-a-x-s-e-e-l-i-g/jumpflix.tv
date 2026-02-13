-- Migration: Add review counts to stats RPC functions

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
		'reviews_count', (select count(*) from public.reviews),
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

create or replace function public.user_stats_overview(target_user uuid)
returns jsonb
language sql
security definer
set search_path = public, auth
as $$
	select jsonb_build_object(
		'found', exists(select 1 from auth.users u where u.id = target_user),
		'username', (
			select coalesce(
				u.raw_user_meta_data->>'name',
				u.raw_user_meta_data->>'username',
				'User'
			)
			from auth.users u
			where u.id = target_user
		),
		'ratings_count', (select count(*) from public.ratings r where r.user_id = target_user),
		'reviews_count', (select count(*) from public.reviews rv where rv.user_id = target_user),
		'average_rating', (select coalesce(round(avg(r.rating)::numeric, 2), 0) from public.ratings r where r.user_id = target_user),
		'watched_items', (select count(*) from public.watch_history wh where wh.user_id = target_user and wh.status = 'active' and wh.is_watched = true),
		'watched_movies', (select count(*) from public.watch_history wh where wh.user_id = target_user and wh.status = 'active' and wh.is_watched = true and wh.media_type = 'movie'),
		'watched_series', (select count(*) from public.watch_history wh where wh.user_id = target_user and wh.status = 'active' and wh.is_watched = true and wh.media_type = 'series'),
		'watched_episodes', (select count(*) from public.watch_history wh where wh.user_id = target_user and wh.status = 'active' and wh.is_watched = true and wh.media_type = 'episode'),
		'total_position_seconds', (select coalesce(sum(wh.position_seconds), 0) from public.watch_history wh where wh.user_id = target_user and wh.status = 'active'),
		'total_duration_seconds', (select coalesce(sum(wh.duration_seconds), 0) from public.watch_history wh where wh.user_id = target_user and wh.status = 'active'),
		'avg_percent_watched', (select coalesce(round(avg(wh.percent_watched)::numeric, 1), 0) from public.watch_history wh where wh.user_id = target_user and wh.status = 'active'),
		'catalog_movies', (select count(*) from public.media_items mi where mi.type = 'movie'),
		'catalog_episodes', (select count(*) from public.series_episodes se)
	);
$$;

revoke all on function public.user_stats_overview(uuid) from public;
grant execute on function public.user_stats_overview(uuid) to anon, authenticated;
