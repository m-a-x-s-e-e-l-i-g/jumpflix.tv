-- Migration: Implement simplified facet taxonomy
-- Replaces overlapping facets (mood, film_style, theme) with clearer creative facets
-- (focus, production, presentation, medium) and adds content_warnings.
-- Also cleans up facet_type by removing 'vlog' (which now lives in facet_presentation).
--
-- Data migration guidance used:
--   old theme=showcase       -> facet_focus=showreel
--   old theme=competition    -> facet_focus=competition
--   old theme=event          -> facet_focus=jam
--   old theme=journey        -> facet_focus=conceptual
--   old theme=educational    -> NULL (facet_type=tutorial already covers this)
--   old theme=team/travel/creative/entertainment -> NULL (no clean destination)
--   old film_style=pov       -> facet_presentation=pov
--   old film_style=raw       -> facet_production=raw
--   old film_style=cinematic/street-cinematic/minimalist/experimental -> facet_production=produced
--   old film_style=skateish/gonzo/vintage -> facet_production=casual
--   old film_style=longtakes/music-driven/montage/slowmo -> facet_production=produced (edited/crafted)
--   old facet_type=vlog      -> facet_type=session + facet_presentation=vlog

-- ─── Step 1: Add new columns ────────────────────────────────────────────────

alter table public.media_items
  add column if not exists facet_focus text,
  add column if not exists facet_production text,
  add column if not exists facet_presentation text,
  add column if not exists facet_medium text,
  add column if not exists content_warnings text[] default '{}'::text[];

-- ─── Step 2: Data migration ──────────────────────────────────────────────────

-- Map old facet_theme -> facet_focus
update public.media_items
  set facet_focus = 'showreel'
  where facet_theme = 'showcase' and facet_focus is null;

update public.media_items
  set facet_focus = 'competition'
  where facet_theme = 'competition' and facet_focus is null;

update public.media_items
  set facet_focus = 'jam'
  where facet_theme = 'event' and facet_focus is null;

update public.media_items
  set facet_focus = 'conceptual'
  where facet_theme = 'journey' and facet_focus is null;

-- Map old facet_film_style -> facet_presentation / facet_production
update public.media_items
  set facet_presentation = 'pov'
  where facet_film_style = 'pov' and facet_presentation is null;

update public.media_items
  set facet_production = 'raw'
  where facet_film_style = 'raw' and facet_production is null;

update public.media_items
  set facet_production = 'produced'
  where facet_film_style in ('cinematic', 'street-cinematic', 'minimalist', 'experimental',
                              'longtakes', 'music-driven', 'montage', 'slowmo')
    and facet_production is null;

update public.media_items
  set facet_production = 'casual'
  where facet_film_style in ('skateish', 'gonzo', 'vintage')
    and facet_production is null;

-- Migrate old vlog type: vlog videos become session + presentation=vlog
update public.media_items
  set facet_presentation = 'vlog',
      facet_type = 'session'
  where facet_type = 'vlog' and facet_presentation is null;

-- ─── Step 3: Drop old columns ────────────────────────────────────────────────

alter table public.media_items
  drop column if exists facet_mood,
  drop column if exists facet_film_style,
  drop column if exists facet_theme;

-- ─── Step 4: Update facet_type CHECK constraint (remove 'vlog') ──────────────

