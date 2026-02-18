-- Migration: Drop author_name from reviews (derive from auth.users metadata instead)

alter table if exists public.reviews
	drop column if exists author_name;

create or replace view public.reviews_with_author as
select
	r.id,
	r.user_id,
	r.media_id,
	coalesce(
		u.raw_user_meta_data->>'name',
		u.raw_user_meta_data->>'username'
	) as author_name,
	r.body,
	r.created_at,
	r.updated_at
from public.reviews r
left join auth.users u on u.id = r.user_id;

revoke all on table public.reviews_with_author from public;
grant select on table public.reviews_with_author to anon, authenticated, service_role;
