-- Migration: Add custom season names
-- Allows naming seasons like "Competition Year 2023" or "Extras" instead of just "Season 1"

-- Add custom_name column to series_seasons
alter table public.series_seasons
add column if not exists custom_name text;

-- Add comment for documentation
comment on column public.series_seasons.custom_name is 'Optional custom display name for season (e.g., "Competition Year 2023", "Extras", "Special Episodes")';
