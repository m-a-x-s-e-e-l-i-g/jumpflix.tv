-- Fix RLS policy for user preferences
-- The issue: Users can't insert during signup because they're not authenticated yet (email confirmation required)
-- Solution: Only allow insert via the trigger (security definer), users can only update after login

-- Drop the old insert policy - we don't need it anymore
drop policy if exists "Users can insert own preferences" on public.user_preferences;

-- Users can only update their preferences after they're logged in
-- The trigger will handle the initial insert with security definer privileges

-- Update the trigger function to read marketing_opt_in from user metadata
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.user_preferences (user_id, marketing_opt_in)
    values (
        new.id, 
        coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false)
    )
    on conflict (user_id) do nothing;
    return new;
end;
$$ language plpgsql security definer set search_path = public;
