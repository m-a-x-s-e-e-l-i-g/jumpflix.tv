create table if not exists public.person_profiles (
    slug text primary key,
    name text not null,
    instagram_handles text[] not null default '{}'::text[],
    created_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint person_profiles_slug_check check (slug = lower(slug)),
    constraint person_profiles_instagram_handles_no_nulls check (array_position(instagram_handles, null) is null)
);

create index if not exists person_profiles_name_idx on public.person_profiles (name);

alter table public.person_profiles enable row level security;

drop policy if exists "Person profiles are viewable by everyone" on public.person_profiles;
create policy "Person profiles are viewable by everyone" on public.person_profiles
    for select using (true);

drop trigger if exists set_person_profiles_updated_at on public.person_profiles;
create trigger set_person_profiles_updated_at before update on public.person_profiles
    for each row
    execute function public.set_current_timestamp_updated_at();