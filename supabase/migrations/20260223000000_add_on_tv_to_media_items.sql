-- Add on_tv flag to media_items to indicate content that has been broadcast on TV.
-- Used by the external API to filter content for parkour.spot integration.

alter table public.media_items
    add column if not exists on_tv boolean not null default false;

comment on column public.media_items.on_tv is 'Whether this media item has been featured on TV broadcasts.';
