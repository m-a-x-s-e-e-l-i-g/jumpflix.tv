-- Allow the same Spotify track to be attached multiple times to the same video,
-- as long as the start offset differs.
--
-- Old schema enforced unique(video_id, song_id), which prevented re-using the
-- same track at multiple timestamps (e.g. intro + outro).

alter table if exists public.video_songs
	drop constraint if exists video_songs_video_id_song_id_key;

-- Keep a uniqueness guard for exact duplicates (same video, same song, same timestamp)
create unique index if not exists video_songs_video_song_start_unique_idx
	on public.video_songs (video_id, song_id, start_offset_seconds);
