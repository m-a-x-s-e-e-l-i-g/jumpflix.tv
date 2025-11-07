-- Migration: Fix media_facets_view security property
-- Issue: View was using SECURITY DEFINER instead of SECURITY INVOKER

-- Recreate the view with SECURITY INVOKER to respect RLS policies of the querying user
create or replace view public.media_facets_view
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
