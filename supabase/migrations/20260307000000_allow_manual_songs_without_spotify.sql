-- Allow songs to exist without Spotify metadata.
--
-- Some tracks are not available on Spotify; we still want to store them
-- in per-video tracklists (title + artist) without requiring a link.

alter table if exists public.songs
	alter column spotify_track_id drop not null,
	alter column spotify_url drop not null;
