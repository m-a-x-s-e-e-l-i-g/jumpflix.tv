-- Drop redundant indexes introduced by 20260203000000_add_video_tracklists
--
-- songs.spotify_track_id has a UNIQUE constraint, which already creates a unique btree index.
-- video_songs(video_id, position) can be used for lookups filtered by video_id (leftmost prefix).

drop index if exists public.songs_spotify_track_id_idx;
drop index if exists public.video_songs_video_id_idx;
