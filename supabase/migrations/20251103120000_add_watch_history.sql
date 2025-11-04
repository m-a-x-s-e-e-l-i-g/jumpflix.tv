-- Watch history table for per-user playback progress
create table if not exists public.watch_history (
    user_id uuid not null references auth.users(id) on delete cascade,
    media_id text not null,
    media_type text not null check (media_type in ('movie', 'series', 'episode')),
    position_seconds integer not null default 0 check (position_seconds >= 0),
    duration_seconds integer not null default 0 check (duration_seconds >= 0),
    percent_watched real not null default 0 check (percent_watched >= 0 and percent_watched <= 100),
    is_watched boolean not null default false,
    status text not null default 'active' check (status in ('active', 'cleared')),
    watched_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    metadata jsonb not null default '{}'::jsonb,
    constraint watch_history_pkey primary key (user_id, media_id)
);

create index if not exists watch_history_user_updated_idx on public.watch_history (user_id, updated_at desc);
create index if not exists watch_history_user_status_idx on public.watch_history (user_id, status);

alter table public.watch_history enable row level security;

drop policy if exists "Watch history is viewable by owner" on public.watch_history;
create policy "Watch history is viewable by owner" on public.watch_history
    for select using (auth.uid() = user_id);

drop policy if exists "Watch history is insertable by owner" on public.watch_history;
create policy "Watch history is insertable by owner" on public.watch_history
    for insert with check (auth.uid() = user_id);

drop policy if exists "Watch history is updatable by owner" on public.watch_history;
create policy "Watch history is updatable by owner" on public.watch_history
    for update using (auth.uid() = user_id);

drop policy if exists "Watch history is deletable by owner" on public.watch_history;
create policy "Watch history is deletable by owner" on public.watch_history
    for delete using (auth.uid() = user_id);

create or replace function public.set_current_timestamp_updated_at()
returns trigger as $$
begin
    new.updated_at = now();
    return new;
end;
$$ language plpgsql security definer;

revoke all on function public.set_current_timestamp_updated_at() from public;

drop trigger if exists set_updated_at on public.watch_history;
create trigger set_updated_at before update on public.watch_history
    for each row
    execute function public.set_current_timestamp_updated_at();
