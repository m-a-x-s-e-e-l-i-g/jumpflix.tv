-- Migration: Fix reviews_with_author security issues (avoid exposing auth.users; use invoker security)

create schema if not exists private;

revoke all on schema private from public;
grant usage on schema private to anon, authenticated, service_role;

create table if not exists private.user_display_names (
	user_id uuid primary key references auth.users(id) on delete cascade,
	author_name text,
	updated_at timestamptz not null default timezone('utc', now())
);

revoke all on table private.user_display_names from public;
grant select on table private.user_display_names to anon, authenticated, service_role;

create or replace function public.sync_user_display_name()
returns trigger
language plpgsql
security definer
set search_path = public, private
as $$
begin
	insert into private.user_display_names (user_id, author_name, updated_at)
	values (
		new.id,
		nullif(
			coalesce(new.raw_user_meta_data->>'name', new.raw_user_meta_data->>'username'),
			''
		),
		timezone('utc', now())
	)
	on conflict (user_id) do update
		set author_name = excluded.author_name,
			updated_at = excluded.updated_at;

	return new;
end;
$$;

drop trigger if exists on_auth_user_display_name_changed on auth.users;
create trigger on_auth_user_display_name_changed
	after insert or update of raw_user_meta_data on auth.users
	for each row
	execute function public.sync_user_display_name();

insert into private.user_display_names (user_id, author_name, updated_at)
select
	u.id,
	nullif(coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'username'), ''),
	timezone('utc', now())
from auth.users u
on conflict (user_id) do update
	set author_name = excluded.author_name,
		updated_at = excluded.updated_at;

drop view if exists public.reviews_with_author;
create view public.reviews_with_author
with (security_invoker = true)
as
select
	r.id,
	r.user_id,
	r.media_id,
	udn.author_name,
	r.body,
	r.created_at,
	r.updated_at
from public.reviews r
left join private.user_display_names udn on udn.user_id = r.user_id;

revoke all on table public.reviews_with_author from public;
grant select on table public.reviews_with_author to anon, authenticated, service_role;
