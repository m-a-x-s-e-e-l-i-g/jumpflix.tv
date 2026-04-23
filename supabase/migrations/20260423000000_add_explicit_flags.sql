-- Explicit tagging model:
-- - songs.explicit: canonical explicit flag from Spotify
-- - media_items.content_warnings: manual/advisory source (existing field)
-- - media_items.explicit: derived convenience boolean
--
-- media_items.explicit is true when either:
-- 1) any linked song is Spotify-explicit, or
-- 2) content_warnings contains 'strong-language'.

-- Add explicit flag to songs table.
alter table public.songs
  add column if not exists explicit boolean not null default false;

-- Add derived explicit convenience flag to media_items.
alter table public.media_items
  add column if not exists explicit boolean not null default false;

-- Backfill explicit from existing warnings + linked songs.
update public.media_items as mi
set explicit =
  coalesce(mi.content_warnings, '{}'::text[]) @> array['strong-language']::text[]
  or exists (
    select 1
    from public.video_songs vs
    join public.songs s on s.id = vs.song_id
    where vs.video_id = mi.id
      and coalesce(s.explicit, false)
  );

create or replace function public.recompute_media_item_explicit(p_media_item_id bigint)
returns void
language plpgsql
as $$
begin
  if p_media_item_id is null then
    return;
  end if;

  update public.media_items as mi
  set explicit =
    coalesce(mi.content_warnings, '{}'::text[]) @> array['strong-language']::text[]
    or exists (
      select 1
      from public.video_songs vs
      join public.songs s on s.id = vs.song_id
      where vs.video_id = p_media_item_id
        and coalesce(s.explicit, false)
    )
  where mi.id = p_media_item_id;
end;
$$;

create or replace function public.video_songs_recompute_media_explicit_trigger()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'DELETE' then
    perform public.recompute_media_item_explicit(old.video_id);
    return old;
  end if;

  perform public.recompute_media_item_explicit(new.video_id);

  if tg_op = 'UPDATE' and new.video_id is distinct from old.video_id then
    perform public.recompute_media_item_explicit(old.video_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_video_songs_recompute_media_explicit on public.video_songs;
create trigger trg_video_songs_recompute_media_explicit
after insert or update or delete on public.video_songs
for each row execute function public.video_songs_recompute_media_explicit_trigger();

create or replace function public.songs_recompute_linked_media_explicit_trigger()
returns trigger
language plpgsql
as $$
declare
  v_media_id bigint;
begin
  for v_media_id in
    select distinct vs.video_id
    from public.video_songs vs
    where vs.song_id = new.id
  loop
    perform public.recompute_media_item_explicit(v_media_id);
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_songs_recompute_linked_media_explicit on public.songs;
create trigger trg_songs_recompute_linked_media_explicit
after update of explicit on public.songs
for each row
when (new.explicit is distinct from old.explicit)
execute function public.songs_recompute_linked_media_explicit_trigger();

create or replace function public.media_items_recompute_explicit_from_warnings_trigger()
returns trigger
language plpgsql
as $$
begin
  perform public.recompute_media_item_explicit(new.id);
  return new;
end;
$$;

drop trigger if exists trg_media_items_recompute_explicit_from_warnings on public.media_items;
create trigger trg_media_items_recompute_explicit_from_warnings
after insert or update of content_warnings on public.media_items
for each row execute function public.media_items_recompute_explicit_from_warnings_trigger();
