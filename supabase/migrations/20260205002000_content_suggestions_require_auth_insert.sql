-- Require authenticated users for submitting content suggestions

drop policy if exists "Content suggestions are insertable" on public.content_suggestions;

create policy "Content suggestions are insertable" on public.content_suggestions
  for insert
  with check (
    status = 'pending'
    and auth.uid() is not null
    and created_by = auth.uid()
  );
