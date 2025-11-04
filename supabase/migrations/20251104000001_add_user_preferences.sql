-- User preferences table for storing opt-ins and user settings
create table if not exists public.user_preferences (
    user_id uuid not null references auth.users(id) on delete cascade primary key,
    marketing_opt_in boolean not null default false,
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now())
);

-- Create index for faster lookups
create index if not exists user_preferences_marketing_opt_in_idx on public.user_preferences (marketing_opt_in) where marketing_opt_in = true;

-- Enable RLS
alter table public.user_preferences enable row level security;

-- RLS Policies: Users can only see and modify their own preferences
create policy "Users can view own preferences" on public.user_preferences
    for select using (auth.uid() = user_id);

create policy "Users can insert own preferences" on public.user_preferences
    for insert with check (auth.uid() = user_id);

create policy "Users can update own preferences" on public.user_preferences
    for update using (auth.uid() = user_id);

create policy "Users can delete own preferences" on public.user_preferences
    for delete using (auth.uid() = user_id);

-- Trigger to update updated_at timestamp
drop trigger if exists set_user_preferences_updated_at on public.user_preferences;
create trigger set_user_preferences_updated_at before update on public.user_preferences
    for each row
    execute function public.set_current_timestamp_updated_at();

-- Function to automatically create user preferences on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
    insert into public.user_preferences (user_id)
    values (new.id)
    on conflict (user_id) do nothing;
    return new;
end;
$$ language plpgsql security definer;

-- Trigger to create user preferences when a new user signs up
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
    after insert on auth.users
    for each row
    execute function public.handle_new_user();
