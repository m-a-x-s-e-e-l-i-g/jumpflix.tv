-- Drop redundant indexes introduced by 20260203000000_add_video_tracklists
--
-- songs.spotify_track_id has a UNIQUE constraint, which already creates a unique btree index.
-- video_songs is queried by video_id; later migrations may adjust indexing.

drop index if exists public.songs_spotify_track_id_idx;
drop index if exists public.video_songs_video_id_idx;
