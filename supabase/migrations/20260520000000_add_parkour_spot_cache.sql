-- Cache parkour.spot payloads so location lookups for map/chapters are resilient and fast.

create table if not exists public.parkour_spot_cache (
    spot_id text primary key,
    resolved_spot_id text not null,
    name text,
    lat double precision,
    lng double precision,
    payload jsonb not null,
    fetched_at timestamptz not null default timezone('utc', now()),
    updated_at timestamptz not null default timezone('utc', now()),
    constraint parkour_spot_cache_non_empty_spot_id check (length(trim(spot_id)) > 0),
    constraint parkour_spot_cache_non_empty_resolved_spot_id check (length(trim(resolved_spot_id)) > 0),
    constraint parkour_spot_cache_lat_range check (lat is null or (lat >= -90 and lat <= 90)),
    constraint parkour_spot_cache_lng_range check (lng is null or (lng >= -180 and lng <= 180))
);

create index if not exists parkour_spot_cache_resolved_spot_id_idx
    on public.parkour_spot_cache (resolved_spot_id);

create index if not exists parkour_spot_cache_fetched_at_idx
    on public.parkour_spot_cache (fetched_at desc);

alter table public.parkour_spot_cache enable row level security;

-- Keep updated_at fresh
-- Re-use helper: public.set_current_timestamp_updated_at()
drop trigger if exists set_parkour_spot_cache_updated_at on public.parkour_spot_cache;
create trigger set_parkour_spot_cache_updated_at before update on public.parkour_spot_cache
    for each row
    execute function public.set_current_timestamp_updated_at();

comment on table public.parkour_spot_cache is 'Cached parkour.spot lookup payloads used for chapter/map hydration.';
comment on column public.parkour_spot_cache.resolved_spot_id is 'Canonical spot id after duplicate resolution.';
comment on column public.parkour_spot_cache.payload is 'Raw JSON payload as returned by parkour.spot.';
