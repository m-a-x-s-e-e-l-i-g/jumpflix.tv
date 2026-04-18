create or replace function public.user_watched_not_rated(target_user uuid, limit_n integer default 50)
returns table(id bigint, type text, title text, slug text, last_watched timestamptz)
language sql
security definer
set search_path = public
as $$
	with watched_items as (
		select
			case
				when wh.media_type in ('movie', 'series') and wh.media_id ~ '^\d+$'
					then wh.media_id::bigint
				when wh.media_type in ('movie', 'series') and wh.media_id ~ '^(movie|series):\d+(:|$)'
					then substring(wh.media_id from '^(?:movie|series):(\d+)')::bigint
				else null
			end as item_id,
			max(wh.updated_at) as last_watched
		from public.watch_history wh
		where wh.user_id = target_user
			and wh.status = 'active'
			and wh.is_watched = true
			and wh.media_type in ('movie', 'series')
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