-- Add xp_units column to content_suggestions to support per-facet-type,
-- per-spot, and per-song XP awarding instead of flat per-suggestion counts.
--
-- Rules implemented in application code:
--   facets kind   → 1 unit per distinct facet-type field touched
--                   (content_warnings counts as at most 1 unit regardless
--                    of how many warnings are included)
--   spot_chapter  → 1 unit per spot
--   tracks kind   → 1 unit per song (tracks_add + track + tracks_remove)
--   all others    → 1 unit per suggestion (description, people, etc.)
--
-- DEFAULT 1 keeps backward-compatibility for existing rows.
ALTER TABLE content_suggestions
  ADD COLUMN IF NOT EXISTS xp_units INTEGER NOT NULL DEFAULT 1;
