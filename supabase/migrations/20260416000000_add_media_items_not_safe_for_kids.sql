alter table public.media_items
add column if not exists not_safe_for_kids boolean not null default false;