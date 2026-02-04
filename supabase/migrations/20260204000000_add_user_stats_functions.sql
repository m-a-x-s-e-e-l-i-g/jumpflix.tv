-- User stats helpers (RPC functions)
-- These are security definer functions so they can aggregate data across RLS-protected tables
-- without exposing raw watch history rows.

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

create or replace function public.user_ratings_distribution(target_user uuid)
returns table(rating integer, count bigint)
language sql
security definer
set search_path = public
as $$
	with counts as (
		select r.rating as rating, count(*)::bigint as count
		from public.ratings r
		where r.user_id = target_user
		group by r.rating
	)
	select s.rating, coalesce(c.count, 0)::bigint as count
	from generate_series(1, 10) as s(rating)
	left join counts c on c.rating = s.rating
	order by s.rating;
$$;

revoke all on function public.user_ratings_distribution(uuid) from public;
grant execute on function public.user_ratings_distribution(uuid) to anon, authenticated;

create or replace function public.user_rated_media(target_user uuid)
returns table(media_id bigint, rating integer, updated_at timestamptz, type text, title text, slug text)
language sql
security definer
set search_path = public
as $$
	select
		r.media_id,
		r.rating,
		r.updated_at,
		mi.type::text as type,
		mi.title,
		mi.slug
	from public.ratings r
	join public.media_items mi on mi.id = r.media_id
	where r.user_id = target_user
	order by r.rating desc, r.updated_at desc;
$$;

revoke all on function public.user_rated_media(uuid) from public;
grant execute on function public.user_rated_media(uuid) to anon, authenticated;

create or replace function public.user_watched_not_rated(target_user uuid, limit_n integer default 50)
returns table(id bigint, type text, title text, slug text, last_watched timestamptz)
language sql
security definer
set search_path = public
as $$
	with watched_items as (
		select
			case
				when wh.media_type in ('movie','series') then nullif(split_part(wh.media_id, ':', 2), '')::bigint
				else null
			end as item_id,
			max(wh.updated_at) as last_watched
		from public.watch_history wh
		where wh.user_id = target_user
			and wh.status = 'active'
			and wh.is_watched = true
			and wh.media_type in ('movie','series')
		group by 1
	)
	select
		mi.id,
		mi.type::text as type,
		mi.title,
		mi.slug,
		wi.last_watched
	from watched_items wi
	join public.media_items mi on mi.id = wi.item_id
	left join public.ratings r on r.user_id = target_user and r.media_id = mi.id
	where wi.item_id is not null and r.media_id is null
	order by wi.last_watched desc
	limit greatest(limit_n, 1);
$$;

revoke all on function public.user_watched_not_rated(uuid, integer) from public;
grant execute on function public.user_watched_not_rated(uuid, integer) to anon, authenticated;
