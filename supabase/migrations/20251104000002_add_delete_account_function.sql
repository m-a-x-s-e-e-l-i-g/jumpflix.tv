-- Function to allow users to delete their own account
create or replace function public.delete_user_account()
returns void
language plpgsql
security definer
as $$
declare
    current_user_id uuid;
begin
    -- Get the current authenticated user
    current_user_id := auth.uid();
    
    if current_user_id is null then
        raise exception 'Not authenticated';
    end if;
    
    -- Delete user preferences (will be cascade deleted anyway, but explicit is clearer)
    delete from public.user_preferences where user_id = current_user_id;
    
    -- Delete watch history
    delete from public.watch_history where user_id = current_user_id;
    
    -- Delete the user from auth.users (this is the critical part)
    delete from auth.users where id = current_user_id;
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function public.delete_user_account() to authenticated;

-- Revoke from public to ensure only authenticated users can call it
revoke execute on function public.delete_user_account() from public;
