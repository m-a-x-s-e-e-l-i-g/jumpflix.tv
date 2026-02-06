-- Remove manual track ordering for per-video tracklists.
-- Ordering is derived from start_offset_seconds; ties do not matter.

-- Old index was based on (video_id, position)
drop index if exists public.video_songs_video_id_position_idx;

-- Drop the redundant ordering column
alter table if exists public.video_songs
	drop column if exists position;

-- Index for the new natural ordering / common lookup
create index if not exists video_songs_video_id_start_offset_seconds_idx
	on public.video_songs (video_id, start_offset_seconds);
