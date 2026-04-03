alter table public.media_items
	add column if not exists stream_url text;
