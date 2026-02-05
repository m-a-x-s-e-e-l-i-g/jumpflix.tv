-- Allow users to read (and count) their own content suggestions

alter table public.content_suggestions enable row level security;

drop policy if exists "Content suggestions are readable by creator" on public.content_suggestions;
create policy "Content suggestions are readable by creator" on public.content_suggestions
  for select
  using (created_by = auth.uid());
