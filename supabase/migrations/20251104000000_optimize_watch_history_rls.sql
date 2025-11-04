-- Optimize RLS policies for watch_history table
-- Replace auth.uid() with (select auth.uid()) to prevent re-evaluation for each row

drop policy if exists "Watch history is viewable by owner" on public.watch_history;
create policy "Watch history is viewable by owner" on public.watch_history
    for select using ((select auth.uid()) = user_id);

drop policy if exists "Watch history is insertable by owner" on public.watch_history;
create policy "Watch history is insertable by owner" on public.watch_history
    for insert with check ((select auth.uid()) = user_id);

drop policy if exists "Watch history is updatable by owner" on public.watch_history;
create policy "Watch history is updatable by owner" on public.watch_history
    for update using ((select auth.uid()) = user_id);

drop policy if exists "Watch history is deletable by owner" on public.watch_history;
create policy "Watch history is deletable by owner" on public.watch_history
    for delete using ((select auth.uid()) = user_id);
