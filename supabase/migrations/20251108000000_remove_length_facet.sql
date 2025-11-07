-- Migration: Remove length facet from media_facets_view
-- Reason: Content length facet is buggy

-- Drop the existing view first
drop view if exists public.media_facets_view;

-- Recreate the view without the length facet calculation
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
  end as facet_era
from public.media_items;

-- Grant read access to the view
grant select on public.media_facets_view to anon, authenticated;
