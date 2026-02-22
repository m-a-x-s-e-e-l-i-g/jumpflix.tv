-- Allow the same spot to appear multiple times in a video's timeline.
--
-- Previously we prevented approving the exact same (spot_id + start/end) range more than once.
-- In practice a single spot can (legitimately) be visited multiple times, and admins may also
-- choose to approve similar/identical ranges from different suggestions.
--
-- Instead, ensure at most one approved spot_chapters row per content_suggestions record.

drop index if exists public.spot_chapters_unique_idx;

create unique index if not exists spot_chapters_created_from_suggestion_unique_idx
    on public.spot_chapters (created_from_suggestion_id);
