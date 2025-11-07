-- Migration: Add structured tagging (facets) for parkour videos
-- Issue #38: https://github.com/m-a-x-s-e-e-l-i-g/jumpflix.tv/issues/38

-- Add facet columns to media_items table
alter table public.media_items
  add column if not exists facet_type text check (
    facet_type in (
      'fiction',           -- Fiction / Parkour Film (narrative stories)
      'documentary',       -- Documentary (real people, interviews)
      'session',          -- Session / Edit / Team Film (classic parkour videos)
      'event',            -- Event / Jam / Competition
      'tutorial'          -- Tutorial / Educational
    )
  ),
  add column if not exists facet_mood text[] default '{}'::text[], -- Energetic, Chill, Gritty, Wholesome, Intense, Artistic
  add column if not exists facet_movement text[] default '{}'::text[], -- Flow, Big Sends, Tricking, Technical, Speed/Chase, Oldskool, Dance
  add column if not exists facet_environment text check (
    facet_environment in (
      'street',    -- Street / Urban
      'rooftops',  -- Rooftops
      'nature',    -- Nature
      'urbex',     -- Urbex (abandoned)
      'gym'        -- Gym (indoor setup)
    )
  ),
  add column if not exists facet_film_style text check (
    facet_film_style in (
      'cinematic',    -- Cinematic (color, composition, narrative)
      'skateish',     -- Skate-ish (fisheye, rough, VX vibes)
      'raw',          -- Raw Session (minimal music, breathing, talking)
      'pov',          -- POV / Chasecam
      'longtakes'     -- Long Takes (slow, minimal cutting)
    )
  ),
  add column if not exists facet_theme text check (
    facet_theme in (
      'journey',       -- Journey (personal growth / reflection)
      'team',          -- Team Film (group identity / collective style)
      'event',         -- Event Highlight (jam / gathering recap)
      'competition',   -- Competition (speed/skill battles)
      'educational',   -- Educational (tutorials / breakdowns)
      'travel',        -- Travel (city hopping / exploring spots)
      'creative',      -- Creative / Expression (artistic intent, experimental)
      'entertainment'  -- Showcase / Entertainment (fun, hype)
    )
  );

-- Create indexes for facet filtering
create index if not exists media_items_facet_type_idx on public.media_items (facet_type);
create index if not exists media_items_facet_environment_idx on public.media_items (facet_environment);
create index if not exists media_items_facet_film_style_idx on public.media_items (facet_film_style);
create index if not exists media_items_facet_theme_idx on public.media_items (facet_theme);

-- Create GIN indexes for array columns (for efficient filtering on multi-select facets)
create index if not exists media_items_facet_mood_idx on public.media_items using gin (facet_mood);
create index if not exists media_items_facet_movement_idx on public.media_items using gin (facet_movement);

-- Create a view for automatic facets (length and era)
-- These are computed from existing duration and year columns
create or replace view public.media_facets_view as
select 
  id,
  slug,
  title,
  type,
  facet_type,
  facet_mood,
  facet_movement,
  facet_environment,
  facet_film_style,
  facet_theme,
  -- Auto-calculate length facet from duration
  case
    when duration is null then null
    when duration ~ '^\d+min$' then
      case
        when substring(duration from '^\d+')::int < 7 then 'short'
        when substring(duration from '^\d+')::int < 30 then 'medium'
        when substring(duration from '^\d+')::int < 70 then 'feature'
        else 'long-feature'
      end
    when duration ~ '^\d+h' then
      case
        when substring(duration from '^\d+')::int = 0 then
          case
            when substring(duration from '\d+m')::int < 7 then 'short'
            when substring(duration from '\d+m')::int < 30 then 'medium'
            else 'feature'
          end
        when substring(duration from '^\d+')::int >= 1 then
          case
            when substring(duration from '^\d+')::int >= 2 then 'long-feature'
            else 'feature'
          end
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

-- Grant read access to the view
grant select on public.media_facets_view to anon, authenticated;

comment on table public.media_items is 'Media items (movies and series) with structured tagging facets';
comment on column public.media_items.facet_type is 'Content type: fiction, documentary, session, event, tutorial (single-select)';
comment on column public.media_items.facet_mood is 'Mood/vibe: energetic, chill, gritty, wholesome, intense, artistic (multi-select)';
comment on column public.media_items.facet_movement is 'Movement style: flow, big-sends, tricking, technical, speed, oldskool, dance (multi-select)';
comment on column public.media_items.facet_environment is 'Environment: street, rooftops, nature, urbex, gym (single-select)';
comment on column public.media_items.facet_film_style is 'Film style: cinematic, skateish, raw, pov, longtakes (single-select)';
comment on column public.media_items.facet_theme is 'Theme/purpose: journey, team, event, competition, educational, travel, creative, entertainment (single-select)';
