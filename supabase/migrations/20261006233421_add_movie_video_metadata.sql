-- Upload dates are verified against the exact provider source, not inferred from release years.
alter table public.media_items add column if not exists video_metadata jsonb;
comment on column public.media_items.video_metadata is
  'Verified video upload metadata: {sourceKey, publishedAt}. Ignored when the playback source changes.';