-- Drop all existing facet_type constraints (name may vary)
alter table public.media_items
  drop constraint if exists media_items_facet_type_check;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    where c.conrelid = 'public.media_items'::regclass
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) like '%facet_type%'
  loop
    execute format('alter table public.media_items drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.media_items
  add constraint media_items_facet_type_check check (
    facet_type in (
      'fiction',
      'documentary',
      'session',
      'event',
      'tutorial',
      'music-video',
      'talk'
    )
  );

-- ─── Step 5: Add CHECK constraints for new columns ───────────────────────────

alter table public.media_items
  add constraint media_items_facet_focus_check check (
    facet_focus in (
      'showreel',
      'competition',
      'jam',
      'conceptual',
      'gear',
      'awards'
    )
  ),
  add constraint media_items_facet_production_check check (
    facet_production in (
      'raw',
      'casual',
      'produced',
      'premium'
    )
  ),
  add constraint media_items_facet_presentation_check check (
    facet_presentation in (
      'standard',
      'pov',
      'vlog',
      'top-down',
      'stylized'
    )
  ),
  add constraint media_items_facet_medium_check check (
    facet_medium in (
      'live-action',
      'animation',
      'mixed-media'
    )
  );

-- ─── Step 6: Add indexes ─────────────────────────────────────────────────────

create index if not exists media_items_facet_focus_idx on public.media_items (facet_focus);
create index if not exists media_items_facet_production_idx on public.media_items (facet_production);
create index if not exists media_items_facet_presentation_idx on public.media_items (facet_presentation);
create index if not exists media_items_facet_medium_idx on public.media_items (facet_medium);
create index if not exists media_items_content_warnings_idx on public.media_items using gin (content_warnings);

-- Drop old indexes that no longer apply
drop index if exists public.media_items_facet_film_style_idx;
drop index if exists public.media_items_facet_theme_idx;
drop index if exists public.media_items_facet_mood_idx;

-- ─── Step 7: Recreate media_facets_view with new columns ─────────────────────

create or replace view public.media_facets_view as
select
  id,
  slug,
  title,
  type,
  facet_type,
  facet_focus,
  facet_movement,
  facet_environment,
  facet_production,
  facet_presentation,
  facet_medium,
  content_warnings,
  -- Auto-calculate length facet from duration
  case
    when duration is null then null
    when duration ~ '^\d+h' then
      case
        when (coalesce(substring(duration from '(\d+)h')::int, 0) * 60
              + coalesce(substring(duration from '(\d+)m')::int, 0)) < 15 then 'short-form'
        when (coalesce(substring(duration from '(\d+)h')::int, 0) * 60
              + coalesce(substring(duration from '(\d+)m')::int, 0)) < 45 then 'medium-form'
        else 'long-form'
      end
    when duration ~ '^\d+m$' then
      case
        when substring(duration from '^\d+')::int < 15 then 'short-form'
        when substring(duration from '^\d+')::int < 45 then 'medium-form'
        else 'long-form'
      end
    else null
  end as facet_length,
  -- Auto-calculate era facet from year
  case
    when year is null then null
    when year ~ '^\d{4}$' then
      case
        when year::int >= 2030 then '2030s'
        when year::int >= 2020 then '2020s'
        when year::int >= 2010 then '2010s'
        when year::int >= 2000 then '2000s'
        else 'pre-2000'
      end
    else null
  end as facet_era
from public.media_items;

-- Re-grant read access
grant select on public.media_facets_view to anon, authenticated;

-- ─── Step 8: Update column comments ─────────────────────────────────────────

comment on column public.media_items.facet_type is
  'Content format: fiction, documentary, session, event, tutorial, music-video, talk (single-select)';
comment on column public.media_items.facet_focus is
  'Creative focus: showreel, competition, jam, conceptual, gear, awards (single-select)';
comment on column public.media_items.facet_movement is
  'Movement style: flow, big-sends, style, descents, technical, speed, oldskool, contemporary (multi-select)';
comment on column public.media_items.facet_environment is
  'Dominant setting: street, rooftops, nature, urbex, gym (single-select)';
comment on column public.media_items.facet_production is
  'Production level: raw, casual, produced, premium (single-select)';
comment on column public.media_items.facet_presentation is
  'Presentation format: standard, pov, vlog, top-down, stylized (single-select)';
comment on column public.media_items.facet_medium is
  'Medium type: live-action, animation, mixed-media (single-select)';
comment on column public.media_items.content_warnings is
  'Advisory warnings: violence, substances, strong-language, sexual-content, intense-themes (multi-select)';
