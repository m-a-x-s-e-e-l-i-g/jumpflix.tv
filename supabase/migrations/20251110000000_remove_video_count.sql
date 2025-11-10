-- Remove video_count column from media_items table
-- The video count can be queried dynamically from series_episodes
-- by joining through series_seasons

alter table public.media_items drop column if exists video_count;
