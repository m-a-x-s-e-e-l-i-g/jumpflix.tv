-- Migration: Add length facet to media_facets_view
-- Issue: Add automatic facet for long/short form content
-- This re-adds the length facet with improved categorization

-- Drop the existing view first
drop view if exists public.media_facets_view;

-- Recreate the view with the length facet calculation
create view public.media_facets_view
with (security_invoker = true) as
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
  end as facet_era,
  -- Auto-calculate length facet from duration
  -- Short-form: under 15 minutes (typical for shorts, clips, trailers)
  -- Medium-form: 15-45 minutes (typical for session edits, short films)
  -- Long-form: 45+ minutes (typical for feature films, documentaries)
  case
    when duration is null then null
    when duration ~ '^\d+\s*m' then
      case
        when (regexp_match(duration, '(\d+)\s*m'))[1]::int < 15 then 'short-form'
        when (regexp_match(duration, '(\d+)\s*m'))[1]::int < 45 then 'medium-form'
        else 'long-form'
      end
    when duration ~ '^\d+\s*h' then
      case
        when (regexp_match(duration, '(\d+)\s*h'))[1]::int >= 1 then 'long-form'
        when duration ~ '\d+\s*m' then
          case
            when (regexp_match(duration, '(\d+)\s*m'))[1]::int < 15 then 'short-form'
            when (regexp_match(duration, '(\d+)\s*m'))[1]::int < 45 then 'medium-form'
            else 'long-form'
          end
        else 'long-form'
      end
    else null
  end as facet_length
from public.media_items;

-- Grant read access to the view
grant select on public.media_facets_view to anon, authenticated;

-- Add comment describing the length facet categories
comment on view public.media_facets_view is 'Media items with automatic facets (era and length) calculated from year and duration fields. Length: short-form (<15min), medium-form (15-45min), long-form (45+min)';
