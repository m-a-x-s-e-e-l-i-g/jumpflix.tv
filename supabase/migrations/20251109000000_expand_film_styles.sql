-- Migration: Expand film style facets
-- Add more film style options for better categorization

-- First, drop the check constraint on facet_film_style
alter table public.media_items
  drop constraint if exists media_items_facet_film_style_check;

-- Add the updated constraint with more film style options
alter table public.media_items
  add constraint media_items_facet_film_style_check
  check (
    facet_film_style in (
      'cinematic',          -- Smooth camera work, controlled shots, strong color grade, polished feel
      'street-cinematic',   -- DSLR stability + fisheye inserts. Clean composition but still street grit
      'skateish',           -- VX/handcam energy, fisheye close-ups, sidewalk culture, rough and fast
      'raw',                -- No polish. Real sound, breathing, slips, banter. Training as-is
      'pov',                -- First-person or tight follow angle. Immersive, fast, physical
      'longtakes',          -- Minimal cuts. Continuous routes. Flow and timing are the edit
      'music-driven',       -- Editing rhythms follow the soundtrack. Beat-matched cuts and pacing
      'montage',            -- Quick cuts, hype, best moments stacked. Energy > continuity
      'slowmo',             -- Slow motion used deliberately to show form, weight shift, control
      'gonzo',              -- Handheld chaos. Shaky, crowd energy, "in the middle of it"
      'vintage',            -- MiniDV, Hi8, 4:3, film grain, color decay. Nostalgic skate-era vibes
      'minimalist',         -- Calm framing, few edits, open space. Quiet mood, clean pacing
      'experimental'        -- Non-linear, surreal cuts, visual abstraction, intentionally weird
    )
  );

comment on column public.media_items.facet_film_style is 'Film style: cinematic, street-cinematic, skateish, raw, pov, longtakes, music-driven, montage, slowmo, gonzo, vintage, minimalist, experimental (single-select)';
