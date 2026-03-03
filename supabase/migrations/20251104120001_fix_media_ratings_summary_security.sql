-- Fix media_ratings_summary view security definer issue
-- Change from SECURITY DEFINER to SECURITY INVOKER to ensure the view
-- uses the permissions of the querying user rather than the creator

-- Option 1: Alter the existing view to use security_invoker
-- This preserves the view definition while fixing the security issue
alter view public.media_ratings_summary set (security_invoker = true);

-- Note: If the above command fails because the view doesn't support the security_invoker option
-- in your PostgreSQL version (< 15), you'll need to drop and recreate the view with the
-- exact same definition but without SECURITY DEFINER.
--
-- To do this manually:
-- 1. Get the current view definition: SELECT pg_get_viewdef('public.media_ratings_summary', true);
-- 2. Drop the view: DROP VIEW public.media_ratings_summary;
-- 3. Recreate it without the SECURITY DEFINER clause
--
-- Example (adjust based on your actual view definition):
-- CREATE VIEW public.media_ratings_summary AS
-- SELECT your_actual_view_definition_here;
